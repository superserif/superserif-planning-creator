import { NextResponse } from "next/server";
import {
  adminClient,
  CORS_HEADERS,
  loadPeopleNames,
  PROJECT_COLUMNS,
  shapeProject,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/projects/:id → un projet */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = adminClient();
  const [{ data, error }, people] = await Promise.all([
    sb.from("projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle(),
    loadPeopleNames(sb),
  ]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
  if (!data) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json(shapeProject(data, people), { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
