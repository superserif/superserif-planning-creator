"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { reducedMotion } from "@/lib/motion";

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function Toast({
  toast,
  onDone,
}: {
  toast: ToastState | null;
  onDone: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    if (elRef.current && !reducedMotion()) {
      animate(elRef.current, {
        y: [12, 0],
        opacity: [0, 1],
        duration: 250,
        ease: "outQuint",
      });
    }
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  if (!toast) return null;

  return (
    <div
      ref={elRef}
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-2.5 pr-3 pl-4 text-white shadow-float"
    >
      <p className="text-sm">{toast.message}</p>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDone();
          }}
          className="rounded-full px-2 py-0.5 text-sm font-semibold underline underline-offset-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
