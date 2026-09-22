from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

ALLOWED_STANDARDS = {
    "ERC20",
    "ERC721",
    "ERC1155",
    "ERC4626",
    "STAKING",
    "GOVERNOR",
    "ESCROW",
    "AMM",
    "LENDING",
    "RESTAKING",
    "ACCOUNT_ABSTRACTION",
    "CUSTOM",
}


def planner_status() -> dict:
    configured = settings.has(settings.openai_api_key)
    return {
        "status": "ready" if configured else "not_configured",
    }


def run_llm_planner(prompt: str, target_chain: str) -> tuple[dict | None, dict]:
    meta = planner_status()
    if meta["status"] != "ready":
        return None, {**meta, "used": False}
    body = {
        "model": settings.openai_model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Return JSON only with keys: standard, contractName, title, pausable, timelock, "
                    "oracle, fee, accessControl. standard must be one of: "
                    + ", ".join(sorted(ALLOWED_STANDARDS))
                    + ". This is a local AgentiChain planner, not a mainnet deployment."
                ),
            },
            {"role": "user", "content": f"Target chain tag: {target_chain}\nPrompt: {prompt}"},
        ],
    }
    endpoint = settings.openai_base_url.rstrip("/") + "/chat/completions"
    request = Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + settings.openai_api_key.strip(),
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = (((payload.get("choices") or [{}])[0].get("message") or {}).get("content")) or "{}"
        plan = json.loads(content)
        standard = str(plan.get("standard") or "CUSTOM").upper()
        if standard not in ALLOWED_STANDARDS:
            standard = "CUSTOM"
        normalized = {
            "standard": standard,
            "contractName": str(plan.get("contractName") or "").strip() or None,
            "title": str(plan.get("title") or "").strip() or None,
            "pausable": bool(plan.get("pausable")),
            "timelock": bool(plan.get("timelock")),
            "oracle": bool(plan.get("oracle")),
            "fee": bool(plan.get("fee")),
            "accessControl": bool(plan.get("accessControl")),
        }
        return normalized, {**meta, "status": "ok", "used": True}
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        return None, {**meta, "status": "error", "used": False, "detail": str(exc)[:240]}
