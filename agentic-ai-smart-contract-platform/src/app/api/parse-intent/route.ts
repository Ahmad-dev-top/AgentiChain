import { NextResponse } from "next/server";
import { parseNaturalLanguageIntent } from "@/lib/intent-parser";

export async function POST(req: Request) {
  try {
    const { prompt, targetChain, contractName } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ success: false, error: "Prompt string is required" }, { status: 400 });
    }

    const result = parseNaturalLanguageIntent(prompt, targetChain || "Base", contractName);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
