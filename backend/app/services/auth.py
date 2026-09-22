from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db import AuthSessionRow
from app.models.schemas import WalletSession
from app.services.public_chain import PUBLIC_MAINNET_IDS, PUBLIC_TESTNET_IDS
from app.services.toolchain import (
    ANVIL_CHAIN_ID,
    ANVIL_DEPLOYER,
    ANVIL_RPC,
    ensure_anvil,
    rpc_personal_sign,
)

ALLOWED_LOGIN_CHAINS = PUBLIC_TESTNET_IDS | PUBLIC_MAINNET_IDS | {ANVIL_CHAIN_ID}

NONCE_TTL = timedelta(minutes=10)
SESSION_TTL = timedelta(hours=12)
_nonces: dict[str, dict] = {}


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat()


def _normalize_address(address: str) -> str:
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address or ""):
        raise ApiError("Invalid wallet address", 400, "invalid_address")
    return "0x" + address[2:].lower()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_browser_login_message(address: str, nonce: str, chain_id: int) -> str:
    issued = _now().strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        "AgentiChain wants you to sign in with your browser wallet.\n\n"
        f"URI: http://127.0.0.1:8000\n"
        f"Address: {address}\n"
        f"Chain ID: {chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued}\n\n"
        "This signature only opens a command-center session. It does not broadcast a transaction."
    )


def build_login_message(address: str, nonce: str) -> str:
    issued = _now().strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        "AgentiChain local command center wants you to sign in.\n\n"
        f"URI: http://127.0.0.1:8000\n"
        f"Address: {address}\n"
        f"Chain ID: {ANVIL_CHAIN_ID}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued}\n\n"
        "This authenticates a local Anvil session only. It is not Ethereum or Base mainnet login."
    )


def create_challenge(address: str | None = None, chain_id: int | None = None, browser: bool = False) -> dict:
    if browser:
        if not address:
            raise ApiError("A browser wallet address is required", 400, "invalid_address")
        if chain_id not in ALLOWED_LOGIN_CHAINS:
            raise ApiError("Unsupported browser wallet chain", 400, "unsupported_chain")
        account = _normalize_address(address)
        nonce = secrets.token_hex(16)
        message = build_browser_login_message(account, nonce, int(chain_id))
        _nonces[nonce] = {
            "address": account,
            "message": message,
            "expires": _now() + NONCE_TTL,
            "chainId": int(chain_id),
            "method": "browser",
        }
        return {
            "address": account,
            "nonce": nonce,
            "message": message,
            "chainId": int(chain_id),
            "method": "browser",
            "note": "Approve this signature in the browser wallet. The private key stays in the wallet and is not sent to the server.",
        }
    account = _normalize_address(address or ANVIL_DEPLOYER)
    nonce = secrets.token_hex(16)
    message = build_login_message(account, nonce)
    _nonces[nonce] = {
        "address": account,
        "message": message,
        "expires": _now() + NONCE_TTL,
        "chainId": ANVIL_CHAIN_ID,
        "method": "eip191",
    }
    return {
        "address": account,
        "nonce": nonce,
        "message": message,
        "chainId": ANVIL_CHAIN_ID,
        "rpc": ANVIL_RPC,
        "method": "eip191",
        "note": "Sign this message for a local Anvil session. The private key must not be pasted into the app.",
    }


def recover_signer(message: str, signature: str) -> str:
    if not re.fullmatch(r"0x[a-fA-F0-9]+", signature or "") or len(signature) < 130:
        raise ApiError("Invalid signature", 400, "invalid_signature")
    try:
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
    except Exception as exc:
        raise ApiError(f"Could not recover signer: {exc}", 400, "invalid_signature") from exc
    return recovered.lower()


async def _persist_session(session: AsyncSession, address: str, method: str, chain_id: int) -> WalletSession:
    token = secrets.token_urlsafe(32)
    expires = _now() + SESSION_TTL
    browser = method == "browser"
    row = AuthSessionRow(
        id=f"sess-{secrets.token_hex(8)}",
        token_hash=_hash_token(token),
        address=address,
        chain_id=chain_id,
        method=method,
        expires_at=expires,
        created_at=_now(),
    )
    session.add(row)
    await session.commit()
    return WalletSession(
        token=token,
        address=address,
        chainId=chain_id,
        method=method,
        expiresAt=_iso(expires),
        rpc="browser-wallet" if browser else ANVIL_RPC,
        note=(
            f"Browser wallet session for {address} on chain {chain_id}. The private key was not stored. Public broadcast still uses the server deployer."
            if browser
            else f"Local Anvil session for {address}. Chain ID {ANVIL_CHAIN_ID} only. Private keys were not stored."
        ),
    )


def verify_signature_sync(address: str, nonce: str, signature: str) -> tuple[str, int, str]:
    challenge = _nonces.get(nonce)
    if challenge is None or challenge["expires"] < _now():
        raise ApiError("Login nonce is missing or expired", 401, "nonce_expired")
    expected = _normalize_address(address)
    if challenge["address"] != expected:
        raise ApiError("Address does not match the issued challenge", 401, "address_mismatch")
    message = challenge["message"]
    chain_id = int(challenge.get("chainId") or ANVIL_CHAIN_ID)
    method = str(challenge.get("method") or "eip191")
    if f"Chain ID: {chain_id}" not in message:
        raise ApiError("Login challenge is missing its chain id", 401, "wrong_chain")
    if method == "browser":
        if chain_id not in ALLOWED_LOGIN_CHAINS:
            raise ApiError("Unsupported browser wallet chain", 401, "unsupported_chain")
    elif chain_id != ANVIL_CHAIN_ID:
        raise ApiError("Refusing a challenge that is not bound to local Anvil 31337", 401, "wrong_chain")
    recovered = recover_signer(message, signature)
    if recovered != expected:
        raise ApiError("Signature does not match the challenged address", 401, "bad_signature")
    _nonces.pop(nonce, None)
    return expected, chain_id, method


async def verify_signature(session: AsyncSession, address: str, nonce: str, signature: str) -> WalletSession:
    expected, chain_id, method = verify_signature_sync(address, nonce, signature)
    return await _persist_session(session, expected, method, chain_id)


async def sign_in_with_anvil(db: AsyncSession) -> WalletSession:
    ensure_anvil()
    challenge = create_challenge(ANVIL_DEPLOYER)
    signature = rpc_personal_sign(ANVIL_DEPLOYER, challenge["message"])
    return await verify_signature(db, challenge["address"], challenge["nonce"], signature)


async def resolve_session(db: AsyncSession, token: str | None) -> AuthSessionRow:
    if not token:
        raise ApiError("Sign in with the local Anvil account first", 401, "auth_required")
    digest = _hash_token(token)
    row = (await db.execute(select(AuthSessionRow).where(AuthSessionRow.token_hash == digest))).scalar_one_or_none()
    if row is None or _aware(row.expires_at) < _now():
        raise ApiError("Session expired or invalid", 401, "auth_invalid")
    if row.method == "browser":
        if row.chain_id not in ALLOWED_LOGIN_CHAINS:
            raise ApiError("Browser wallet session chain is not supported", 401, "wrong_chain")
    elif row.chain_id != ANVIL_CHAIN_ID:
        raise ApiError("Session is not bound to local Anvil chain 31337", 401, "wrong_chain")
    return row


async def revoke_session(db: AsyncSession, token: str | None) -> None:
    if not token:
        return
    digest = _hash_token(token)
    row = (await db.execute(select(AuthSessionRow).where(AuthSessionRow.token_hash == digest))).scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.commit()
