import { NextResponse } from "next/server";
import {
  adminClient,
  closeSession,
  CORS_HEADERS,
  elapsedHours,
  getOpenSession,
  PROJECT_COLUMNS,
  shapeHours,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/sessions
 * Body JSON : { "person_id", "project_id", "action": "start" | "stop" }
 *
 * Le serveur accumule les heures — les clients ne poussent jamais de total.
 * - start : ouvre une session ; refuse (409) si le projet n'est pas « demarre ».
 *   Une seule session active par personne : start sur un autre projet ferme la
 *   précédente (et crédite son temps). start sur le même projet est idempotent.
 * - stop : ferme la session active, crédite le temps écoulé sur hours.done.
 *   stop sans session active, ou sur le mauvais projet → 409.
 */
export async function POST(request: Request) {
  let body: { person_id?: unknown; project_id?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Body JSON attendu, ex. { "person_id": "…", "project_id": "…", "action": "start" }' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const personId = typeof body.person_id === "string" ? body.person_id : null;
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const action = body.action === "start" || body.action === "stop" ? body.action : null;
  if (!personId || !projectId || !action) {
    return NextResponse.json(
      { error: "Fournir person_id, project_id et action (start | stop)" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const sb = adminClient();
  const [personRes, projectRes] = await Promise.all([
    sb.from("people").select("id,name").eq("id", personId).maybeSingle(),
    sb.from("projects").select(PROJECT_COLUMNS).eq("id", projectId).maybeSingle(),
  ]);
  if (personRes.error || projectRes.error) {
    const message = personRes.error?.message ?? projectRes.error?.message ?? "Erreur";
    const badUuid = personRes.error?.code === "22P02" || projectRes.error?.code === "22P02";
    return NextResponse.json(
      { error: badUuid ? "person_id ou project_id invalide (uuid attendu)" : message },
      { status: badUuid ? 400 : 500, headers: CORS_HEADERS },
    );
  }
  if (!personRes.data) {
    return NextResponse.json({ error: "Personne introuvable" }, { status: 404, headers: CORS_HEADERS });
  }
  const project = projectRes.data;
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404, headers: CORS_HEADERS });
  }

  const { data: open, error: openError } = await getOpenSession(sb, personId);
  if (openError) {
    return NextResponse.json({ error: openError.message }, { status: 500, headers: CORS_HEADERS });
  }

  try {
    if (action === "start") {
      if (project.status !== "demarre") {
        return NextResponse.json(
          { error: `Le projet n'est pas « En cours » (status: ${project.status}) — temps refusé` },
          { status: 409, headers: CORS_HEADERS },
        );
      }
      if (open && open.project_id === projectId) {
        // Déjà en cours sur ce projet : idempotent.
        return NextResponse.json(
          {
            project_id: projectId,
            started_at: open.started_at,
            hours: shapeHours(
              (project.hours_done ?? 0) + elapsedHours(open.started_at),
              project.hours_total ?? null,
            ),
          },
          { headers: CORS_HEADERS },
        );
      }
      if (open) await closeSession(sb, open); // start sur un autre projet arrête le précédent

      const { data: created, error: insertError } = await sb
        .from("work_sessions")
        .insert({ person_id: personId, project_id: projectId })
        .select("id,started_at")
        .single();
      if (insertError) {
        // 23505 = contrainte « une session active par personne » (course entre deux écrans)
        const conflict = insertError.code === "23505";
        return NextResponse.json(
          { error: conflict ? "Une session vient déjà d'être démarrée pour cette personne" : insertError.message },
          { status: conflict ? 409 : 500, headers: CORS_HEADERS },
        );
      }
      return NextResponse.json(
        {
          project_id: projectId,
          started_at: created.started_at,
          hours: shapeHours(project.hours_done ?? 0, project.hours_total ?? null),
        },
        { status: 201, headers: CORS_HEADERS },
      );
    }

    // action === "stop"
    if (!open) {
      return NextResponse.json(
        { error: "Aucune session en cours pour cette personne" },
        { status: 409, headers: CORS_HEADERS },
      );
    }
    if (open.project_id !== projectId) {
      return NextResponse.json(
        { error: "La session en cours concerne un autre projet", project_id: open.project_id },
        { status: 409, headers: CORS_HEADERS },
      );
    }
    const closed = await closeSession(sb, open);
    if (!closed) {
      return NextResponse.json(
        { error: "La session venait d'être fermée ailleurs" },
        { status: 409, headers: CORS_HEADERS },
      );
    }
    // Relit le projet pour renvoyer le done accumulé par le serveur.
    const { data: fresh } = await sb
      .from("projects")
      .select("hours_done,hours_total")
      .eq("id", projectId)
      .maybeSingle();
    return NextResponse.json(
      {
        project_id: projectId,
        started_at: closed.started_at,
        ended_at: closed.ended_at,
        session_hours: closed.hours,
        hours: shapeHours(
          fresh?.hours_done ?? (project.hours_done ?? 0) + (closed.hours ?? 0),
          fresh?.hours_total ?? project.hours_total ?? null,
        ),
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
