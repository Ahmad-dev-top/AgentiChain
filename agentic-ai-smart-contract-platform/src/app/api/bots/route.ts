import { NextResponse } from "next/server";
import { createAutonomousBot } from "@/lib/monitoring-engine";
import { db } from "@/db";
import { monitoringBots } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      const bots = await db.select().from(monitoringBots).where(eq(monitoringBots.projectId, projectId));
      return NextResponse.json({ success: true, bots });
    }

    const bots = await db.select().from(monitoringBots);
    return NextResponse.json({ success: true, bots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { projectId, deploymentId, contractAddress, network, botType, name } = await req.json();

    if (!projectId || !contractAddress || !botType) {
      return NextResponse.json({ success: false, error: "projectId, contractAddress, and botType are required" }, { status: 400 });
    }

    const bot = createAutonomousBot(projectId, deploymentId || "dep-01", contractAddress, network || "Base", botType, name);

    try {
      await db.insert(monitoringBots).values({
        id: bot.id,
        projectId: bot.projectId,
        deploymentId: bot.deploymentId,
        name: bot.name,
        botType: bot.botType,
        contractAddress: bot.contractAddress,
        network: bot.network,
        targetEvent: bot.targetEvent,
        triggerCondition: bot.triggerCondition,
        actionType: bot.actionType,
        status: bot.status,
        eventsCaptured: bot.eventsCaptured,
        alertsFired: bot.alertsFired,
      });
    } catch (err) {
      console.warn("DB insert warning in bot route:", err);
    }

    return NextResponse.json({ success: true, bot });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
