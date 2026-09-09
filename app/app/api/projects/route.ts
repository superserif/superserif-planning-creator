import { NextResponse } from "next/server";
import {
  adminClient,
  CORS_HEADERS,
  loadPeopleNames,
  PROJECT_COLUMNS,
  PROJECT_STATUSES,
  shapeProject,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects        → tous les projets
 * GET /api/projects?status=demarre|devise|termine|archive → filtrés
 * GET /api/projects?person_id=<uuid> → projets où la personne est assignée
 * Les deux filtres se combinent (ex. ?status=demarre&person_id=…).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const personId = params.get("person_id");
  if (status && !(PROJECT_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: `status inconnu : ${status} (attendu : ${PROJECT_STATUSES.join(" | ")})` },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  const sb = adminClient();
  let query = sb.from("projects").select(PROJECT_COLUMNS).order("start_date");
  if (status) query = query.eq("status", status);
  if (personId) query = query.contains("assignees", [personId]);
  const [{ data, error }, people] = await Promise.all([query, loadPeopleNames(sb)]);
  if (error) {
    // 22P02 = uuid mal formé (person_id invalide) → erreur client, pas serveur
    const badInput = error.code === "22P02";
    return NextResponse.json(
      { error: badInput ? `person_id invalide : ${personId}` : error.message },
      { status: badInput ? 400 : 500, headers: CORS_HEADERS },
    );
  }
  return NextResponse.json(
    { count: data.length, projects: data.map((row) => shapeProject(row, people)) },
    { headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
