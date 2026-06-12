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
  "Access-Control-Allow-Headers": "Content-Type",
};

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
  const done = row.hours_done ?? 0;
  const total = row.hours_total ?? null;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    moonmoon: row.moonmoon,
    hours: {
      done,
      total,
      pct: total && total > 0 ? Math.round((done / total) * 100) : null,
    },
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
