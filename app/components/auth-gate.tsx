"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-client";
import { ReadOnlyContext, SHARE_EMAIL } from "@/lib/read-only";
import LoginPage from "@/components/login-page";

/**
 * Gates the app behind Supabase Auth. In demo mode (no Supabase configured)
 * the gate is transparent. A `?partage=<secret>` URL signs into the read-only
 * share account — writes are refused by RLS server-side; the UI follows.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null | undefined>(
    supabase ? undefined : null,
  );

  useEffect(() => {
    if (!supabase) return;

    const share = new URLSearchParams(window.location.search).get("partage");
    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (share && data.session?.user.email !== SHARE_EMAIL) {
        let secret = share;
        try {
          secret = atob(share);
        } catch {
          // not base64 — use as-is
        }
        await supabase.auth.signOut();
        await supabase.auth.signInWithPassword({ email: SHARE_EMAIL, password: secret });
        return; // onAuthStateChange delivers the session
      }
      setSession(data.session);
    };
    void boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) return children;
  if (session === undefined) return null; // resolving the stored session — avoid a login flash
  if (session === null) return <LoginPage />;
  return (
    <ReadOnlyContext.Provider value={session.user.email === SHARE_EMAIL}>
      {children}
    </ReadOnlyContext.Provider>
  );
}
