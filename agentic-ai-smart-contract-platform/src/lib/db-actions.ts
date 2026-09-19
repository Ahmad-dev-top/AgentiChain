import { db } from "@/db";
import { projects, contracts, agentSessions, agentTraces, securityAudits, vulnerabilities, simulations, deployments, monitoringBots } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { PRESET_TEMPLATES } from "./preset-templates";
import { ProjectDetail } from "./types";

export async function seedDatabaseIfEmpty() {
  try {
    const existing = await db.select().from(projects).limit(1);
    if (existing.length === 0) {
      console.log("Seeding database with AgentiChain preset protocols...");
      for (const t of PRESET_TEMPLATES) {
        await saveProjectDetail(t as any);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn("DB seed check warning (falling back to memory if DB not initialized yet):", err);
    return false;
  }
}

export async function getAllProjects(): Promise<ProjectDetail[]> {
  try {
    const pList = await db.select().from(projects).orderBy(desc(projects.createdAt));
    if (pList.length === 0) {
      return PRESET_TEMPLATES as any;
    }

    const results: ProjectDetail[] = [];
    for (const p of pList) {
      const cList = await db.select().from(contracts).where(eq(contracts.projectId, p.id));
      const tracesList = await db.select().from(agentTraces).where(eq(agentTraces.projectId, p.id));
      const auditList = await db.select().from(securityAudits).where(eq(securityAudits.projectId, p.id)).limit(1);
      const simList = await db.select().from(simulations).where(eq(simulations.projectId, p.id)).limit(1);
      const depList = await db.select().from(deployments).where(eq(deployments.projectId, p.id)).limit(1);
      const botList = await db.select().from(monitoringBots).where(eq(monitoringBots.projectId, p.id));

      let auditWithVulns: any = undefined;
      if (auditList.length > 0) {
        const vulns = await db.select().from(vulnerabilities).where(eq(vulnerabilities.auditId, auditList[0].id));
        auditWithVulns = {
          ...auditList[0],
          vulnerabilities: vulns.map((v) => ({
            ...v,
            lineNumbers: (v.lineNumbers as number[]) || [],
          })),
        };
      }

      results.push({
        id: p.id,
        name: p.name,
        description: p.description,
        contractStandard: p.contractStandard as any,
        targetChain: p.targetChain as any,
        solidityVersion: p.solidityVersion,
        status: p.status,
        specJson: (p.specJson as any) || (PRESET_TEMPLATES[0].spec as any),
        contracts: cList.map((c) => ({
          id: c.id,
          projectId: c.projectId,
          name: c.name,
          filePath: c.filePath,
          contractType: c.contractType as any,
          code: c.code,
          version: c.version,
          abi: c.abi as any,
          bytecode: c.bytecode || undefined,
          astJson: c.astJson || undefined,
        })),
        audit: auditWithVulns,
        simulation: simList.length > 0 ? (simList[0] as any) : undefined,
        deployment: depList.length > 0 ? (depList[0] as any) : undefined,
        bots: botList.map((b) => ({
          id: b.id,
          projectId: b.projectId,
          deploymentId: b.deploymentId || undefined,
          name: b.name,
          botType: b.botType as any,
          contractAddress: b.contractAddress,
          network: b.network,
          targetEvent: b.targetEvent,
          triggerCondition: b.triggerCondition,
          actionType: b.actionType as any,
          status: b.status as any,
          lastCheckedAt: b.lastCheckedAt.toISOString(),
          eventsCaptured: b.eventsCaptured,
          alertsFired: b.alertsFired,
          logs: [],
          createdAt: b.createdAt.toISOString(),
        })),
        traces: tracesList.map((t) => ({
          id: t.id,
          agentName: t.agentName as any,
          agentRole: t.agentRole,
          action: t.action,
          thought: t.thought,
          inputPayload: t.inputPayload,
          outputPayload: t.outputPayload,
          status: t.status as any,
          tokensUsed: t.tokensUsed,
          latencyMs: t.latencyMs,
          createdAt: t.createdAt.toISOString(),
        })),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
    }

    return results;
  } catch (err) {
    console.warn("Falling back to preset templates due to DB query error:", err);
    return PRESET_TEMPLATES as any;
  }
}

export async function saveProjectDetail(data: ProjectDetail) {
  try {
    // 1. Insert or update project
    await db
      .insert(projects)
      .values({
        id: data.id,
        name: data.name,
        description: data.description,
        contractStandard: data.contractStandard,
        targetChain: data.targetChain,
        solidityVersion: data.solidityVersion || "0.8.24",
        status: data.status || "ready",
        specJson: data.specJson as any,
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name: data.name,
          description: data.description,
          contractStandard: data.contractStandard,
          targetChain: data.targetChain,
          status: data.status,
          specJson: data.specJson as any,
          updatedAt: new Date(),
        },
      });

    // 2. Insert contracts
    if (data.contracts && data.contracts.length > 0) {
      for (const c of data.contracts) {
        await db
          .insert(contracts)
          .values({
            id: c.id || `c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            projectId: data.id,
            name: c.name,
            filePath: c.filePath,
            contractType: c.contractType || "core",
            code: c.code,
            version: c.version || 1,
          })
          .onConflictDoUpdate({
            target: contracts.id,
            set: {
              code: c.code,
              name: c.name,
              filePath: c.filePath,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 3. Insert agent traces
    if (data.traces && data.traces.length > 0) {
      // First ensure an agent session exists
      const sessionId = `sess-${data.id}`;
      await db
        .insert(agentSessions)
        .values({
          id: sessionId,
          projectId: data.id,
          sessionName: `${data.name} Synthesis Session`,
          currentStage: "completed",
          status: "completed",
        })
        .onConflictDoNothing();

      for (const t of data.traces) {
        await db
          .insert(agentTraces)
          .values({
            id: t.id || `tr-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            sessionId,
            projectId: data.id,
            agentName: t.agentName,
            agentRole: t.agentRole,
            action: t.action,
            thought: t.thought,
            inputPayload: t.inputPayload,
            outputPayload: t.outputPayload,
            status: t.status,
            tokensUsed: t.tokensUsed,
            latencyMs: t.latencyMs,
          })
          .onConflictDoNothing();
      }
    }

    // 4. Insert Audit
    if (data.audit) {
      await db
        .insert(securityAudits)
        .values({
          id: data.audit.id || `aud-${Date.now()}`,
          projectId: data.id,
          totalIssues: data.audit.totalIssues,
          criticalCount: data.audit.criticalCount,
          highCount: data.audit.highCount,
          mediumCount: data.audit.mediumCount,
          lowCount: data.audit.lowCount,
          infoCount: data.audit.infoCount,
          gasCount: data.audit.gasCount,
          securityScore: data.audit.securityScore,
          auditReportMd: data.audit.auditReportMd,
          isPatched: data.audit.isPatched,
        })
        .onConflictDoUpdate({
          target: securityAudits.id,
          set: {
            securityScore: data.audit.securityScore,
            isPatched: data.audit.isPatched,
            totalIssues: data.audit.totalIssues,
          },
        });

      if (data.audit.vulnerabilities && data.audit.vulnerabilities.length > 0) {
        for (const v of data.audit.vulnerabilities) {
          await db
            .insert(vulnerabilities)
            .values({
            id: v.id || `v-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            auditId: data.audit.id,
            title: v.title,
            detectorId: v.detectorId,
            severity: v.severity,
            cwe: v.cwe,
            swcId: v.swcId,
            filePath: v.filePath,
            lineNumbers: v.lineNumbers,
            description: v.description,
            impact: v.impact,
            recommendation: v.recommendation,
            patchDiff: v.patchDiff,
            status: v.status,
          })
          .onConflictDoNothing();
        }
      }
    }

    // 5. Insert Simulation
    if (data.simulation) {
      await db
        .insert(simulations)
        .values({
          id: data.simulation.id || `sim-${Date.now()}`,
          projectId: data.id,
          simType: data.simulation.simType,
          networkFork: data.simulation.networkFork,
          blockNumber: data.simulation.blockNumber,
          totalTests: data.simulation.totalTests,
          passedTests: data.simulation.passedTests,
          failedTests: data.simulation.failedTests,
          durationMs: data.simulation.durationMs,
          gasReport: { benchmarks: data.simulation.gasBenchmarks } as any,
          traceLogs: data.simulation.traceLogs as any,
          status: data.simulation.status,
        })
        .onConflictDoNothing();
    }

    // 6. Insert Deployment
    if (data.deployment) {
      await db
        .insert(deployments)
        .values({
          id: data.deployment.id || `dep-${Date.now()}`,
          projectId: data.id,
          contractName: data.deployment.contractName,
          network: data.deployment.network,
          chainId: data.deployment.chainId,
          contractAddress: data.deployment.contractAddress,
          deployerAddress: data.deployment.deployerAddress,
          transactionHash: data.deployment.transactionHash,
          blockNumber: data.deployment.blockNumber,
          gasUsed: data.deployment.gasUsed,
          verificationStatus: data.deployment.verificationStatus,
          explorerUrl: data.deployment.explorerUrl,
          constructorArgs: data.deployment.constructorArgs,
        })
        .onConflictDoNothing();
    }

    // 7. Insert Bots
    if (data.bots && data.bots.length > 0) {
      for (const b of data.bots) {
        await db
          .insert(monitoringBots)
          .values({
            id: b.id || `bot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            projectId: data.id,
            deploymentId: b.deploymentId,
            name: b.name,
            botType: b.botType,
            contractAddress: b.contractAddress,
            network: b.network,
            targetEvent: b.targetEvent,
            triggerCondition: b.triggerCondition,
            actionType: b.actionType,
            status: b.status,
            eventsCaptured: b.eventsCaptured,
            alertsFired: b.alertsFired,
          })
          .onConflictDoNothing();
      }
    }
  } catch (err) {
    console.error("Error saving project to DB:", err);
  }
}
