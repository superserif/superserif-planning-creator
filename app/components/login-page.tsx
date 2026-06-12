"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { getSupabase } from "@/lib/supabase-client";
import { reducedMotion } from "@/lib/motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!formRef.current || reducedMotion()) return;
    animate(formRef.current, {
      y: [10, 0],
      opacity: [0, 1],
      duration: 350,
      ease: "outQuint",
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || pending) return;
    setPending(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (authError) {
      setError("Identifiants incorrects.");
      if (formRef.current && !reducedMotion()) {
        animate(formRef.current, {
          x: [0, -6, 5, -3, 0],
          duration: 300,
          ease: "outQuad",
        });
      }
    }
    // on success the auth listener in AuthGate swaps the view
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6">
      <form
        ref={formRef}
        onSubmit={submit}
        className="w-full max-w-xs"
        aria-label="Connexion"
      >
        <p className="text-lg font-semibold tracking-tight">
          Lineup<span className="text-rausch">.</span>
        </p>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-balance">
          Connexion
        </h1>
        <p className="mt-1.5 text-base/6 text-ash sm:text-sm/6">
          Le planning du studio.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg px-3.5 py-2.5 text-base/6 outline -outline-offset-1 outline-hairline placeholder:text-mute focus-visible:outline-2 focus-visible:outline-ink sm:py-2 sm:text-sm/6"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-3.5 py-2.5 text-base/6 outline -outline-offset-1 outline-hairline placeholder:text-mute focus-visible:outline-2 focus-visible:outline-ink sm:py-2 sm:text-sm/6"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-lg bg-rausch px-4 py-2.5 text-base/6 font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rausch sm:py-2 sm:text-sm/6"
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>

        <p className="mt-6 text-xs text-mute">
          Un seul compte pour l&rsquo;équipe — demande l&rsquo;accès à JJ.
        </p>
      </form>
    </main>
  );
}
