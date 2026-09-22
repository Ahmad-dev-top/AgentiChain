from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from subprocess import TimeoutExpired

from app.core.config import settings
from app.core.errors import ApiError
from app.models.schemas import ContractFile, SecurityAuditReport, VulnerabilityItem
from app.services.foundry_project import materialize_foundry_project
from app.services.security import analyze_solidity_code
from app.services.toolchain import ensure_foundry_binaries, run_slither, slither_version

SKIP_CHECKS = {"pragma", "solc-version", "naming-convention", "similar-names"}
CRITICAL_CHECKS = {
    "arbitrary-send-eth",
    "controlled-delegatecall",
    "suicidal",
    "uninitialized-state",
    "arbitrary-send-erc20",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_json(text: str):
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


def _map_severity(check: str, impact: str) -> str:
    impact_lower = (impact or "").lower()
    if check in CRITICAL_CHECKS:
        return "Critical"
    if impact_lower == "high":
        return "High"
    if impact_lower == "medium":
        return "Medium"
    if impact_lower == "low":
        return "Low"
    if impact_lower == "optimization":
        return "Gas"
    return "Informational"


def _lines_from_element(element: dict) -> list[int]:
    mapping = element.get("source_mapping") or {}
    lines = mapping.get("lines") or []
    if isinstance(lines, list):
        return [int(item) for item in lines if str(item).isdigit() or isinstance(item, int)]
    return []


def parse_slither_detectors(payload) -> list[VulnerabilityItem]:
    findings: list[VulnerabilityItem] = []
    if not isinstance(payload, dict):
        return findings
    detectors = ((payload.get("results") or {}).get("detectors")) or []
    for index, detector in enumerate(detectors):
        if not isinstance(detector, dict):
            continue
        check = str(detector.get("check") or "unknown")
        if check in SKIP_CHECKS:
            continue
        elements = detector.get("elements") or []
        first = elements[0] if elements and isinstance(elements[0], dict) else {}
        mapping = first.get("source_mapping") or {}
        file_path = str(mapping.get("filename_relative") or mapping.get("filename_short") or "src/Contract.sol")
        if "lib/" in file_path.replace("\\", "/"):
            continue
        findings.append(
            VulnerabilityItem(
                id=f"slither-{check}-{index}",
                title=str(detector.get("check") or "Slither finding").replace("-", " ").title(),
                detectorId=f"slither.{check}",
                severity=_map_severity(check, str(detector.get("impact") or "")),
                cwe=None,
                swcId=None,
                filePath=file_path,
                lineNumbers=_lines_from_element(first),
                description=str(detector.get("description") or "").strip(),
                impact=str(detector.get("impact") or "Unknown"),
                recommendation=f"Review Slither detector `{check}` (confidence: {detector.get('confidence')}).",
                status="open",
            )
        )
    return findings


def _score(vulnerabilities: list[VulnerabilityItem]) -> tuple[dict[str, int], int]:
    counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0, "Gas": 0}
    for item in vulnerabilities:
        counts[item.severity] = counts.get(item.severity, 0) + 1
    score = max(
        0,
        min(
            100,
            100
            - counts["Critical"] * 40
            - counts["High"] * 20
            - counts["Medium"] * 10
            - counts["Low"] * 5
            - counts["Gas"] * 2,
        ),
    )
    return counts, score


def _dedupe(items: list[VulnerabilityItem]) -> list[VulnerabilityItem]:
    seen: set[tuple] = set()
    unique: list[VulnerabilityItem] = []
    for item in items:
        key = (item.detectorId, item.filePath, tuple(item.lineNumbers[:2]), item.title)
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def run_live_security_audit(
    contracts: list[ContractFile],
    project_id: str = "proj-temp",
    extra_pattern_code: str | None = None,
    extra_pattern_path: str = "src/Contract.sol",
) -> SecurityAuditReport:
    if not contracts and not extra_pattern_code:
        raise ApiError("Solidity sources are required for a security audit", 400, "missing_contracts")

    sources = list(contracts)
    if extra_pattern_code and not sources:
        sources = [
            ContractFile(
                id="c-audit-core",
                projectId=project_id,
                name=Path(extra_pattern_path).name,
                filePath=extra_pattern_path,
                contractType="core",
                version=1,
                code=extra_pattern_code,
            )
        ]

    job_dir = settings.foundry_jobs_path / f"audit-{project_id}-{uuid.uuid4().hex[:8]}"
    job_dir.parent.mkdir(parents=True, exist_ok=True)
    notes: list[str] = []
    slither_findings: list[VulnerabilityItem] = []
    live = False
    version = slither_version()
    try:
        ensure_foundry_binaries()
        materialize_foundry_project(job_dir, sources)
        slither = run_slither(
            [".", "--json", "slither-report.json", "--exclude-dependencies", "--disable-color"],
            cwd=job_dir,
        )
        report_path = job_dir / "slither-report.json"
        payload = None
        if report_path.exists():
            payload = _extract_json(report_path.read_text(encoding="utf-8"))
        if payload is None:
            payload = _extract_json(slither.stdout) or _extract_json(slither.stderr)
        slither_findings = parse_slither_detectors(payload)
        live = payload is not None
        if not live:
            notes.append("Slither did not return parseable JSON. Pattern findings are still included.")
            notes.extend((slither.stderr or slither.stdout or "").splitlines()[-20:])
        else:
            notes.append(f"Live Slither detectors: {len(slither_findings)}")
    except TimeoutExpired:
        notes.append("Slither exceeded the configured timeout.")
    except ApiError as exc:
        notes.append(str(exc))
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

    pattern_code = extra_pattern_code or next((item.code for item in sources if item.contractType == "core"), sources[0].code)
    pattern_path = extra_pattern_path or next((item.filePath for item in sources if item.contractType == "core"), sources[0].filePath)
    pattern_report = analyze_solidity_code(pattern_code, pattern_path, project_id)
    merged = _dedupe([*slither_findings, *pattern_report.vulnerabilities])
    counts, score = _score(merged)
    grade = "Grade A+" if score >= 90 else "Grade B" if score >= 75 else "Action Required"
    engine = "slither+pattern" if live else "pattern"
    summary = "\n\n".join(f"- **[{item.severity}] {item.title}** (`{item.detectorId}`)\n  {item.description[:280]}" for item in merged) or "No findings."
    report_md = (
        f"# AgentiChain Security Audit Report\n"
        f"**Engine**: {engine}\n"
        f"**Slither**: {version or 'not available'}\n"
        f"**Security Score**: **{score} / 100** ({grade})\n"
        f"**Vulnerabilities Found**: {len(merged)}\n\n"
        f"### Notes\n" + "\n".join(f"- {note}" for note in notes) + "\n\n"
        f"### Summary of Findings\n{summary}\n"
    )
    return SecurityAuditReport(
        id=f"aud-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        projectId=project_id,
        totalIssues=len(merged),
        criticalCount=counts["Critical"],
        highCount=counts["High"],
        mediumCount=counts["Medium"],
        lowCount=counts["Low"],
        infoCount=counts["Informational"],
        gasCount=counts["Gas"],
        securityScore=score,
        auditReportMd=report_md,
        isPatched=not merged,
        vulnerabilities=merged,
        createdAt=_now(),
        live=live,
        engine=engine,
        slitherVersion=version,
    )
