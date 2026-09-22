from datetime import datetime, timezone
from pathlib import Path
import shutil
import time
import uuid

from app.core.config import settings
from app.core.errors import ApiError
from app.models.schemas import ContractFile, DeploymentRecord, SupportedChain
from app.services.explorer import maybe_submit_explorer
from app.services.foundry_project import materialize_foundry_project
from app.services.networks import CHAINS
from app.services.public_chain import (
    assert_public_broadcast_allowed,
    assert_public_rpc_for_chain,
    public_deployer_address,
    public_deployer_key,
)
from app.services.toolchain import (
    ANVIL_CHAIN_ID,
    ANVIL_DEPLOYER,
    ANVIL_RPC,
    compare_runtime_bytecode,
    ensure_anvil,
    load_foundry_artifact,
    rpc_block_number,
    rpc_code,
    rpc_receipt,
    run_forge,
    run_forge_create,
    run_forge_create_public,
    run_forge_verify_bytecode,
)

MOCK_ASSET = '''// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DeployMockAsset is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}
}
'''


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_verification_payload(contract_name: str, solidity_code: str, compiler_version: str = "v0.8.24+commit.e11b9ed9") -> dict:
    from app.services.explorer import explorer_status

    explorer = explorer_status()
    return {
        "language": "Solidity",
        "sources": {f"src/{contract_name}.sol": {"content": solidity_code}},
        "settings": {
            "optimizer": {"enabled": True, "runs": 200},
            "evmVersion": "cancun",
            "outputSelection": {"*": {"*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]}},
        },
        "compilerVersion": compiler_version,
        "explorerSubmitted": False,
        "explorer": explorer,
        "note": "Standard JSON is kept for a public explorer. Live verification matches runtime bytecode on the selected RPC.",
    }


def _core_contract(contracts: list[ContractFile]) -> ContractFile:
    for item in contracts:
        if item.contractType == "core":
            return item
    if contracts:
        return contracts[0]
    raise ApiError("A core Solidity file is required to deploy", 400, "missing_contracts")


def _is_vault(code: str) -> bool:
    return "ERC4626" in code


def _artifact(core: ContractFile, contract_name: str) -> str:
    return f"src/{Path(core.filePath).name}:{contract_name}"


def _with_mock_if_needed(project_id: str, contracts: list[ContractFile]) -> tuple[ContractFile, list[ContractFile]]:
    core = _core_contract(contracts)
    sources = list(contracts)
    if _is_vault(core.code) and not any(item.name == "DeployMockAsset.sol" for item in sources):
        sources.append(
            ContractFile(
                id="c-mock-asset",
                projectId=project_id,
                name="DeployMockAsset.sol",
                filePath="src/mocks/DeployMockAsset.sol",
                contractType="library",
                version=1,
                code=MOCK_ASSET,
            )
        )
    return core, sources


def _constructor_arg_list(contract_name: str, constructor_args, is_vault: bool) -> list[str]:
    if isinstance(constructor_args, list):
        return [str(item) for item in constructor_args]
    if isinstance(constructor_args, dict):
        if is_vault and constructor_args.get("asset"):
            admin = str(constructor_args.get("admin") or ANVIL_DEPLOYER)
            return [
                str(constructor_args["asset"]),
                contract_name,
                str(constructor_args.get("symbol") or "aVLT"),
                admin,
                str(constructor_args.get("feeRecipient") or admin),
                str(constructor_args.get("feeBps") or "200"),
            ]
        if constructor_args.get("initialOwner"):
            return [str(constructor_args["initialOwner"])]
        if constructor_args.get("values") and isinstance(constructor_args["values"], list):
            return [str(item) for item in constructor_args["values"]]
    return [ANVIL_DEPLOYER] if not is_vault else []


def _wait_for_code(address: str, rpc_url: str | None = None, attempts: int = 40) -> str:
    onchain = "0x"
    for _ in range(max(attempts, 1)):
        try:
            onchain = rpc_code(address, rpc_url)
        except Exception:
            onchain = "0x"
        if onchain and onchain not in {"0x", "0x0"}:
            return onchain
        time.sleep(1.5)
    return onchain


def verify_runtime_on_rpc(
    job_dir: Path,
    artifact: str,
    address: str,
    rpc_url: str,
    chain_id: int,
    network_label: str,
    constructor_args: list[str] | None = None,
) -> dict:
    local = chain_id == ANVIL_CHAIN_ID
    engine = "local_bytecode" if local else "runtime_bytecode"
    onchain = _wait_for_code(address, None if local else rpc_url, 8 if local else 40)
    if not onchain or onchain in {"0x", "0x0"}:
        return {
            "status": "failed",
            "engine": engine,
            "matched": False,
            "onChainBytes": 0,
            "forgeVerified": False,
            "explorerSubmitted": False,
            "note": f"No bytecode at {address} on {network_label} (chainId {chain_id}).",
        }
    artifact_json = None
    try:
        artifact_json = load_foundry_artifact(job_dir, artifact)
    except ApiError:
        built = run_forge(["build"], job_dir)
        if built.returncode != 0:
            return {
                "status": "failed",
                "engine": engine,
                "matched": False,
                "onChainBytes": max((len(onchain) - 2) // 2, 0),
                "forgeVerified": False,
                "explorerSubmitted": False,
                "note": f"forge build failed while preparing verification on {network_label}.",
            }
        artifact_json = load_foundry_artifact(job_dir, artifact)
    compared = compare_runtime_bytecode(onchain, artifact_json)
    forge_verified = False
    if not compared["matched"]:
        try:
            forge_result = run_forge_verify_bytecode(
                job_dir,
                artifact,
                address,
                constructor_args,
                rpc_url=None if local else rpc_url,
                chain_id=chain_id,
            )
            forge_verified = bool(forge_result.get("ok"))
        except Exception:
            forge_verified = False
    matched = bool(compared["matched"] or forge_verified)
    compiler = None
    metadata = artifact_json.get("metadata")
    if isinstance(metadata, dict):
        compiler = (metadata.get("compiler") or {}).get("version")
    elif isinstance(metadata, str):
        compiler = "0.8.24"
    return {
        "status": "verified" if matched else "failed",
        "engine": engine,
        "matched": matched,
        "fullMatch": compared["fullMatch"],
        "onChainBytes": compared["onChainBytes"],
        "artifactBytes": compared["artifactBytes"],
        "forgeVerified": forge_verified,
        "compiler": compiler,
        "explorerSubmitted": False,
        "note": (
            f"Runtime bytecode matched on {network_label} (chainId {chain_id}): {compared['onChainBytes']} bytes."
            if matched
            else (
                f"Runtime bytecode did not match on {network_label} ({compared['onChainBytes']} on-chain vs "
                f"{compared['artifactBytes']} artifact bytes)."
            )
        ),
    }


def verify_runtime_on_anvil(
    job_dir: Path,
    artifact: str,
    address: str,
    constructor_args: list[str] | None = None,
) -> dict:
    ensure_anvil()
    return verify_runtime_on_rpc(
        job_dir,
        artifact,
        address,
        ANVIL_RPC,
        ANVIL_CHAIN_ID,
        f"local Anvil ({ANVIL_RPC})",
        constructor_args,
    )


def _record(
    project_id: str,
    contract_name: str,
    network: SupportedChain,
    payload: dict,
    constructor_args,
    verification: dict | None = None,
    *,
    chain_id: int = ANVIL_CHAIN_ID,
    explorer_url: str | None = None,
    rpc_url: str | None = None,
    deployment_target: str = "local_anvil",
    engine: str = "anvil+forge",
) -> DeploymentRecord:
    tx_hash = str(payload.get("transactionHash") or "")
    receipt: dict = {}
    if tx_hash:
        attempts = 20 if rpc_url else 1
        for _ in range(attempts):
            try:
                receipt = rpc_receipt(tx_hash, rpc_url)
            except Exception:
                receipt = {}
            if receipt.get("blockNumber"):
                break
            if rpc_url:
                time.sleep(1.5)
    gas_used_hex = receipt.get("gasUsed")
    gas_used = str(int(gas_used_hex, 16)) if isinstance(gas_used_hex, str) else str(payload.get("gas") or "unknown")
    block_hex = receipt.get("blockNumber")
    block_number = int(block_hex, 16) if isinstance(block_hex, str) else rpc_block_number(rpc_url)
    address = str(payload.get("deployedTo"))
    verification = verification or {}
    meta = CHAINS.get(network, {})
    target_explorer = explorer_url or (meta.get("explorerUrl") if chain_id != ANVIL_CHAIN_ID else ANVIL_RPC)
    note = verification.get("note")
    if chain_id == ANVIL_CHAIN_ID:
        note = (
            f"Broadcast to local Anvil ({ANVIL_RPC}, chainId {ANVIL_CHAIN_ID}). "
            f"Tagged {network} only as metadata; not submitted to {meta.get('explorerUrl', network)}."
        )
    else:
        note = (
            f"Broadcast to {network} (chainId {chain_id}). "
            f"Explorer: {target_explorer}."
        )
    return DeploymentRecord(
        id=f"dep-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        projectId=project_id,
        contractName=contract_name,
        network=network,
        chainId=chain_id,
        contractAddress=address,
        deployerAddress=str(payload.get("deployer") or ANVIL_DEPLOYER),
        transactionHash=tx_hash,
        blockNumber=block_number,
        gasUsed=gas_used,
        verificationStatus=verification.get("status") or "pending",
        explorerUrl=f"{target_explorer}/address/{address}" if chain_id != ANVIL_CHAIN_ID else str(ANVIL_RPC),
        constructorArgs=constructor_args,
        createdAt=_now(),
        simulated=False,
        live=True,
        engine=engine,
        deploymentTarget=deployment_target,
        verificationEngine=verification.get("engine") or "none",
        verificationNote=verification.get("note"),
        note=note,
    )


def deploy_to_local_anvil(
    project_id: str,
    contract_name: str,
    network: SupportedChain,
    contracts: list[ContractFile],
    _constructor_args=None,
) -> DeploymentRecord:
    ensure_anvil()
    core, sources = _with_mock_if_needed(project_id, contracts)
    job_dir = settings.foundry_jobs_path / f"deploy-{project_id}-{uuid.uuid4().hex[:8]}"
    artifact = _artifact(core, contract_name)
    try:
        materialize_foundry_project(job_dir, sources)
        if _is_vault(core.code):
            mock = run_forge_create(job_dir, "src/mocks/DeployMockAsset.sol:DeployMockAsset")
            asset = str(mock["deployedTo"])
            args = [asset, contract_name, "aVLT", ANVIL_DEPLOYER, ANVIL_DEPLOYER, "200"]
            created = run_forge_create(job_dir, artifact, args)
            verification = verify_runtime_on_anvil(job_dir, artifact, str(created["deployedTo"]), args)
            return _record(
                project_id,
                contract_name,
                network,
                created,
                {"values": args, "asset": asset, "feeBps": 200, "admin": ANVIL_DEPLOYER},
                verification,
            )
        args = [ANVIL_DEPLOYER]
        created = run_forge_create(job_dir, artifact, args)
        verification = verify_runtime_on_anvil(job_dir, artifact, str(created["deployedTo"]), args)
        return _record(project_id, contract_name, network, created, {"values": args, "initialOwner": ANVIL_DEPLOYER}, verification)
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


def _attach_explorer(verification: dict, chain_id: int, address: str, contract_name: str, source_code: str) -> dict:
    explorer = maybe_submit_explorer(chain_id, address, contract_name, source_code)
    verification = dict(verification)
    verification["explorer"] = explorer
    verification["explorerSubmitted"] = bool(explorer.get("submitted"))
    if explorer.get("submitted"):
        verification["note"] = explorer.get("note") or verification.get("note")
    elif chain_id != ANVIL_CHAIN_ID and explorer.get("note"):
        verification["note"] = f"{verification.get('note') or ''} {explorer.get('note')}".strip()
    return verification


def deploy_to_public_network(
    project_id: str,
    contract_name: str,
    network: SupportedChain,
    contracts: list[ContractFile],
    _constructor_args=None,
) -> DeploymentRecord:
    meta = CHAINS.get(network)
    if not meta:
        raise ApiError("Unsupported public network", 400, "unsupported_chain")
    chain_id = int(meta["chainId"])
    rpc = assert_public_broadcast_allowed(chain_id)
    owner = public_deployer_address()
    key = public_deployer_key()
    core, sources = _with_mock_if_needed(project_id, contracts)
    job_dir = settings.foundry_jobs_path / f"deploy-public-{project_id}-{uuid.uuid4().hex[:8]}"
    artifact = _artifact(core, contract_name)
    try:
        materialize_foundry_project(job_dir, sources)
        if _is_vault(core.code):
            mock = run_forge_create_public(job_dir, "src/mocks/DeployMockAsset.sol:DeployMockAsset", None, rpc, chain_id, key)
            asset = str(mock["deployedTo"])
            _wait_for_code(asset, rpc)
            args = [asset, contract_name, "aVLT", owner, owner, "200"]
            created = run_forge_create_public(job_dir, artifact, args, rpc, chain_id, key)
            address = str(created["deployedTo"])
            verification = verify_runtime_on_rpc(job_dir, artifact, address, rpc, chain_id, network, args)
            verification = _attach_explorer(verification, chain_id, address, contract_name, core.code)
            return _record(
                project_id,
                contract_name,
                network,
                created,
                {"values": args, "asset": asset, "feeBps": 200, "admin": owner},
                verification,
                chain_id=chain_id,
                explorer_url=str(meta["explorerUrl"]),
                rpc_url=rpc,
                deployment_target="public_rpc",
                engine="forge+public_rpc",
            )
        args = [owner]
        created = run_forge_create_public(job_dir, artifact, args, rpc, chain_id, key)
        address = str(created["deployedTo"])
        verification = verify_runtime_on_rpc(job_dir, artifact, address, rpc, chain_id, network, args)
        verification = _attach_explorer(verification, chain_id, address, contract_name, core.code)
        return _record(
            project_id,
            contract_name,
            network,
            created,
            {"values": args, "initialOwner": owner},
            verification,
            chain_id=chain_id,
            explorer_url=str(meta["explorerUrl"]),
            rpc_url=rpc,
            deployment_target="public_rpc",
            engine="forge+public_rpc",
        )
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


def verify_existing_deployment(
    project_id: str,
    contract_name: str,
    contracts: list[ContractFile],
    deployment: DeploymentRecord,
) -> tuple[DeploymentRecord, dict]:
    if not deployment.contractAddress:
        raise ApiError("A deployed contract address is required for verification", 400, "missing_deployment")
    core, sources = _with_mock_if_needed(project_id, contracts)
    artifact = _artifact(core, contract_name or deployment.contractName)
    args = _constructor_arg_list(contract_name or deployment.contractName, deployment.constructorArgs, _is_vault(core.code))
    job_dir = settings.foundry_jobs_path / f"verify-{project_id}-{uuid.uuid4().hex[:8]}"
    chain_id = int(deployment.chainId)
    try:
        materialize_foundry_project(job_dir, sources)
        if chain_id == ANVIL_CHAIN_ID:
            verification = verify_runtime_on_anvil(job_dir, artifact, deployment.contractAddress, args or None)
        else:
            rpc = assert_public_rpc_for_chain(chain_id)
            verification = verify_runtime_on_rpc(
                job_dir,
                artifact,
                deployment.contractAddress,
                rpc,
                chain_id,
                deployment.network,
                args or None,
            )
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)
    verification = _attach_explorer(
        verification,
        chain_id,
        deployment.contractAddress,
        contract_name or deployment.contractName,
        core.code,
    )
    updated = deployment.model_copy(
        update={
            "verificationStatus": verification["status"],
            "verificationEngine": verification["engine"],
            "verificationNote": verification["note"],
        }
    )
    payload = generate_verification_payload(contract_name or deployment.contractName, core.code)
    payload.update({k: v for k, v in verification.items() if k != "note"})
    payload["explorerSubmitted"] = bool(verification.get("explorerSubmitted"))
    payload["note"] = verification.get("note")
    return updated, payload
