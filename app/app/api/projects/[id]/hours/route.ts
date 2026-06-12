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
 * POST /api/projects/:id/hours
 * Body JSON : { "done": 24 } — optionnel : { "total": 86 }
 * Réservé aux projets « En cours » (status demarre).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { done?: unknown; total?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON attendu, ex. { \"done\": 24 }" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const done = typeof body.done === "number" && body.done >= 0 ? Math.round(body.done) : null;
  const total =
    typeof body.total === "number" && body.total > 0 ? Math.round(body.total) : undefined;
  if (done === null && total === undefined) {
    return NextResponse.json(
      { error: "Fournir au moins { done: number ≥ 0 } ou { total: number > 0 }" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const sb = adminClient();
  const { data: existing, error: readError } = await sb
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500, headers: CORS_HEADERS });
  }
  if (!existing) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404, headers: CORS_HEADERS });
  }
  if (existing.status !== "demarre") {
    return NextResponse.json(
      { error: `Le projet n'est pas « En cours » (status: ${existing.status}) — heures verrouillées` },
      { status: 409, headers: CORS_HEADERS },
    );
  }

  const patch: Record<string, number> = {};
  if (done !== null) patch.hours_done = done;
  if (total !== undefined) patch.hours_total = total;

  const [{ data, error }, people] = await Promise.all([
    sb.from("projects").update(patch).eq("id", id).select(PROJECT_COLUMNS).single(),
    loadPeopleNames(sb),
  ]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
  return NextResponse.json(shapeProject(data, people), { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
