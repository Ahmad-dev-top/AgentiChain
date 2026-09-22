from __future__ import annotations

import asyncio
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends, Header
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ApiError
from app.db import AuthSessionRow, SessionLocal
from app.models.schemas import (
    AgentPipelineRequest,
    AuditRequest,
    AuthChallengeRequest,
    AuthVerifyRequest,
    CreateBotRequest,
    DeployRequest,
    ParseIntentRequest,
    ProbeBotsRequest,
    ProjectDetail,
    SimulateRequest,
    VerifyRequest,
)
from app.services.auth import create_challenge, resolve_session, revoke_session, sign_in_with_anvil, verify_signature
from app.services.deploy import (
    deploy_to_local_anvil,
    deploy_to_public_network,
    generate_verification_payload,
    verify_existing_deployment,
)
from app.services.foundry import run_foundry_simulation
from app.services.intent import parse_intent_with_planner
from app.services.integrations import integration_status
from app.services.keeper import keeper_hub
from app.services.monitoring import create_autonomous_bot
from app.services.orchestrator import langgraph_status, workflow_to_project
from app.services.security import auto_patch_contract
from app.services.slither_engine import run_live_security_audit
from app.services.store import ProjectRepository
from app.services.public_chain import public_broadcast_status
from app.services.telemetry import probe_redis, telemetry_snapshot
from app.services.toolchain import ANVIL_CHAIN_ID, toolchain_status

router = APIRouter()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return None
    return value


async def require_wallet(
    session: SessionDep,
    authorization: Annotated[str | None, Header()] = None,
) -> AuthSessionRow:
    return await resolve_session(session, _bearer_token(authorization))


WalletDep = Annotated[AuthSessionRow, Depends(require_wallet)]


def ok(payload: dict) -> dict:
    return {"success": True, **payload}


@router.post("/auth/challenge")
async def auth_challenge(body: AuthChallengeRequest) -> dict:
    return ok(create_challenge(body.address, body.chainId, body.browser))


@router.post("/auth/verify")
async def auth_verify(body: AuthVerifyRequest, session: SessionDep) -> dict:
    wallet = await verify_signature(session, body.address, body.nonce, body.signature)
    return ok({"session": wallet.model_dump(mode="json")})


@router.post("/auth/anvil")
async def auth_anvil(session: SessionDep) -> dict:
    wallet = await sign_in_with_anvil(session)
    return ok({"session": wallet.model_dump(mode="json")})


@router.get("/auth/me")
async def auth_me(wallet: WalletDep) -> dict:
    return ok(
        {
            "address": wallet.address,
            "chainId": wallet.chain_id,
            "method": wallet.method,
            "expiresAt": wallet.expires_at.isoformat(),
            "note": (
                "Browser wallet session. The private key stays in the wallet."
                if wallet.method == "browser"
                else "Local Anvil session."
            ),
        }
    )


@router.post("/auth/logout")
async def auth_logout(session: SessionDep, authorization: Annotated[str | None, Header()] = None) -> dict:
    await revoke_session(session, _bearer_token(authorization))
    return ok({"loggedOut": True})


@router.get("/health")
async def health(session: SessionDep) -> dict:
    try:
        await session.execute(text("select 1"))
        db_ok = True
    except Exception:
        db_ok = False
    tools = {name: status.__dict__ for name, status in toolchain_status().items()}
    redis = probe_redis()
    return {
        "ok": db_ok,
        "service": "agentichain-fastapi",
        "version": settings.app_version,
        "dependencies": {
            "database": "ok" if db_ok else "error",
            "foundry": tools["foundry"]["status"],
            "anvil": tools["anvil"]["status"],
            "slither": tools["slither"]["status"],
            "keeper": keeper_hub.status,
            "langgraph": langgraph_status()["status"],
            "walletAuth": "ok",
            "telemetry": "live",
            "redis": redis["status"],
            "publicBroadcast": public_broadcast_status()["status"],
        },
        "toolchain": tools,
        "keeper": keeper_hub.status_payload(),
        "note": "Local command center is running.",
    }


