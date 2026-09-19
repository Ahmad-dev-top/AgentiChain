import { NextResponse } from "next/server";
import { analyzeSolidityCode, autoPatchContract } from "@/lib/security-engine";

export async function POST(req: Request) {
  try {
    const { code, filePath, autoPatch } = await req.json();

    if (!code) {
      return NextResponse.json({ success: false, error: "Code content is required" }, { status: 400 });
    }

    const auditReport = analyzeSolidityCode(code, filePath || "src/Contract.sol");

    let patchedCode = code;
    let patchLog: string[] = [];

    if (autoPatch) {
      const patchResult = autoPatchContract(code, auditReport.vulnerabilities);
      patchedCode = patchResult.patchedCode;
      patchLog = patchResult.patchLog;

      // Re-evaluate patched code
      const reAudit = analyzeSolidityCode(patchedCode, filePath || "src/Contract.sol");
      return NextResponse.json({
        success: true,
        audit: reAudit,
        originalAudit: auditReport,
        patchedCode,
        patchLog,
      });
    }

    return NextResponse.json({
      success: true,
      audit: auditReport,
      patchedCode,
      patchLog,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
