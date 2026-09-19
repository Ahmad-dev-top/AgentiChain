import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, contracts, agentTraces, securityAudits, vulnerabilities, simulations, deployments, monitoringBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PRESET_TEMPLATES } from "@/lib/preset-templates";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const p = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

    if (p.length === 0) {
      const preset = PRESET_TEMPLATES.find((t) => t.id === id);
      if (preset) {
        return NextResponse.json({ success: true, project: preset });
      }
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const cList = await db.select().from(contracts).where(eq(contracts.projectId, id));
    const tracesList = await db.select().from(agentTraces).where(eq(agentTraces.projectId, id));
    const auditList = await db.select().from(securityAudits).where(eq(securityAudits.projectId, id)).limit(1);
    const simList = await db.select().from(simulations).where(eq(simulations.projectId, id)).limit(1);
    const depList = await db.select().from(deployments).where(eq(deployments.projectId, id)).limit(1);
    const botList = await db.select().from(monitoringBots).where(eq(monitoringBots.projectId, id));

    let auditWithVulns: any = undefined;
    if (auditList.length > 0) {
      const vulns = await db.select().from(vulnerabilities).where(eq(vulnerabilities.auditId, auditList[0].id));
      auditWithVulns = {
        ...auditList[0],
        vulnerabilities: vulns.map((v) => ({ ...v, lineNumbers: (v.lineNumbers as number[]) || [] })),
      };
    }

    const projectData = {
      id: p[0].id,
      name: p[0].name,
      description: p[0].description,
      contractStandard: p[0].contractStandard,
      targetChain: p[0].targetChain,
      solidityVersion: p[0].solidityVersion,
      status: p[0].status,
      specJson: p[0].specJson,
      contracts: cList,
      audit: auditWithVulns,
      simulation: simList[0] || undefined,
      deployment: depList[0] || undefined,
      bots: botList,
      traces: tracesList,
      createdAt: p[0].createdAt.toISOString(),
      updatedAt: p[0].updatedAt.toISOString(),
    };

    return NextResponse.json({ success: true, project: projectData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ success: true, message: `Project ${id} deleted` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
