import { NextResponse } from "next/server";
import {
  adminClient,
  CORS_HEADERS,
  loadPeopleNames,
  PROJECT_COLUMNS,
  shapeProject,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects        → tous les projets
 * GET /api/projects?status=demarre|devise|termine|archive → filtrés
 */
export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  const sb = adminClient();
  let query = sb.from("projects").select(PROJECT_COLUMNS).order("start_date");
  if (status) query = query.eq("status", status);
  const [{ data, error }, people] = await Promise.all([query, loadPeopleNames(sb)]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
  return NextResponse.json(
    { count: data.length, projects: data.map((row) => shapeProject(row, people)) },
    { headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
