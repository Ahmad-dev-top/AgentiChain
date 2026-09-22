from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

from app.core.config import settings
from app.core.errors import ApiError

FOUNDRY_BINARIES = ("forge.exe", "cast.exe", "anvil.exe", "chisel.exe")
FORGE_SUBCOMMANDS = {"--version", "build", "test", "config", "cache", "solc"}
SLITHER_FLAGS = {"--json", "--exclude-dependencies", "--disable-color"}
SLITHER_JSON_NAME = "slither-report.json"

FOUNDRY_ZIPS = (
    "https://github.com/foundry-rs/foundry/releases/download/stable/foundry_stable_win32_amd64.zip",
    "https://github.com/foundry-rs/foundry/releases/download/nightly/foundry_nightly_win32_amd64.zip",
)
FORGE_STD_ZIP = "https://github.com/foundry-rs/forge-std/archive/refs/tags/v1.9.4.zip"
OZ_ZIP = "https://github.com/OpenZeppelin/openzeppelin-contracts/archive/refs/tags/v5.0.2.zip"


@dataclass
class ToolStatus:
    name: str
    status: str
    path: str | None = None
    version: str | None = None
    detail: str | None = None


def _cache() -> Path:
    path = settings.tool_cache_path
    path.mkdir(parents=True, exist_ok=True)
    return path


def foundry_bin_dir() -> Path:
    return _cache() / "foundry" / "bin"


def libs_dir() -> Path:
    return _cache() / "libs"


def _which(name: str) -> Path | None:
    found = shutil.which(name)
    if found:
        return Path(found)
    local = foundry_bin_dir() / name
    if local.exists():
        return local
    home = Path.home() / ".foundry" / "bin" / name
    if home.exists():
        return home
    return None


def forge_path() -> Path | None:
    return _which("forge.exe") or _which("forge")


def anvil_path() -> Path | None:
    return _which("anvil.exe") or _which("anvil")


def slither_path() -> Path | None:
    scripts = Path(sys.executable).resolve().parent
    for name in ("slither.exe", "slither"):
        candidate = scripts / name
        if candidate.exists():
            return candidate
    return _which("slither.exe") or _which("slither")


def _download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if curl:
        completed = subprocess.run(
            [curl, "-L", "--fail", "--retry", "2", "-o", str(destination), url],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
            shell=False,
        )
        if completed.returncode == 0 and destination.exists() and destination.stat().st_size > 0:
            return
        raise RuntimeError(completed.stderr.strip() or f"curl failed for {url}")
    context = None
    try:
        import certifi
        import ssl

        context = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        context = None
    request = Request(url, headers={"User-Agent": "AgentiChain-toolchain"})
    with urlopen(request, timeout=120, context=context) as response, destination.open("wb") as handle:
        shutil.copyfileobj(response, handle)


