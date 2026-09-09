import { NextResponse } from "next/server";
import { adminClient, CORS_HEADERS } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/people → { people: [{ id, name }] }
 * Toute l'équipe, même sans projet actif — pour attribuer un écran à un membre.
 */
export async function GET() {
  const sb = adminClient();
  const { data, error } = await sb.from("people").select("id,name").order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
  return NextResponse.json({ people: data }, { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
