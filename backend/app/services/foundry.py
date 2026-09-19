from __future__ import annotations

import json
import shutil
import time
import uuid
from datetime import datetime, timezone
from subprocess import TimeoutExpired

from app.core.config import settings
from app.core.errors import ApiError
from app.models.schemas import ContractFile, ForgeTestResult, GasBenchmarkItem, SimulationResult
from app.services.foundry_project import materialize_foundry_project
from app.services.toolchain import ensure_foundry_binaries, forge_version, run_forge


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _duration_ms(value) -> int:
    if isinstance(value, dict):
        secs = int(value.get("secs") or 0)
        nanos = int(value.get("nanos") or 0)
        return secs * 1000 + nanos // 1_000_000
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and "ms" in value:
        try:
            return int(float(value.split("ms")[0].strip()))
        except ValueError:
            return 0
    return 0


def _extract_gas(kind) -> int:
    if not isinstance(kind, dict):
        return 0
    unit = kind.get("Unit") or kind.get("unit") or {}
    if isinstance(unit, dict):
        return int(unit.get("gas") or 0)
    fuzz = kind.get("Fuzz") or kind.get("fuzz") or {}
    if isinstance(fuzz, dict):
        median = fuzz.get("median_gas") or fuzz.get("mean_gas") or 0
        return int(median)
    return 0


def _extract_json_payload(text: str):
    text = (text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def parse_forge_test_report(payload) -> tuple[list[ForgeTestResult], list[GasBenchmarkItem]]:
    tests: list[ForgeTestResult] = []
    if payload is None:
        return tests, []
    results = payload.get("results") if isinstance(payload, dict) and "results" in payload else payload
    if not isinstance(results, dict):
        return tests, []
    for suite_name, suite in results.items():
        if not isinstance(suite, dict):
            continue
        test_results = suite.get("test_results") or suite.get("testResults") or {}
        if not isinstance(test_results, dict):
            continue
        for test_name, result in test_results.items():
            if not isinstance(result, dict):
                continue
            raw_status = str(result.get("status") or "")
            status = "PASS" if raw_status.lower() in {"success", "pass", "ok"} else "FAIL"
            kind = result.get("kind") if isinstance(result.get("kind"), dict) else {}
            fuzz_runs = None
            fuzz = kind.get("Fuzz") if isinstance(kind.get("Fuzz"), dict) else None
            if fuzz and fuzz.get("runs") is not None:
                fuzz_runs = int(fuzz.get("runs"))
            reason = result.get("reason")
            tests.append(
                ForgeTestResult(
                    name=test_name,
                    suite=str(suite_name),
                    status=status,
                    durationMs=_duration_ms(result.get("duration")),
                    gasUsed=_extract_gas(kind),
                    fuzzRuns=fuzz_runs,
                    errorMessage=str(reason) if reason else None,
                )
            )
    gas = [
        GasBenchmarkItem(
            functionName=item.name,
            minGas=item.gasUsed,
            avgGas=item.gasUsed,
            maxGas=item.gasUsed,
            callsCount=1,
            optimizedAvgGas=item.gasUsed,
            savingsPercentage=0,
        )
        for item in tests
        if item.gasUsed
    ]
    return tests, gas


def run_foundry_simulation(
    contract_name: str,
    project_id: str = "proj-temp",
    network_fork: str = "local anvil",
    contracts: list[ContractFile] | None = None,
) -> SimulationResult:
    if not contracts:
        raise ApiError("A project with Solidity files is required for live Foundry simulation", 400, "missing_contracts")

    started = time.perf_counter()
    logs: list[str] = []
    job_dir = settings.foundry_jobs_path / f"{project_id}-{uuid.uuid4().hex[:8]}"
    job_dir.parent.mkdir(parents=True, exist_ok=True)
    status = "failed"
    tests: list[ForgeTestResult] = []
    gas: list[GasBenchmarkItem] = []
    try:
        forge = ensure_foundry_binaries()
        logs.append(f"[INFO] Using live Foundry binary: {forge}")
        version = forge_version()
        if version:
            logs.append(f"[INFO] {version}")
        materialize_foundry_project(job_dir, contracts)
        logs.append(f"[INFO] Materialized Foundry project at {job_dir}")
        logs.append("[COMPILER] forge build (solc 0.8.24, optimizer 200)")
        build = run_forge(["build"], cwd=job_dir)
        if build.stdout:
            logs.extend(build.stdout.splitlines()[-40:])
        if build.returncode != 0:
            logs.append("[FAIL] forge build failed")
            logs.extend((build.stderr or "").splitlines()[-80:])
            return SimulationResult(
                id=f"sim-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                projectId=project_id,
                simType="anvil_local",
                networkFork=network_fork,
                blockNumber=0,
                totalTests=0,
                passedTests=0,
                failedTests=1,
                durationMs=int((time.perf_counter() - started) * 1000),
                status="failed",
                tests=[],
                gasBenchmarks=[],
                traceLogs=logs,
                createdAt=_now(),
                live=True,
                engine="forge",
                forgeVersion=version,
            )

        logs.append("[TEST] forge test --json")
        report = run_forge(["test", "--json"], cwd=job_dir)
        for line in (report.stderr or "").splitlines()[-20:]:
            if not line.startswith("{"):
                logs.append(line)
        payload = _extract_json_payload(report.stdout) or _extract_json_payload(report.stderr)
        tests, gas = parse_forge_test_report(payload)
        passed = sum(1 for item in tests if item.status == "PASS")
        failed = sum(1 for item in tests if item.status == "FAIL")
        if not tests:
            logs.append("[WARN] forge produced no parseable JSON test report; capturing raw output")
            logs.extend((report.stdout or "").splitlines()[-50:])
            failed = 1 if report.returncode != 0 else 0
        status = "passed" if report.returncode == 0 and failed == 0 else "failed"
        logs.append(f"[SUMMARY] live forge: {passed} passed, {failed} failed, exit={report.returncode}")
        return SimulationResult(
            id=f"sim-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            projectId=project_id,
            simType="anvil_local",
            networkFork="local forge (no RPC fork)",
            blockNumber=0,
            totalTests=len(tests) or (0 if status == "passed" else 1),
            passedTests=passed,
            failedTests=failed if tests else (0 if status == "passed" else 1),
            durationMs=int((time.perf_counter() - started) * 1000),
            status=status,
            tests=tests,
            gasBenchmarks=gas,
            traceLogs=logs,
            createdAt=_now(),
            live=True,
            engine="forge",
            forgeVersion=version,
        )
    except TimeoutExpired:
        logs.append("[FAIL] forge exceeded the configured timeout")
        return SimulationResult(
            id=f"sim-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            projectId=project_id,
            simType="anvil_local",
            networkFork=network_fork,
            blockNumber=0,
            totalTests=0,
            passedTests=0,
            failedTests=1,
            durationMs=int((time.perf_counter() - started) * 1000),
            status="failed",
            tests=[],
            gasBenchmarks=[],
            traceLogs=logs,
            createdAt=_now(),
            live=True,
            engine="forge",
            forgeVersion=forge_version(),
        )
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)
