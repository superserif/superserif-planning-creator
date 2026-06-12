"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { getSupabase } from "@/lib/supabase-client";
import { reducedMotion } from "@/lib/motion";
import ShaderBg from "@/components/shader-bg";

const floatLabel =
  "pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm/5 text-mute transition-all duration-200 " +
  "peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[0.625rem]/3 peer-focus:font-medium peer-focus:text-ash " +
  "peer-not-placeholder-shown:top-1.5 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-[0.625rem]/3 peer-not-placeholder-shown:font-medium peer-not-placeholder-shown:text-ash";

const floatInput =
  "peer h-10 w-full rounded-lg bg-white px-3.5 pt-4 pb-1 text-sm/5 outline -outline-offset-1 outline-hairline placeholder-transparent focus-visible:outline-2 focus-visible:outline-ink";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current || reducedMotion()) return;
    animate(cardRef.current, {
      y: [14, 0],
      opacity: [0, 1],
      duration: 450,
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
      if (cardRef.current && !reducedMotion()) {
        animate(cardRef.current, {
          x: [0, -6, 5, -3, 0],
          duration: 300,
          ease: "outQuad",
        });
      }
    }
    // on success the auth listener in AuthGate swaps the view
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-6 py-10">
      <ShaderBg />

      <div ref={cardRef} className="relative w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- inline brand asset */}
        <img
          src="/logo-superserif.svg"
          alt="Superserif"
          className="mx-auto mb-8 h-7 w-auto select-none"
          draggable={false}
        />

        <div className="rounded-[20px] bg-white p-8 shadow-float sm:p-10">
          <form onSubmit={submit} aria-label="Connexion">
            <h1 className="text-center text-2xl font-semibold tracking-tight text-balance">
              Connexion
            </h1>
            <p className="mt-1.5 text-center text-base/6 text-ash sm:text-sm/6">
              Le planning du studio.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={floatInput}
                />
                <label htmlFor="email" className={floatLabel}>
                  Email
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={floatInput}
                />
                <label htmlFor="password" className={floatLabel}>
                  Mot de passe
                </label>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              data-button-009=""
              disabled={pending}
              className="button-009 mt-6 w-full text-sm font-semibold disabled:opacity-60 [--button-009-color:#ffffff] [--button-009-color-background:var(--color-rausch)] [--button-009-color-focus:var(--color-ink)] [--button-009-padding-top:0.92857em] [--button-009-padding-bottom:0.92857em]"
            >
              <span className="button-009__inner">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100%"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="button-009__icon is--left"
                >
                  <path
                    d="M14 19L21 12L14 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                  ></path>
                  <path
                    d="M21 12H2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                  ></path>
                </svg>
                <span className="button-009__text">
                  {pending ? "Connexion…" : "Se connecter"}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100%"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="button-009__icon is--right"
                >
                  <path
                    d="M14 19L21 12L14 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                  ></path>
                  <path
                    d="M21 12H2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                  ></path>
                </svg>
              </span>
              <span className="button-009__bg"></span>
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/45">
          Un seul compte pour l&rsquo;équipe — demande l&rsquo;accès à JJ.
        </p>
      </div>
    </main>
  );
}
