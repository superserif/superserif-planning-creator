"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-client";
import LoginPage from "@/components/login-page";

/**
 * Gates the app behind Supabase Auth. In demo mode (no Supabase configured)
 * the gate is transparent. Data is protected server-side by RLS either way —
 * this gate is UX, not the security boundary.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null | undefined>(
    supabase ? undefined : null,
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) return children;
  if (session === undefined) return null; // resolving the stored session — avoid a login flash
  if (session === null) return <LoginPage />;
  return children;
}
