from __future__ import annotations

from app.core.config import settings
from app.services.explorer import explorer_status
from app.services.planner import planner_status
from app.services.public_chain import oracle_cloud_status, public_broadcast_status, walletconnect_status
from app.services.telemetry import probe_redis


def _redis_status() -> dict:
    if settings.has(settings.redis_url):
        probed = probe_redis()
        return {
            "status": probed["status"] if probed["status"] == "ok" else "not_installed",
            "configured": True,
        }
    probed = probe_redis()
    return {
        "status": probed["status"],
        "configured": False,
    }


def integration_status() -> dict:
    llm = planner_status()
    explorer = explorer_status()
    public_chain = public_broadcast_status()
    wallet = walletconnect_status()
    redis = _redis_status()
    oracle = oracle_cloud_status()
    return {
        "llmPlanner": llm,
        "explorer": explorer,
        "publicChain": public_chain,
        "walletConnect": wallet,
        "redis": redis,
        "oracleCloud": oracle,
    }


def probe_map() -> dict[str, str]:
    payload = integration_status()
    return {
        "llmPlanner": payload["llmPlanner"]["status"],
        "explorer": payload["explorer"]["status"],
        "publicChain": payload["publicChain"]["status"],
        "walletConnect": payload["walletConnect"]["status"],
        "redis": payload["redis"]["status"],
        "oracleCloud": payload["oracleCloud"]["status"],
    }
