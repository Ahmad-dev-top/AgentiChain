from __future__ import annotations

import os
import re

from eth_account import Account

from app.core.config import settings
from app.core.errors import ApiError
from app.services.networks import RPC_BY_CHAIN_ID, RPC_CANDIDATES
from app.services.toolchain import ANVIL_CHAIN_ID, ANVIL_LOCAL_KEY, rpc_chain_id

PUBLIC_TESTNET_IDS = {11155111, 84532, 421614, 11155420}
PUBLIC_MAINNET_IDS = {1, 8453, 42161, 10, 137, 43114, 56}


def public_broadcast_status() -> dict:
    signer = settings.has(settings.deployer_private_key)
    ready = signer and settings.allow_public_broadcast
    address = None
    if signer:
        try:
            address = public_deployer_address()
        except Exception:
            address = None
            signer = False
            ready = False
    return {
        "status": "ready" if ready else "not_configured",
        "rpcConfigured": True,
        "signerConfigured": signer,
        "allowPublicBroadcast": settings.allow_public_broadcast,
        "allowMainnet": settings.allow_mainnet,
        "deployerAddress": address,
        "networks": sorted(RPC_BY_CHAIN_ID.keys()),
    }


def walletconnect_status() -> dict:
    configured = settings.has(settings.walletconnect_project_id)
    return {
        "status": "ready" if configured else "not_configured",
    }


def oracle_cloud_status() -> dict:
    configured = settings.has(settings.oracle_cloud_host)
    return {
        "status": "ready" if configured else "not_deployed",
    }


def _validate_https_rpc(rpc: str) -> str:
    value = rpc.strip()
    if not value.lower().startswith("https://"):
        raise ApiError("Public RPC URLs must be https", 400, "insecure_rpc")
    lowered = value.lower()
    if "127.0.0.1" in lowered or "localhost" in lowered:
        raise ApiError("Localhost RPC must use the Anvil deploy path", 400, "use_anvil")
    return value


def public_deployer_key() -> str:
    key = settings.deployer_private_key.strip()
    if not re.fullmatch(r"0x[a-fA-F0-9]{64}", key):
        raise ApiError("Server deployer key is missing or not a 32-byte 0x key.", 400, "invalid_deployer_key")
    if key.lower() == ANVIL_LOCAL_KEY.lower():
        raise ApiError("Refusing the local Anvil demo key on a public network.", 400, "anvil_key_on_public")
    return key


def public_deployer_address() -> str:
    return Account.from_key(public_deployer_key()).address


def _confirm_chain(rpc: str, chain_id: int) -> str:
    live_chain = rpc_chain_id(rpc)
    if live_chain != chain_id:
        raise ApiError(
            f"Selected network chain id {chain_id} does not match the RPC chain id {live_chain}.",
            409,
            "rpc_chain_mismatch",
        )
    return rpc


def rpc_for_chain(chain_id: int) -> str:
    if chain_id == ANVIL_CHAIN_ID:
        raise ApiError("Use the local Anvil path for chain 31337", 400, "use_anvil")
    if chain_id not in PUBLIC_TESTNET_IDS and chain_id not in PUBLIC_MAINNET_IDS:
        raise ApiError("Unsupported public chain id", 400, "unsupported_chain")
    override = os.environ.get(f"RPC_URL_{chain_id}", "").strip()
    if override:
        return _confirm_chain(_validate_https_rpc(override), chain_id)
    preferred = settings.public_rpc_url.strip()
    if preferred:
        try:
            candidate = _validate_https_rpc(preferred)
            live = rpc_chain_id(candidate)
            if live == chain_id:
                return candidate
        except ApiError:
            pass
    last_error: ApiError | None = None
    for url in RPC_CANDIDATES.get(chain_id) or [RPC_BY_CHAIN_ID.get(chain_id, "")]:
        if not url:
            continue
        try:
            return _confirm_chain(_validate_https_rpc(url), chain_id)
        except ApiError as exc:
            last_error = exc
            continue
    raise last_error or ApiError("No working HTTPS RPC for the selected network.", 502, "rpc_unavailable")


def assert_public_rpc_for_chain(chain_id: int) -> str:
    return rpc_for_chain(chain_id)


def assert_public_broadcast_allowed(chain_id: int) -> str:
    status = public_broadcast_status()
    if status["status"] != "ready":
        raise ApiError(
            "Public broadcast is not configured on the server. Set a deployer key and ALLOW_PUBLIC_BROADCAST=true in the server env file.",
            400,
            "public_broadcast_not_configured",
        )
    if chain_id in PUBLIC_MAINNET_IDS and not settings.allow_mainnet:
        raise ApiError(
            "Refusing mainnet/L2 mainnet broadcast. Set ALLOW_MAINNET=true on the server only when you intend a real public transaction.",
            400,
            "mainnet_gated",
        )
    public_deployer_key()
    return rpc_for_chain(chain_id)
