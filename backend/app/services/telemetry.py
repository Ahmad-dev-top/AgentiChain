from __future__ import annotations

import os
import platform
import socket
import time
from collections import deque
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AuditLogRow
from app.services.keeper import keeper_hub
from app.services.toolchain import toolchain_status

STARTED_AT = time.time()
REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6379
SKIP_LOG_PATHS = {"/", "/api/health", "/api/telemetry", "/docs", "/redoc", "/openapi.json"}
_LOGS: deque[dict] = deque(maxlen=80)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def probe_redis() -> dict:
    try:
        with socket.create_connection((REDIS_HOST, REDIS_PORT), timeout=0.25) as conn:
            conn.sendall(b"PING\r\n")
            reply = conn.recv(32)
        if b"PONG" in reply:
            return {
                "status": "ok",
                "engine": "redis",
                "endpoint": f"{REDIS_HOST}:{REDIS_PORT}",
                "note": "Local Redis answered PING. Oracle Cloud Redis is not deployed.",
            }
    except OSError:
        pass
    return {
        "status": "not_installed",
        "engine": None,
        "endpoint": f"{REDIS_HOST}:{REDIS_PORT}",
        "note": "Redis is not running locally. Request logs persist in SQLite instead of a Redis worker queue.",
    }


def _memory() -> dict:
    payload: dict = {}
    try:
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        status = MEMORYSTATUSEX()
        status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            payload = {
                "totalBytes": int(status.ullTotalPhys),
                "availableBytes": int(status.ullAvailPhys),
                "usedPercent": int(status.dwMemoryLoad),
            }
    except Exception:
        payload = {}
    return payload


def host_metrics() -> dict:
    memory = _memory()
    return {
        "hostname": platform.node(),
        "system": platform.system(),
        "release": platform.release(),
        "python": platform.python_version(),
        "pid": os.getpid(),
        "cpuCount": os.cpu_count() or 1,
        "uptimeSeconds": round(time.time() - STARTED_AT, 1),
        "memory": memory,
        "note": "Local process metrics. This is not an Oracle Cloud ARM host.",
    }


def should_log_path(path: str) -> bool:
    if path in SKIP_LOG_PATHS:
        return False
    if path.startswith("/docs") or path.startswith("/redoc") or path.startswith("/json"):
        return False
    return True


async def record_request(
    session: AsyncSession,
    *,
    method: str,
    path: str,
    status_code: int,
    correlation_id: str,
    latency_ms: int,
) -> None:
    if not should_log_path(path):
        return
    entry = {
        "id": f"log-{uuid4().hex[:12]}",
        "correlationId": correlation_id,
        "method": method,
        "path": path,
        "statusCode": status_code,
        "latencyMs": max(latency_ms, 0),
        "createdAt": _iso(_now()),
    }
    _LOGS.appendleft(entry)
    try:
        session.add(
            AuditLogRow(
                id=entry["id"],
                correlation_id=correlation_id,
                method=method,
                path=path,
                status_code=status_code,
                message=f"{entry['latencyMs']}ms",
                created_at=_now(),
            )
        )
        await session.commit()
    except Exception:
        await session.rollback()


async def recent_request_logs(session: AsyncSession, limit: int = 40) -> list[dict]:
    if _LOGS:
        return list(_LOGS)[:limit]
    rows = (
        await session.execute(select(AuditLogRow).order_by(AuditLogRow.created_at.desc()).limit(limit))
    ).scalars().all()
    logs: list[dict] = []
    for row in rows:
        latency_text = (row.message or "").replace("ms", "").strip()
        try:
            latency_ms = int(latency_text)
        except ValueError:
            latency_ms = 0
        logs.append(
            {
                "id": row.id,
                "correlationId": row.correlation_id,
                "method": row.method,
                "path": row.path,
                "statusCode": row.status_code,
                "latencyMs": latency_ms,
                "createdAt": _iso(row.created_at) if row.created_at else "",
            }
        )
    return logs


async def telemetry_snapshot(session: AsyncSession) -> dict:
    db_ok = True
    try:
        await session.execute(text("select 1"))
    except Exception:
        db_ok = False
    tools = {name: status.__dict__ for name, status in toolchain_status().items()}
    keeper = keeper_hub.status_payload()
    probes = {
        "database": "ok" if db_ok else "error",
        "foundry": tools.get("foundry", {}).get("status", "missing"),
        "anvil": tools.get("anvil", {}).get("status", "missing"),
        "slither": tools.get("slither", {}).get("status", "missing"),
        "keeper": keeper_hub.status,
        "walletAuth": "ok",
    }
    live_core = all(probes[name] in {"ok", "live"} for name in ("database", "foundry", "anvil", "slither", "keeper", "walletAuth"))
    host = host_metrics()
    return {
        "live": live_core,
        "engine": "local_probes",
        "host": {
            "hostname": host["hostname"],
            "system": host["system"],
            "release": host["release"],
            "pid": host["pid"],
            "cpuCount": host["cpuCount"],
            "uptimeSeconds": host["uptimeSeconds"],
            "memory": host.get("memory") or {},
        },
        "probes": probes,
        "keeper": keeper,
        "requestLogs": await recent_request_logs(session),
        "note": "Local process telemetry.",
    }
