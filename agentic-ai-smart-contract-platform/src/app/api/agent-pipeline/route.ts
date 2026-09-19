import { NextResponse } from "next/server";
import { orchestrateMultiAgentWorkflow } from "@/lib/agents-orchestrator";
import { saveProjectDetail } from "@/lib/db-actions";
import { ProjectDetail } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { prompt, targetChain, contractName, projectId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: "Prompt is required" }, { status: 400 });
    }

    const workflowResult = orchestrateMultiAgentWorkflow(prompt, targetChain || "Base", contractName);
    const pid = projectId || `proj-${Date.now()}`;

    const newProject: ProjectDetail = {
      id: pid,
      name: workflowResult.spec.name,
      description: prompt,
      contractStandard: workflowResult.spec.standard,
      targetChain: workflowResult.spec.targetChain,
      solidityVersion: workflowResult.spec.solidityVersion,
      status: "synthesized",
      specJson: workflowResult.spec,
      contracts: workflowResult.contracts.map((c) => ({ ...c, projectId: pid })),
      audit: { ...workflowResult.auditReport, projectId: pid },
      simulation: { ...workflowResult.simulationResult, projectId: pid },
      bots: [],
      traces: workflowResult.traces,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to DB
    await saveProjectDetail(newProject);

    return NextResponse.json({
      success: true,
      project: newProject,
      workflow: workflowResult,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
