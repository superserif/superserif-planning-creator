"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import type { Person, Project, Status } from "@/lib/types";
import { STATUSES, STATUS_ORDER } from "@/lib/types";
import { formatDay } from "@/lib/dates";
import { reducedMotion } from "@/lib/motion";
import Avatar from "@/components/avatar";

const WIDTH = 248;

export default function ProjectPopover({
  project,
  people,
  x,
  y,
  onClose,
  onStatus,
  onAssign,
  onRename,
  onDelete,
}: {
  project: Project;
  people: Person[];
  x: number;
  y: number;
  onClose: () => void;
  onStatus: (status: Status, origin: { x: number; y: number }) => void;
  onAssign: (personId: string | null) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelRef.current || reducedMotion()) return;
    animate(panelRef.current, {
      scale: [0.96, 1],
      opacity: [0, 1],
      duration: 150,
      ease: "outQuad",
    });
  }, []);

  const left = Math.min(Math.max(8, x - WIDTH / 2), window.innerWidth - WIDTH - 8);
  const top = Math.min(y + 8, window.innerHeight - 380);

  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Projet ${project.name || "sans titre"}`}
        className="fixed z-50 origin-top rounded-xl bg-white p-2 shadow-float"
        style={{ left, top: Math.max(8, top), width: WIDTH }}
      >
        <div className="px-2 pt-1 pb-2">
          <p className="truncate text-sm font-semibold">
            {project.name || "Sans titre"}
          </p>
          <p className="mt-0.5 text-xs text-ash tabular-nums">
            {formatDay(project.start_date)} → {formatDay(project.end_date)}
          </p>
        </div>

        <div className="border-t border-black/6 py-1">
          {STATUS_ORDER.map((s) => {
            const spec = STATUSES[s];
            const active = project.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onStatus(s, { x: r.left + 16, y: r.top + r.height / 2 });
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-cloud focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${active ? "bg-cloud" : ""}`}
              >
                <span className={`size-2.5 shrink-0 rounded-full ${spec.dot}`} />
                <span className="min-w-0 flex-1 truncate">{spec.label}</span>
                {active && (
                  <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                    <path
                      d="m3.5 8.5 3 3 6-7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {people.length > 0 && (
          <div className="border-t border-black/6 px-2 py-2">
            <p className="pb-1.5 text-xs font-semibold text-ash">Assigné à</p>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const active = project.person_id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.name}
                    aria-pressed={active}
                    onClick={() => onAssign(active ? null : p.id)}
                    className={`shrink-0 rounded-full transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      active ? "outline-2 outline-offset-2 outline-ink" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Avatar person={p} className="size-7" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex border-t border-black/6 pt-1">
          <button
            type="button"
            onClick={onRename}
            className="flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-cloud focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          >
            Renommer
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 rounded-lg px-2 py-1.5 text-left text-sm text-alert hover:bg-cloud focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          >
            Supprimer
          </button>
        </div>
      </div>
    </>
  );
}
