"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { reducedMotion } from "@/lib/motion";
import Tip from "@/components/tip";

export interface MonthOption {
  label: string;
  index: number;
  /** day at the middle of the month, in range-day coordinates */
  day: number;
}

export interface OverloadAlert {
  pct: number;
  day: number;
  label: string;
}

const iconBtn =
  "relative flex size-8 shrink-0 items-center justify-center rounded-full text-ash transition-transform outline -outline-offset-1 outline-hairline hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-ink";

export default function AppHeader({
  centerLabel,
  months,
  currentMonthIndex,
  delivered,
  overload,
  readOnly,
  onOverloadClick,
  onPickMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  onAddProject,
  onShare,
  onLogout,
}: {
  centerLabel: string;
  months: MonthOption[];
  currentMonthIndex: number;
  delivered: number;
  overload: OverloadAlert | null;
  readOnly: boolean;
  onOverloadClick: (day: number) => void;
  onPickMonth: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onAddProject?: () => void;
  onShare?: () => void;
  onLogout?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-black/8 px-4 py-3 sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- inline brand asset */}
        <img
          src="/logo-superserif.svg"
          alt="Superserif"
          draggable={false}
          className="h-5 w-auto shrink-0 invert select-none"
        />
        {readOnly && (
          <span className="rounded-full bg-cloud px-2.5 py-1 text-xs font-semibold text-ash">
            Lecture seule
          </span>
        )}
        {overload && (
          <button
            type="button"
            onClick={() => onOverloadClick(overload.day)}
            title="Aller à la semaine chargée"
            className="flex min-w-0 items-center gap-1.5 rounded-full bg-warn-soft py-1 pr-2.5 pl-2 text-xs font-semibold text-warn transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-warn max-md:hidden"
          >
            <svg viewBox="0 0 16 16" fill="none" className="size-3.5 shrink-0">
              <path
                d="M8 2 14.5 13.5h-13L8 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.9" fill="currentColor" />
            </svg>
            <span className="truncate">{overload.label}</span>
          </button>
        )}
      </div>

      {/* exactly centered: arrows + month only */}
      <div className="flex items-center gap-1">
        <Tip label="Mois précédent">
          <button type="button" onClick={onPrevMonth} aria-label="Mois précédent" className={iconBtn}>
            <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
              <path
                d="M10 3.5 5.5 8 10 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </Tip>
        <div className="relative">
          <button
            type="button"
            aria-expanded={pickerOpen}
            aria-label="Choisir le mois"
            onClick={() => setPickerOpen((o) => !o)}
            className="w-32 rounded-lg py-1 text-center text-sm font-semibold tracking-tight whitespace-nowrap tabular-nums hover:bg-cloud focus-visible:outline-2 focus-visible:outline-ink"
          >
            {centerLabel}
          </button>
          {pickerOpen && (
            <MonthPicker
              months={months}
              currentMonthIndex={currentMonthIndex}
              onPick={(day) => {
                onPickMonth(day);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        <Tip label="Mois suivant">
          <button type="button" onClick={onNextMonth} aria-label="Mois suivant" className={iconBtn}>
            <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
              <path
                d="M6 3.5 10.5 8 6 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </Tip>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        {delivered > 0 && (
          <Odometer count={delivered} year={new Date().getFullYear()} />
        )}
        <button
          type="button"
          onClick={onToday}
          className="rounded-full px-3 py-1.5 text-sm text-ash outline -outline-offset-1 outline-hairline hover:bg-cloud hover:text-ink focus-visible:outline-2 focus-visible:outline-ink max-sm:hidden"
        >
          Aujourd&rsquo;hui
        </button>
        {onShare && (
          <Tip label="Copier le lien lecture seule">
            <button type="button" onClick={onShare} aria-label="Partager en lecture seule" className={iconBtn}>
              <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                <path
                  d="M6.5 9.5 9.5 6.5M7.5 4.75 9 3.25a2.47 2.47 0 0 1 3.5 0l.25.25a2.47 2.47 0 0 1 0 3.5L11.25 8.5M8.5 11.25 7 12.75a2.47 2.47 0 0 1-3.5 0l-.25-.25a2.47 2.47 0 0 1 0-3.5L4.75 7.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </Tip>
        )}
        {onLogout && (
          <Tip label="Se déconnecter">
            <button type="button" onClick={onLogout} aria-label="Se déconnecter" className={iconBtn}>
              <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                <path
                  d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11l3-3-3-3M13 8H6.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Tip>
        )}
        {onAddProject && (
          <button
            type="button"
            onClick={onAddProject}
            title="Nouveau projet (⌘P)"
            className="rounded-lg bg-rausch px-3 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rausch"
          >
            <span className="max-sm:hidden">Ajouter un projet</span>
            <span className="sm:hidden">Projet</span>
          </button>
        )}
      </div>
    </header>
  );
}

/** Quiet annual counter; the number pops when a project ships. */
function Odometer({ count, year }: { count: number; year: number }) {
  const numRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(count);

  useEffect(() => {
    if (count > prevRef.current && numRef.current && !reducedMotion()) {
      animate(numRef.current, {
        y: [-10, 0],
        scale: [1.4, 1],
        duration: 450,
        ease: "outBack(2)",
      });
    }
    prevRef.current = count;
  }, [count]);

  return (
    <p className="text-xs whitespace-nowrap text-mute tabular-nums max-lg:hidden">
      <span ref={numRef} className="inline-block font-semibold text-ash">
        {count}
      </span>{" "}
      livré{count > 1 ? "s" : ""} en {year}
    </p>
  );
}

function MonthPicker({
  months,
  currentMonthIndex,
  onPick,
  onClose,
}: {
  months: MonthOption[];
  currentMonthIndex: number;
  onPick: (day: number) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-1/2 z-50 mt-2 max-h-80 w-44 -translate-x-1/2 overflow-y-auto rounded-xl bg-white p-1.5 shadow-float"
    >
      {months.map((m) => {
        const current = m.index === currentMonthIndex;
        return (
          <button
            key={m.index}
            ref={current ? currentRef : undefined}
            type="button"
            onClick={() => onPick(m.day)}
            className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm tabular-nums hover:bg-cloud focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
              current ? "bg-cloud font-semibold" : ""
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
