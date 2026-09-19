import { NextResponse } from "next/server";
import { runFoundrySimulation } from "@/lib/foundry-engine";

export async function POST(req: Request) {
  try {
    const { contractName, networkFork, projectId } = await req.json();

    const sim = runFoundrySimulation(
      contractName || "AgentiContract",
      projectId || "proj-temp",
      networkFork || "Base Mainnet"
    );

    return NextResponse.json({ success: true, simulation: sim });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
