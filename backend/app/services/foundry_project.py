from __future__ import annotations

import shutil
from pathlib import Path

from app.models.schemas import ContractFile
from app.services.toolchain import ensure_solidity_libs, libs_dir

FOUNDRY_TOML = """[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
evm_version = "cancun"
ffi = false
fs_permissions = []
verbosity = 2
"""

REMAPPINGS = """forge-std/=lib/forge-std/src/
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
"""


def _safe_relative_path(file_path: str) -> Path:
    relative = Path(file_path.replace("\\", "/"))
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Unsafe Solidity path: {file_path}")
    return relative


def materialize_foundry_project(job_dir: Path, contracts: list[ContractFile]) -> Path:
    if job_dir.exists():
        shutil.rmtree(job_dir)
    (job_dir / "src").mkdir(parents=True)
    (job_dir / "test").mkdir(parents=True)
    (job_dir / "lib").mkdir(parents=True)
    (job_dir / "foundry.toml").write_text(FOUNDRY_TOML, encoding="utf-8")
    (job_dir / "remappings.txt").write_text(REMAPPINGS, encoding="utf-8")

    ensure_solidity_libs()
    cached = libs_dir()
    shutil.copytree(cached / "forge-std", job_dir / "lib" / "forge-std", dirs_exist_ok=True)
    shutil.copytree(cached / "openzeppelin-contracts", job_dir / "lib" / "openzeppelin-contracts", dirs_exist_ok=True)

    copied = 0
    for contract in contracts:
        if contract.contractType == "script":
            continue
        relative = _safe_relative_path(contract.filePath)
        destination = job_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(contract.code.replace("\r\n", "\n"), encoding="utf-8")
        copied += 1
    if copied == 0:
        raise ValueError("No Solidity sources were written for the Foundry job")
    return job_dir
