import { NextResponse } from "next/server";
import { getAllProjects, saveProjectDetail, seedDatabaseIfEmpty } from "@/lib/db-actions";
import { ProjectDetail } from "@/lib/types";

export async function GET() {
  try {
    await seedDatabaseIfEmpty();
    const projects = await getAllProjects();
    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: ProjectDetail = await req.json();
    if (!body.id || !body.name) {
      return NextResponse.json({ success: false, error: "Project ID and Name are required" }, { status: 400 });
    }
    await saveProjectDetail(body);
    return NextResponse.json({ success: true, project: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