@router.get("/integrations")
async def integrations() -> dict:
    return ok(integration_status())


@router.get("/telemetry")
async def telemetry(session: SessionDep) -> dict:
    snapshot = await telemetry_snapshot(session)
    return ok(snapshot)


@router.get("/projects")
async def list_projects(session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    await repo.seed_if_empty()
    projects = await repo.list_projects()
    return ok({"projects": [keeper_hub.overlay_project(item).model_dump(mode="json") for item in projects]})


@router.post("/projects")
async def create_project(body: ProjectDetail, session: SessionDep) -> dict:
    if not body.id or not body.name:
        raise ApiError("Project ID and Name are required", 400)
    repo = ProjectRepository(session)
    saved = await repo.save_project(body)
    return ok({"project": saved.model_dump(mode="json")})


@router.get("/projects/{project_id}")
async def get_project(project_id: str, session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    project = await repo.get_project(project_id)
    if project is None:
        raise ApiError("Project not found", 404, "not_found")
    return ok({"project": keeper_hub.overlay_project(project).model_dump(mode="json")})


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    deleted = await repo.delete_project(project_id)
    if not deleted:
        raise ApiError("Project not found", 404, "not_found")
    return ok({"deleted": project_id})


@router.post("/parse-intent")
async def parse_intent(body: ParseIntentRequest) -> dict:
    result = parse_intent_with_planner(body.prompt, body.targetChain, body.contractName)
    spec = result["spec"].model_dump(mode="json")
    return ok({"result": {**result, "spec": spec}})


@router.post("/agent-pipeline")
async def agent_pipeline(body: AgentPipelineRequest, session: SessionDep) -> dict:
    project = await asyncio.to_thread(
        workflow_to_project,
        body.prompt,
        body.targetChain,
        body.contractName,
        body.projectId,
    )
    repo = ProjectRepository(session)
    await repo.save_project(project)
    return ok({"project": project.model_dump(mode="json")})


@router.post("/audit")
async def audit(body: AuditRequest, session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    contracts = []
    if body.projectId:
        project = await repo.get_project(body.projectId)
        if project is not None:
            contracts = project.contracts
    report = await asyncio.to_thread(
        run_live_security_audit,
        contracts,
        body.projectId or "proj-temp",
        body.code,
        body.filePath,
    )
    patched_code = body.code
    patch_log: list[str] = []
    if body.autoPatch:
        patch_result = auto_patch_contract(body.code, report.vulnerabilities)
        patched_code = patch_result["patchedCode"]
        patch_log = patch_result["patchLog"]
        report = await asyncio.to_thread(
            run_live_security_audit,
            contracts,
            body.projectId or "proj-temp",
            patched_code,
            body.filePath,
        )
    return ok({"audit": report.model_dump(mode="json"), "patchedCode": patched_code, "patchLog": patch_log})


@router.post("/simulate")
async def simulate(body: SimulateRequest, session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    project = await repo.get_project(body.projectId)
    if project is None or not project.contracts:
        raise ApiError("A saved project with Solidity files is required for live Foundry simulation", 400, "missing_contracts")
    simulation = await asyncio.to_thread(
        run_foundry_simulation,
        body.contractName or project.name,
        project.id,
        body.networkFork,
        project.contracts,
    )
    project.simulation = simulation
    await repo.save_project(project)
    return ok({"simulation": simulation.model_dump(mode="json")})


@router.post("/deploy")
async def deploy(body: DeployRequest, session: SessionDep, wallet: WalletDep) -> dict:
    repo = ProjectRepository(session)
    project = await repo.get_project(body.projectId)
    if project is None or not project.contracts:
        raise ApiError("A saved project with Solidity files is required to deploy", 400, "missing_contracts")
    core = next((item for item in project.contracts if item.contractType == "core"), project.contracts[0])
    verification = generate_verification_payload(body.contractName, body.code or core.code)
    deployer = deploy_to_public_network if body.broadcastPublic else deploy_to_local_anvil
    deployment = await asyncio.to_thread(
        deployer,
        body.projectId,
        body.contractName,
        body.network,
        project.contracts,
        body.constructorArgs,
    )
    project.deployment = deployment
    project.status = "deployed"
    await repo.save_project(project)
    verification.update(
        {
            "explorerSubmitted": bool(deployment.chainId != ANVIL_CHAIN_ID and deployment.verificationNote),
            "status": deployment.verificationStatus,
            "engine": deployment.verificationEngine,
            "verificationNote": deployment.verificationNote,
        }
    )
    return ok({"deployment": deployment.model_dump(mode="json"), "verificationPayload": verification})


@router.post("/verify")
async def verify(body: VerifyRequest, session: SessionDep, wallet: WalletDep) -> dict:
    repo = ProjectRepository(session)
    project = await repo.get_project(body.projectId)
    if project is None or not project.contracts or project.deployment is None:
        raise ApiError("A saved project with a deployment is required for verification", 400, "missing_deployment")
    deployment, payload = await asyncio.to_thread(
        verify_existing_deployment,
        project.id,
        body.contractName or project.deployment.contractName,
        project.contracts,
        project.deployment,
    )
    project.deployment = deployment
    await repo.save_project(project)
    return ok({"deployment": deployment.model_dump(mode="json"), "verificationPayload": payload})


@router.get("/bots")
async def list_bots(session: SessionDep, projectId: str | None = None) -> dict:
    repo = ProjectRepository(session)
    projects = await repo.list_projects()
    bots = []
    for project in projects:
        if projectId and project.id != projectId:
            continue
        bots.extend([keeper_hub.merge(bot).model_dump(mode="json") for bot in project.bots])
    return ok({"bots": bots, "keeper": keeper_hub.status_payload()})


@router.post("/bots")
async def create_bot(body: CreateBotRequest, session: SessionDep, wallet: WalletDep) -> dict:
    repo = ProjectRepository(session)
    project = await repo.get_project(body.projectId)
    if project is not None and project.deployment is not None and int(project.deployment.chainId) != ANVIL_CHAIN_ID:
        raise ApiError(
            "Keepers watch local Anvil only. Public-network deployments are not attached.",
            400,
            "public_keeper_blocked",
        )
    bot = create_autonomous_bot(
        body.projectId,
        body.deploymentId or "dep-01",
        body.contractAddress,
        body.network,
        body.botType,
        body.name,
    )
    if project is not None:
        project.bots = [bot, *project.bots]
        await repo.save_project(project)
    live = keeper_hub.register(bot)
    return ok({"bot": live.model_dump(mode="json")})


@router.post("/bots/probe")
async def probe_bots(body: ProbeBotsRequest, session: SessionDep, wallet: WalletDep) -> dict:
    repo = ProjectRepository(session)
    project = await repo.get_project(body.projectId)
    if project is None or project.deployment is None:
        raise ApiError("A local Anvil deployment is required before probing keepers", 400, "missing_deployment")
    if not project.bots:
        raise ApiError("Create a keeper bot before sending a local probe", 400, "missing_keeper")
    for bot in project.bots:
        if not bot.contractAddress:
            bot.contractAddress = project.deployment.contractAddress
        keeper_hub.register(bot)
    tx_hash, _ = await keeper_hub.probe(body.projectId)
    project.bots = [keeper_hub.merge(bot) for bot in project.bots]
    await repo.save_project(project)
    return ok(
        {
            "transactionHash": tx_hash,
            "bots": [bot.model_dump(mode="json") for bot in project.bots],
            "note": "Probe pause/unpause was broadcast to local Anvil only.",
        }
    )


@router.post("/seed")
async def seed(session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    created = await repo.seed_if_empty()
    return ok({"count": created, "message": "Presets successfully seeded" if created else "Database already contained projects"})


@router.get("/chains")
async def chains() -> dict:
    from app.services.networks import CHAINS

    return ok(
        {
            "chains": [
                {
                    "name": name,
                    "chainId": meta["chainId"],
                    "explorerUrl": meta["explorerUrl"],
                    "nativeCurrency": meta["nativeCurrency"],
                }
                for name, meta in CHAINS.items()
            ]
        }
    )
