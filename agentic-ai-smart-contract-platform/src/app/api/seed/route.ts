import { NextResponse } from "next/server";
import { PRESET_TEMPLATES } from "@/lib/preset-templates";
import { saveProjectDetail } from "@/lib/db-actions";

export async function POST() {
  try {
    for (const t of PRESET_TEMPLATES) {
      await saveProjectDetail(t as any);
    }
    return NextResponse.json({ success: true, count: PRESET_TEMPLATES.length, message: "Presets successfully seeded" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
