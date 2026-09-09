import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for the public API routes.
 * Uses the service role key — keep it strictly out of NEXT_PUBLIC.
 */
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const PROJECT_STATUSES = ["devise", "demarre", "termine", "archive"] as const;

/** Les heures circulent en décimal, 2 décimales max. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Bloc heures public : { done, total, pct } — total null = non vendu (« n.c. »). */
export function shapeHours(done: number, total: number | null) {
  return {
    done: round2(done),
    total,
    pct: total && total > 0 ? Math.round((done / total) * 100) : null,
  };
}

interface ProjectRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  moonmoon: boolean;
  hours_done: number | null;
  hours_total: number | null;
  assignees: string[];
}

/** The public shape of a project, assignees resolved to names. */
export function shapeProject(row: ProjectRow, peopleById: Map<string, string>) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    moonmoon: row.moonmoon,
    hours: shapeHours(row.hours_done ?? 0, row.hours_total ?? null),
    assignees: row.assignees.map((id) => ({
      id,
      name: peopleById.get(id) ?? "inconnu",
    })),
  };
}

export const PROJECT_COLUMNS =
  "id,name,start_date,end_date,status,moonmoon,hours_done,hours_total,assignees";

export async function loadPeopleNames(sb: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await sb.from("people").select("id,name");
  return new Map((data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
}

// ---------------------------------------------------------------------------
// Sessions de temps (écran e-paper) — le serveur accumule, les clients lisent.

export interface WorkSessionRow {
  id: string;
  person_id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  hours: number | null;
}

export const SESSION_COLUMNS = "id,person_id,project_id,started_at,ended_at,hours";

/** La session ouverte (ended_at null) d'une personne — au plus une par personne. */
export async function getOpenSession(sb: SupabaseClient, personId: string) {
  return sb
    .from("work_sessions")
    .select(SESSION_COLUMNS)
    .eq("person_id", personId)
    .is("ended_at", null)
    .maybeSingle<WorkSessionRow>();
}

/** Heures écoulées depuis le début d'une session, en décimal 2 chiffres. */
export function elapsedHours(startedAt: string, now = Date.now()): number {
  return round2(Math.max(0, now - new Date(startedAt).getTime()) / 3_600_000);
}

/**
 * Ferme une session ouverte et crédite le temps écoulé sur le projet
 * (incrément atomique côté Postgres — jamais d'écrasement de total).
 * Retourne la session fermée, ou null si elle avait déjà été fermée ailleurs.
 */
export async function closeSession(
  sb: SupabaseClient,
  session: WorkSessionRow,
): Promise<WorkSessionRow | null> {
  const hours = elapsedHours(session.started_at);
  const { data, error } = await sb
    .from("work_sessions")
    .update({ ended_at: new Date().toISOString(), hours })
    .eq("id", session.id)
    .is("ended_at", null)
    .select(SESSION_COLUMNS)
    .maybeSingle<WorkSessionRow>();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { error: rpcError } = await sb.rpc("add_project_hours", {
    p_project_id: session.project_id,
    p_hours: hours,
  });
  if (rpcError) throw new Error(rpcError.message);
  return data;
}
