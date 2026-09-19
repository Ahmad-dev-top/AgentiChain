from __future__ import annotations

import os
import shutil
import subprocess
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

from app.core.config import settings
from app.core.errors import ApiError

FOUNDRY_BINARIES = ("forge.exe", "cast.exe", "anvil.exe", "chisel.exe")
FORGE_SUBCOMMANDS = {"--version", "build", "test", "config", "cache", "solc"}

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
            detail="Pattern scanner is still used until Slither is wired.",
        ),
    }
