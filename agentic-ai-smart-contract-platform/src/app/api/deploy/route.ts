import { NextResponse } from "next/server";
import { simulateChainDeployment, generateVerificationPayload } from "@/lib/chain-deployer";
import { db } from "@/db";
import { deployments, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { projectId, contractName, network, constructorArgs, code } = await req.json();

    if (!projectId || !contractName || !network) {
      return NextResponse.json({ success: false, error: "projectId, contractName, and network are required" }, { status: 400 });
    }

    const dep = simulateChainDeployment(projectId, contractName, network, constructorArgs);
    const verificationPayload = generateVerificationPayload(contractName, code || "");

    try {
      await db.insert(deployments).values({
        id: dep.id,
        projectId: dep.projectId,
        contractName: dep.contractName,
        network: dep.network,
        chainId: dep.chainId,
        contractAddress: dep.contractAddress,
        deployerAddress: dep.deployerAddress,
        transactionHash: dep.transactionHash,
        blockNumber: dep.blockNumber,
        gasUsed: dep.gasUsed,
        verificationStatus: dep.verificationStatus,
        explorerUrl: dep.explorerUrl,
        constructorArgs: dep.constructorArgs,
      });

      await db.update(projects).set({ status: "deployed", updatedAt: new Date() }).where(eq(projects.id, projectId));
    } catch (err) {
      console.warn("DB save warning in deploy route:", err);
    }

    return NextResponse.json({
      success: true,
      deployment: dep,
      verificationPayload,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
