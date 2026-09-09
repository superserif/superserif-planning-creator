import { NextResponse } from "next/server";
import {
  adminClient,
  CORS_HEADERS,
  elapsedHours,
  getOpenSession,
  shapeHours,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/current?person_id=<uuid>
 * → { project_id, started_at, hours: { done, total, pct } } si une session tourne
 *   (done inclut le temps écoulé de la session en cours, arrondi à 2 décimales)
 * → { project_id: null, started_at: null, hours: null } sinon
 */
export async function GET(request: Request) {
  const personId = new URL(request.url).searchParams.get("person_id");
  if (!personId) {
    return NextResponse.json(
      { error: "person_id requis, ex. /api/sessions/current?person_id=…" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const sb = adminClient();
  const { data: person, error: personError } = await sb
    .from("people")
    .select("id")
    .eq("id", personId)
    .maybeSingle();
  if (personError) {
    const badUuid = personError.code === "22P02";
    return NextResponse.json(
      { error: badUuid ? `person_id invalide : ${personId}` : personError.message },
      { status: badUuid ? 400 : 500, headers: CORS_HEADERS },
    );
  }
  if (!person) {
    return NextResponse.json({ error: "Personne introuvable" }, { status: 404, headers: CORS_HEADERS });
  }

  const { data: open, error } = await getOpenSession(sb, personId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
  if (!open) {
    return NextResponse.json(
      { project_id: null, started_at: null, hours: null },
      { headers: CORS_HEADERS },
    );
  }

  const { data: project, error: projectError } = await sb
    .from("projects")
    .select("hours_done,hours_total")
    .eq("id", open.project_id)
    .maybeSingle();
  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500, headers: CORS_HEADERS });
  }
  return NextResponse.json(
    {
      project_id: open.project_id,
      started_at: open.started_at,
      hours: shapeHours(
        (project?.hours_done ?? 0) + elapsedHours(open.started_at),
        project?.hours_total ?? null,
      ),
    },
    { headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
