from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import settings
from app.services.toolchain import ANVIL_CHAIN_ID

EXPLORER_CHAIN_IDS = {
    1: "ethereum",
    11155111: "sepolia",
    8453: "base",
    84532: "base-sepolia",
    42161: "arbitrum",
    421614: "arbitrum-sepolia",
    10: "optimism",
    11155420: "optimism-sepolia",
    137: "polygon",
    43114: "avalanche",
    56: "bsc",
}


def explorer_status() -> dict:
    configured = settings.has(settings.etherscan_api_key)
    return {
        "status": "ready" if configured else "not_configured",
    }


def maybe_submit_explorer(chain_id: int, address: str, contract_name: str, source_code: str) -> dict:
    meta = explorer_status()
    if chain_id == ANVIL_CHAIN_ID:
        return {
            **meta,
            "submitted": False,
            "skipped": True,
            "reason": "anvil",
            "note": "Local Anvil bytecode is matched on this machine. Public explorers are not contacted for chain 31337.",
        }
    if meta["status"] != "ready":
        return {**meta, "submitted": False, "skipped": True, "reason": "not_configured"}
    if chain_id not in EXPLORER_CHAIN_IDS:
        return {**meta, "submitted": False, "skipped": True, "reason": "unsupported_chain"}
    form = urlencode(
        {
            "chainid": str(chain_id),
            "module": "contract",
            "action": "verifysourcecode",
            "apikey": settings.etherscan_api_key.strip(),
            "contractaddress": address,
            "sourceCode": source_code,
            "codeformat": "solidity-single-file",
            "contractname": contract_name,
            "compilerversion": "v0.8.24+commit.e11b9ed9",
            "optimizationUsed": "1",
            "runs": "200",
        }
    ).encode("utf-8")
    request = Request("https://api.etherscan.io/v2/api", data=form, method="POST")
    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return {
            **meta,
            "status": "ok",
            "submitted": str(payload.get("status")) == "1",
            "result": str(payload.get("result") or "")[:240],
            "note": "Submitted to the configured explorer. Confirm on the explorer; this is not local Anvil verification.",
        }
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        return {**meta, "status": "error", "submitted": False, "detail": str(exc)[:240]}
