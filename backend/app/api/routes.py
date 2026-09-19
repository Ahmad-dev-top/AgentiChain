from __future__ import annotations

import asyncio
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db import SessionLocal
from app.models.schemas import (
    AgentPipelineRequest,
    AuditRequest,
    CreateBotRequest,
    DeployRequest,
    ParseIntentRequest,
    ProjectDetail,
    SimulateRequest,
)
from app.services.deploy import generate_verification_payload, simulate_chain_deployment
from app.services.foundry import run_foundry_simulation
from app.services.intent import parse_natural_language_intent
from app.services.monitoring import create_autonomous_bot
from app.services.orchestrator import workflow_to_project
from app.services.security import analyze_solidity_code, auto_patch_contract
from app.services.store import ProjectRepository
from app.services.toolchain import toolchain_status

router = APIRouter()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def ok(payload: dict) -> dict:
    return {"success": True, **payload}


@router.get("/health")
async def health(session: SessionDep) -> dict:
    try:
        await session.execute(text("select 1"))
        db_ok = True
    except Exception:
        db_ok = False
    tools = {name: status.__dict__ for name, status in toolchain_status().items()}
    return {
        "ok": db_ok,
        "service": "agentichain-fastapi",
        "version": "0.3.0",
        "dependencies": {
            "database": "ok" if db_ok else "error",
            "foundry": tools["foundry"]["status"],
            "anvil": tools["anvil"]["status"],
            "slither": tools["slither"]["status"],
        },
        "toolchain": tools,
        "note": "Foundry simulation is live when forge is available. Slither, wallet auth, Redis, and Oracle Cloud are not implemented yet.",
    }


@router.get("/projects")
async def list_projects(session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    await repo.seed_if_empty()
    projects = await repo.list_projects()
    return ok({"projects": [item.model_dump(mode="json") for item in projects]})


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
    return ok({"project": project.model_dump(mode="json")})


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    deleted = await repo.delete_project(project_id)
    if not deleted:
        raise ApiError("Project not found", 404, "not_found")
    return ok({"deleted": project_id})


@router.post("/parse-intent")
async def parse_intent(body: ParseIntentRequest) -> dict:
    result = parse_natural_language_intent(body.prompt, body.targetChain, body.contractName)
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
async def audit(body: AuditRequest) -> dict:
    report = analyze_solidity_code(body.code, body.filePath, body.projectId or "proj-temp")
    patched_code = body.code
    patch_log: list[str] = []
    if body.autoPatch:
        patch_result = auto_patch_contract(body.code, report.vulnerabilities)
        patched_code = patch_result["patchedCode"]
        patch_log = patch_result["patchLog"]
        report = analyze_solidity_code(patched_code, body.filePath, body.projectId or "proj-temp")
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
async def deploy(body: DeployRequest, session: SessionDep) -> dict:
    deployment = simulate_chain_deployment(body.projectId, body.contractName, body.network, body.constructorArgs)
    verification = generate_verification_payload(body.contractName, body.code or "")
    repo = ProjectRepository(session)
    project = await repo.get_project(body.projectId)
    if project is not None:
        project.deployment = deployment
        project.status = "deployed"
        await repo.save_project(project)
    return ok({"deployment": deployment.model_dump(mode="json"), "verificationPayload": verification})


@router.get("/bots")
async def list_bots(session: SessionDep, projectId: str | None = None) -> dict:
    repo = ProjectRepository(session)
    projects = await repo.list_projects()
    bots = []
    for project in projects:
        if projectId and project.id != projectId:
            continue
        bots.extend([bot.model_dump(mode="json") for bot in project.bots])
    return ok({"bots": bots})


@router.post("/bots")
async def create_bot(body: CreateBotRequest, session: SessionDep) -> dict:
    bot = create_autonomous_bot(
        body.projectId,
        body.deploymentId or "dep-01",
        body.contractAddress,
        body.network,
        body.botType,
        body.name,
    )
    repo = ProjectRepository(session)
    project = await repo.get_project(body.projectId)
    if project is not None:
        project.bots = [bot, *project.bots]
        await repo.save_project(project)
    return ok({"bot": bot.model_dump(mode="json")})


@router.post("/seed")
async def seed(session: SessionDep) -> dict:
    repo = ProjectRepository(session)
    created = await repo.seed_if_empty()
    return ok({"count": created, "message": "Presets successfully seeded" if created else "Database already contained projects"})


@router.get("/chains")
async def chains() -> dict:
    from app.services.deploy import CHAINS

    return ok({"chains": [{"name": name, **meta} for name, meta in CHAINS.items()]})
