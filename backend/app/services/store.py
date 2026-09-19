from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import ProjectRow
from app.models.schemas import ProjectDetail
from app.services.orchestrator import workflow_to_project

SEED_PROMPTS = [
    {
        "id": "erc4626-yield-vault",
        "prompt": "Create a production-grade ERC4626 Tokenized Yield Vault on Base with a 2% performance fee, virtual shares offset against inflation attacks, emergency pause circuit breaker, and 3-day timelock admin rules.",
        "chain": "Base",
        "name": "AgentiVault4626",
    },
    {
        "id": "liquid-restaking-protocol",
        "prompt": "Architect a Liquid Restaking Token (rsETH) protocol on Ethereum Mainnet with dynamic epoch compounding, multi-operator delegation, and slashing insurance buffer.",
        "chain": "Ethereum",
        "name": "StakeShieldLRT",
    },
    {
        "id": "governor-dao-executive",
        "prompt": "Deploy a Decentralized Governor DAO on Arbitrum One with TimelockController, ERC20Votes token, 4% quorum requirement, 1-week voting period, and emergency veto authority.",
        "chain": "Arbitrum One",
        "name": "AgentiGovernorDAO",
    },
]


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_projects(self) -> list[ProjectDetail]:
        rows = (await self.session.execute(select(ProjectRow).order_by(ProjectRow.created_at.desc()))).scalars().all()
        return [ProjectDetail.model_validate(row.payload) for row in rows]

    async def get_project(self, project_id: str) -> Optional[ProjectDetail]:
        row = await self.session.get(ProjectRow, project_id)
        if row is None:
            return None
        return ProjectDetail.model_validate(row.payload)

    async def save_project(self, project: ProjectDetail) -> ProjectDetail:
        now = datetime.now(timezone.utc)
        project.updatedAt = now.isoformat()
        payload = project.model_dump(mode="json")
        row = await self.session.get(ProjectRow, project.id)
        if row is None:
            self.session.add(ProjectRow(id=project.id, payload=payload, created_at=now, updated_at=now))
        else:
            row.payload = payload
            row.updated_at = now
        await self.session.commit()
        return project

    async def delete_project(self, project_id: str) -> bool:
        row = await self.session.get(ProjectRow, project_id)
        if row is None:
            return False
        await self.session.delete(row)
        await self.session.commit()
        return True

    async def seed_if_empty(self) -> int:
        existing = await self.list_projects()
        if existing:
            return 0
        created = 0
        for item in SEED_PROMPTS:
            project = workflow_to_project(item["prompt"], item["chain"], item["name"], item["id"])
            await self.save_project(project)
            created += 1
        return created