def _safe_extract(archive: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        for info in zipped.infolist():
            name = info.filename.replace("\\", "/")
            if name.startswith("/") or ".." in Path(name).parts:
                raise ApiError("Refusing to extract unsafe archive path", 500, "toolchain_error")
            zipped.extract(info, target)


def _flatten_binaries(root: Path) -> None:
    bin_dir = foundry_bin_dir()
    bin_dir.mkdir(parents=True, exist_ok=True)
    for path in root.rglob("*"):
        if path.is_file() and path.name.lower() in {name.lower() for name in FOUNDRY_BINARIES}:
            shutil.copy2(path, bin_dir / path.name)


def ensure_foundry_binaries() -> Path:
    existing = forge_path()
    if existing is not None:
        return existing
    bin_dir = foundry_bin_dir()
    download_dir = _cache() / "downloads"
    download_dir.mkdir(parents=True, exist_ok=True)
    last_error = "no download URL succeeded"
    for url in FOUNDRY_ZIPS:
        archive = download_dir / Path(url).name
        try:
            if not archive.exists() or archive.stat().st_size < 1_000_000:
                _download(url, archive)
            extract_to = download_dir / archive.stem
            if extract_to.exists():
                shutil.rmtree(extract_to)
            _safe_extract(archive, extract_to)
            _flatten_binaries(extract_to)
            found = forge_path()
            if found is not None:
                return found
        except Exception as exc:  # pragma: no cover - network/installer variance
            last_error = f"{url}: {exc}"
    raise ApiError(
        f"Foundry is not installed and automatic download failed ({last_error}). Install forge and retry.",
        503,
        "foundry_missing",
    )


def _relocate_extracted_repo(extracted_root: Path, expected_prefix: str, destination: Path) -> None:
    matches = [path for path in extracted_root.iterdir() if path.is_dir() and path.name.startswith(expected_prefix)]
    if not matches:
        raise ApiError(f"Archive did not contain {expected_prefix}", 500, "toolchain_error")
    if destination.exists():
        shutil.rmtree(destination)
    shutil.move(str(matches[0]), str(destination))


def ensure_solidity_libs() -> Path:
    root = libs_dir()
    forge_std = root / "forge-std"
    oz = root / "openzeppelin-contracts"
    download_dir = _cache() / "downloads"
    download_dir.mkdir(parents=True, exist_ok=True)
    if not (forge_std / "src" / "Test.sol").exists():
        archive = download_dir / "forge-std-v1.9.4.zip"
        if not archive.exists():
            _download(FORGE_STD_ZIP, archive)
        extract_to = download_dir / "forge-std-src"
        if extract_to.exists():
            shutil.rmtree(extract_to)
        _safe_extract(archive, extract_to)
        _relocate_extracted_repo(extract_to, "forge-std-", forge_std)
    if not (oz / "contracts" / "token" / "ERC20" / "ERC20.sol").exists():
        archive = download_dir / "openzeppelin-contracts-v5.0.2.zip"
        if not archive.exists():
            _download(OZ_ZIP, archive)
        extract_to = download_dir / "oz-src"
        if extract_to.exists():
            shutil.rmtree(extract_to)
        _safe_extract(archive, extract_to)
        _relocate_extracted_repo(extract_to, "openzeppelin-contracts-", oz)
    return root


def run_forge(args: list[str], cwd: Path, timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    forge = ensure_foundry_binaries()
    if not args or args[0] not in FORGE_SUBCOMMANDS:
        raise ApiError(f"Forge subcommand is not allowlisted: {args[:1]}", 400, "command_rejected")
    env = os.environ.copy()
    env["PATH"] = str(forge.parent) + os.pathsep + env.get("PATH", "")
    env["FOUNDRY_DISABLE_NIGHTLY_WARNING"] = "1"
    env["TERM"] = "dumb"
    limit = settings.foundry_output_limit_bytes
    completed = subprocess.run(
        [str(forge), *args],
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout or settings.foundry_timeout_seconds,
        check=False,
        shell=False,
    )
    if completed.stdout and len(completed.stdout.encode("utf-8", "ignore")) > limit:
        completed.stdout = completed.stdout[: limit // 2] + "\n[stdout truncated]\n"
    if completed.stderr and len(completed.stderr.encode("utf-8", "ignore")) > limit:
        completed.stderr = completed.stderr[: limit // 2] + "\n[stderr truncated]\n"
    return completed


def ensure_slither() -> Path:
    found = slither_path()
    if found is None:
        raise ApiError(
            "Slither is not installed. Install slither-analyzer in the backend virtualenv and retry.",
            503,
            "slither_missing",
        )
    return found


def run_slither(args: list[str], cwd: Path, timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    ensure_slither()
    if not args or args[0] != ".":
        raise ApiError("Slither target must be the job directory '.'", 400, "command_rejected")
    pending_json = False
    for arg in args[1:]:
        if pending_json:
            if arg != SLITHER_JSON_NAME:
                raise ApiError("Slither JSON output must be slither-report.json", 400, "command_rejected")
            pending_json = False
            continue
        if arg == "--json":
            pending_json = True
            continue
        if arg not in SLITHER_FLAGS:
            raise ApiError(f"Slither flag is not allowlisted: {arg}", 400, "command_rejected")
    env = os.environ.copy()
    forge = forge_path()
    path_parts = [str(Path(sys.executable).resolve().parent)]
    if forge is not None:
        path_parts.append(str(forge.parent))
    env["PATH"] = os.pathsep.join(path_parts + [env.get("PATH", "")])
    env["TERM"] = "dumb"
    limit = settings.foundry_output_limit_bytes
    completed = subprocess.run(
        [sys.executable, "-m", "slither", *args],
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout or settings.foundry_timeout_seconds,
        check=False,
        shell=False,
    )
    if completed.stdout and len(completed.stdout.encode("utf-8", "ignore")) > limit:
        completed.stdout = completed.stdout[: limit // 2] + "\n[stdout truncated]\n"
    if completed.stderr and len(completed.stderr.encode("utf-8", "ignore")) > limit:
        completed.stderr = completed.stderr[: limit // 2] + "\n[stderr truncated]\n"
    return completed


def slither_version() -> str | None:
    path = slither_path()
    if path is None:
        return None
    try:
        completed = subprocess.run(
            [str(path), "--version"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
            shell=False,
        )
        line = (completed.stdout or completed.stderr).strip().splitlines()
        return line[0] if line else None
    except Exception:
        return None


def forge_version() -> str | None:
    path = forge_path()
    if path is None:
        return None
    try:
        completed = subprocess.run(
            [str(path), "--version"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
            shell=False,
        )
        line = (completed.stdout or completed.stderr).strip().splitlines()
        return line[0] if line else None
    except Exception:
        return None


def toolchain_status() -> dict[str, ToolStatus]:
    forge = forge_path()
    anvil = anvil_path()
    slither = slither_path()
    return {
        "foundry": ToolStatus(
            name="foundry",
            status="ok" if forge else "not_installed",
            path=str(forge) if forge else None,
            version=forge_version(),
        ),
        "anvil": ToolStatus(
            name="anvil",
            status="ok" if anvil else "not_installed",
            path=str(anvil) if anvil else None,
        ),
        "slither": ToolStatus(
            name="slither",
            status="ok" if slither else "not_installed",
            path=str(slither) if slither else None,
            version=slither_version(),
            detail="Live Slither when installed; pattern scanner still used as a supplement.",
        ),
    }


ANVIL_HOST = "127.0.0.1"
ANVIL_PORT = 8545
ANVIL_RPC = f"http://{ANVIL_HOST}:{ANVIL_PORT}"
ANVIL_CHAIN_ID = 31337
ANVIL_DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
# Well-known Foundry/Anvil account 0. Broadcast is refused unless eth_chainId is 31337 on localhost.
ANVIL_LOCAL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def _rpc(method: str, params: list | None = None, rpc_url: str | None = None, timeout: int = 8):
    url = rpc_url or ANVIL_RPC
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}).encode()
    request = Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "AgentiChain/0.4",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode())
    except Exception:
        raise RuntimeError("RPC request failed") from None
    if body.get("error"):
        raise RuntimeError("RPC returned an error")
    return body.get("result")


def anvil_chain_id() -> int | None:
    try:
        value = _rpc("eth_chainId")
        return int(value, 16) if isinstance(value, str) else None
    except Exception:
        return None


def ensure_anvil() -> str:
    current = anvil_chain_id()
    if current == ANVIL_CHAIN_ID:
        return ANVIL_RPC
    anvil = anvil_path()
    if anvil is None:
        ensure_foundry_binaries()
        anvil = anvil_path()
    if anvil is None:
        raise ApiError("Anvil is not installed. Foundry binaries are required for live local deployment.", 503, "anvil_missing")
    log_path = settings.tool_cache_path / "anvil.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    if current is not None:
        raise ApiError("Refusing to broadcast: 127.0.0.1:8545 is not local Anvil chain 31337.", 409, "wrong_chain")
    handle = log_path.open("ab")
    popen_kwargs: dict = {
        "cwd": str(settings.tool_cache_path),
        "stdout": handle,
        "stderr": handle,
        "shell": False,
    }
    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    subprocess.Popen(
        [str(anvil), "--host", ANVIL_HOST, "--port", str(ANVIL_PORT), "--chain-id", str(ANVIL_CHAIN_ID), "--silent"],
        **popen_kwargs,
    )
    for _ in range(80):
        time.sleep(0.25)
        if anvil_chain_id() == ANVIL_CHAIN_ID:
            return ANVIL_RPC
    raise ApiError("Anvil started but did not become ready on 127.0.0.1:8545.", 503, "anvil_unavailable")


def assert_local_anvil() -> None:
    ensure_anvil()
    chain_id = anvil_chain_id()
    if chain_id != ANVIL_CHAIN_ID:
        raise ApiError("Refusing to broadcast: RPC is not local Anvil chain 31337.", 409, "wrong_chain")


def _parse_forge_create(output: str) -> dict | None:
    decoder = json.JSONDecoder()
    idx = 0
    found = None
    while True:
        start = output.find("{", idx)
        if start < 0:
            break
        try:
            obj, end = decoder.raw_decode(output, start)
        except json.JSONDecodeError:
            idx = start + 1
            continue
        if isinstance(obj, dict) and obj.get("deployedTo"):
            found = obj
        idx = end
    if found:
        return found
    deployed = re.search(r"Deployed to:\s*(0x[a-fA-F0-9]{40})", output)
    tx_hash = re.search(r"Transaction hash:\s*(0x[a-fA-F0-9]{64})", output)
    deployer = re.search(r"Deployer:\s*(0x[a-fA-F0-9]{40})", output)
    if deployed:
        return {
            "deployedTo": deployed.group(1),
            "transactionHash": tx_hash.group(1) if tx_hash else "",
            "deployer": deployer.group(1) if deployer else ANVIL_DEPLOYER,
        }
    return None


def _validate_create_artifact(artifact: str) -> None:
    if artifact.count(":") != 1 or ".." in artifact or artifact.startswith("/") or "\\" in artifact:
        raise ApiError("Invalid forge create artifact", 400, "command_rejected")
    source, name = artifact.split(":")
    if not source.endswith(".sol") or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        raise ApiError("Invalid forge create artifact", 400, "command_rejected")


def _run_forge_create_at(
    cwd: Path,
    artifact: str,
    constructor_args: list[str] | None,
    rpc_url: str,
    chain_id: int,
    private_key: str,
) -> dict:
    _validate_create_artifact(artifact)
    built = run_forge(["build"], cwd)
    if built.returncode != 0:
        raise ApiError(
            "forge build failed before create. " + ((built.stderr or built.stdout or "")[-1200:]),
            500,
            "deploy_failed",
        )
    forge = ensure_foundry_binaries()
    args = [
        str(forge),
        "create",
        artifact,
        "--rpc-url",
        rpc_url,
        "--private-key",
        private_key,
        "--broadcast",
        "--chain",
        str(chain_id),
        "--skip",
        "test",
        "--skip",
        "script",
        "--json",
    ]
    if constructor_args:
        args.extend(["--constructor-args", *constructor_args])
    env = os.environ.copy()
    env["PATH"] = str(forge.parent) + os.pathsep + env.get("PATH", "")
    env["FOUNDRY_DISABLE_NIGHTLY_WARNING"] = "1"
    env["TERM"] = "dumb"
    run_kwargs: dict = {
        "cwd": str(cwd),
        "env": env,
        "capture_output": True,
        "text": True,
        "timeout": settings.foundry_timeout_seconds,
        "check": False,
        "shell": False,
    }
    if os.name == "nt":
        run_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    completed = subprocess.run(args, **run_kwargs)
    combined = (completed.stdout or "") + "\n" + (completed.stderr or "")
    if private_key:
        combined = combined.replace(private_key, "<redacted>")
    payload = _parse_forge_create(combined)
    if not payload or not payload.get("deployedTo"):
        raise ApiError(
            "forge create did not return a deployment address. " + combined[-1200:],
            500,
            "deploy_failed",
        )
    return payload


def run_forge_create(cwd: Path, artifact: str, constructor_args: list[str] | None = None) -> dict:
    assert_local_anvil()
    return _run_forge_create_at(cwd, artifact, constructor_args, ANVIL_RPC, ANVIL_CHAIN_ID, ANVIL_LOCAL_KEY)


def run_forge_create_public(cwd: Path, artifact: str, constructor_args: list[str] | None, rpc_url: str, chain_id: int, private_key: str) -> dict:
    return _run_forge_create_at(cwd, artifact, constructor_args, rpc_url, chain_id, private_key)


def rpc_receipt(tx_hash: str, rpc_url: str | None = None) -> dict:
    result = _rpc("eth_getTransactionReceipt", [tx_hash], rpc_url=rpc_url, timeout=30) or {}
    return result if isinstance(result, dict) else {}


def rpc_block_number(rpc_url: str | None = None) -> int:
    value = _rpc("eth_blockNumber", rpc_url=rpc_url, timeout=30)
    return int(value, 16) if isinstance(value, str) else 0


PAUSE_SELECTOR = "0x8456cb59"
UNPAUSE_SELECTOR = "0x3f4ba83a"
PAUSED_SELECTOR = "0x5c975abb"
ALLOWED_PROBE_SELECTORS = {PAUSE_SELECTOR, UNPAUSE_SELECTOR}


def rpc_call(to: str, data: str) -> str:
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", to or ""):
        raise ApiError("Invalid contract address", 400, "invalid_address")
    if not re.fullmatch(r"0x[a-fA-F0-9]+", data or ""):
        raise ApiError("Invalid call data", 400, "command_rejected")
    assert_local_anvil()
    result = _rpc("eth_call", [{"to": to, "data": data}, "latest"])
    return result if isinstance(result, str) else "0x"


def rpc_get_logs(from_block: int, to_block: int, addresses: list[str] | None = None) -> list:
    assert_local_anvil()
    params: dict = {"fromBlock": hex(max(from_block, 0)), "toBlock": hex(max(to_block, 0))}
    if addresses:
        params["address"] = addresses[0] if len(addresses) == 1 else addresses
    result = _rpc("eth_getLogs", [params])
    return result if isinstance(result, list) else []


def rpc_send_local(to: str, data: str) -> str:
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", to or ""):
        raise ApiError("Invalid contract address", 400, "invalid_address")
    selector = (data or "").lower()
    if selector not in ALLOWED_PROBE_SELECTORS:
        raise ApiError("Only local Anvil pause/unpause probes are allowed", 400, "command_rejected")
    assert_local_anvil()
    tx_hash = _rpc(
        "eth_sendTransaction",
        [{"from": ANVIL_DEPLOYER, "to": to, "data": selector, "gas": "0x7a120"}],
    )
    if not isinstance(tx_hash, str):
        raise ApiError("Anvil did not return a transaction hash for the probe", 500, "probe_failed")
    for _ in range(30):
        receipt = rpc_receipt(tx_hash)
        if receipt.get("blockNumber"):
            return tx_hash
        time.sleep(0.1)
    return tx_hash


def rpc_personal_sign(address: str, message: str) -> str:
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address or ""):
        raise ApiError("Invalid signing address", 400, "invalid_address")
    if address.lower() != ANVIL_DEPLOYER.lower():
        raise ApiError("Local node signing is limited to Anvil account 0", 403, "anvil_only")
    if "AgentiChain" not in message or f"Chain ID: {ANVIL_CHAIN_ID}" not in message:
        raise ApiError("Refusing to sign a message that is not a local AgentiChain login challenge", 400, "sign_rejected")
    assert_local_anvil()
    hex_msg = "0x" + message.encode("utf-8").hex()
    try:
        result = _rpc("personal_sign", [hex_msg, address])
    except RuntimeError:
        result = _rpc("personal_sign", [message, address])
    if not isinstance(result, str) or not result.startswith("0x"):
        raise ApiError("Anvil did not return a signature", 500, "sign_failed")
    return result


def rpc_code(address: str, rpc_url: str | None = None) -> str:
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address or ""):
        raise ApiError("Invalid contract address", 400, "invalid_address")
    result = _rpc("eth_getCode", [address, "latest"], rpc_url=rpc_url, timeout=30)
    return result if isinstance(result, str) else "0x"


def rpc_chain_id(rpc_url: str) -> int:
    try:
        value = _rpc("eth_chainId", rpc_url=rpc_url, timeout=20)
    except Exception:
        raise ApiError("Public RPC did not return a chain id", 502, "rpc_chain_id")
    if not isinstance(value, str):
        raise ApiError("Public RPC did not return a chain id", 502, "rpc_chain_id")
    return int(value, 16)


def _hex_bytes(value: str) -> str:
    return (value or "").lower().replace("0x", "").replace(" ", "")


def _strip_solidity_metadata(hexdata: str) -> str:
    marker = "a264697066735822"
    if hexdata.endswith("0033") and marker in hexdata:
        idx = hexdata.rfind(marker)
        if idx > 0:
            return hexdata[:idx]
    return hexdata


def foundry_artifact_path(job_dir: Path, artifact: str) -> Path:
    source, name = artifact.split(":", 1)
    path = (job_dir / "out" / Path(source).name / f"{name}.json").resolve()
    if job_dir.resolve() not in path.parents:
        raise ApiError("Artifact path escaped job directory", 400, "command_rejected")
    return path


def load_foundry_artifact(job_dir: Path, artifact: str) -> dict:
    path = foundry_artifact_path(job_dir, artifact)
    if not path.is_file():
        raise ApiError(f"Foundry artifact missing for {artifact}", 500, "artifact_missing")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ApiError("Foundry artifact is not a JSON object", 500, "artifact_invalid")
    return payload


def _immutable_refs(artifact: dict) -> dict:
    deployed = artifact.get("deployedBytecode")
    if isinstance(deployed, dict) and isinstance(deployed.get("immutableReferences"), dict):
        return deployed["immutableReferences"]
    refs = artifact.get("immutableReferences")
    return refs if isinstance(refs, dict) else {}


def _mask_immutable_regions(hexdata: str, artifact: dict) -> str:
    refs = _immutable_refs(artifact)
    chars = list(hexdata)
    for positions in refs.values():
        if not isinstance(positions, list):
            continue
        for pos in positions:
            if not isinstance(pos, dict):
                continue
            start = int(pos.get("start") or 0) * 2
            length = int(pos.get("length") or 0) * 2
            for index in range(start, min(start + length, len(chars))):
                chars[index] = "0"
    return "".join(chars)


def compare_runtime_bytecode(onchain: str, artifact: dict) -> dict:
    deployed = artifact.get("deployedBytecode")
    expected = deployed.get("object") if isinstance(deployed, dict) else deployed
    onchain_hex = _hex_bytes(onchain)
    expected_hex = _hex_bytes(str(expected or ""))
    expected_hex = re.sub(r"_+\$[a-f0-9A-F]+\$_+", lambda match: "0" * len(match.group(0)), expected_hex)
    full = bool(onchain_hex) and onchain_hex == expected_hex
    stripped = bool(onchain_hex) and _strip_solidity_metadata(onchain_hex) == _strip_solidity_metadata(expected_hex)
    masked = bool(onchain_hex) and _mask_immutable_regions(
        _strip_solidity_metadata(onchain_hex), artifact
    ) == _mask_immutable_regions(_strip_solidity_metadata(expected_hex), artifact)
    return {
        "matched": full or stripped or masked,
        "fullMatch": full,
        "metadataIgnoredMatch": stripped,
        "immutablesIgnoredMatch": masked,
        "onChainBytes": len(onchain_hex) // 2,
        "artifactBytes": len(expected_hex) // 2,
    }


def run_forge_verify_bytecode(
    cwd: Path,
    artifact: str,
    address: str,
    constructor_args: list[str] | None = None,
    rpc_url: str | None = None,
    chain_id: int | None = None,
) -> dict:
    if artifact.count(":") != 1 or ".." in artifact or artifact.startswith("/") or "\\" in artifact:
        raise ApiError("Invalid forge verify artifact", 400, "command_rejected")
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
        raise ApiError("Invalid contract address", 400, "invalid_address")
    rpc = rpc_url or ANVIL_RPC
    cid = ANVIL_CHAIN_ID if chain_id is None else chain_id
    if rpc.rstrip("/") == ANVIL_RPC.rstrip("/") or cid == ANVIL_CHAIN_ID:
        assert_local_anvil()
    forge = ensure_foundry_binaries()
    args = [
        str(forge),
        "verify-bytecode",
        address,
        artifact,
        "--rpc-url",
        rpc,
        "--chain",
        str(cid),
        "--ignore",
        "creation",
        "--json",
    ]
    if constructor_args:
        args.extend(["--constructor-args", *constructor_args])
    env = os.environ.copy()
    env["PATH"] = str(forge.parent) + os.pathsep + env.get("PATH", "")
    env["FOUNDRY_DISABLE_NIGHTLY_WARNING"] = "1"
    env["TERM"] = "dumb"
    run_kwargs: dict = {
        "cwd": str(cwd),
        "env": env,
        "capture_output": True,
        "text": True,
        "timeout": min(90 if cid != ANVIL_CHAIN_ID else 45, settings.foundry_timeout_seconds),
        "check": False,
        "shell": False,
    }
    if os.name == "nt":
        run_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    try:
        completed = subprocess.run(args, **run_kwargs)
    except subprocess.TimeoutExpired:
        return {"ok": False, "returncode": -1, "output": "forge verify-bytecode timed out", "payload": None}
    combined = (completed.stdout or "") + "\n" + (completed.stderr or "")
    parsed = None
    decoder = json.JSONDecoder()
    idx = 0
    while True:
        start = combined.find("{", idx)
        if start < 0:
            break
        try:
            obj, end = decoder.raw_decode(combined, start)
        except json.JSONDecodeError:
            idx = start + 1
            continue
        if isinstance(obj, dict):
            parsed = obj
        idx = end
    text = combined.lower()
    matched = completed.returncode == 0 and "mismatch" not in text and "not verified" not in text
    if isinstance(parsed, dict):
        for key in ("runtimeMatch", "runtime_match", "matched", "verified"):
            if key in parsed:
                matched = bool(parsed[key])
                break
    return {"ok": matched, "returncode": completed.returncode, "output": combined[-1500:], "payload": parsed}

