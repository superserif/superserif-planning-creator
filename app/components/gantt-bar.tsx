"use client";

import { useEffect, useRef, useState } from "react";
import { animate, spring } from "animejs";
import type { Person, Project } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { clamp, dayIndex, formatDay, shiftIso } from "@/lib/dates";
import { reducedMotion, ringAt } from "@/lib/motion";
import Avatar from "@/components/avatar";

type DragMode = "move" | "resize-l" | "resize-r";

interface DragState {
  mode: DragMode;
  dx: number;
  moved: boolean;
  pointer: { x: number; y: number };
}

export default function GanttBar({
  project,
  person,
  rangeStartYear,
  totalDays,
  dayWidth,
  selected,
  editing,
  born,
  onBornConsumed,
  onSelect,
  onOpenPopover,
  onDatesChange,
  onStartRename,
  onCommitName,
}: {
  project: Project;
  person: Person | null;
  rangeStartYear: number;
  totalDays: number;
  dayWidth: number;
  selected: boolean;
  editing: boolean;
  born: boolean;
  onBornConsumed: () => void;
  onSelect: () => void;
  onOpenPopover: (x: number, y: number) => void;
  onDatesChange: (deltaStart: number, deltaEnd: number) => void;
  onStartRename: () => void;
  onCommitName: (name: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<{ x: number; mode: DragMode; moved: boolean } | null>(null);
  const snapRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(
    () => () => {
      if (clickTimerRef.current !== null) clearTimeout(clickTimerRef.current);
    },
    [],
  );

  const spec = STATUSES[project.status];
  const startFull = dayIndex(project.start_date, rangeStartYear);
  const endFull = dayIndex(project.end_date, rangeStartYear);
  const start = clamp(startFull, 0, totalDays - 1);
  const end = clamp(endFull, 0, totalDays - 1);
  const clippedLeft = startFull < 0;
  const clippedRight = endFull > totalDays - 1;
  const leftPx = start * dayWidth;
  const widthPx = (end - start + 1) * dayWidth;

  /* ----- drag math ----- */

  const clampDx = (mode: DragMode, dx: number): number => {
    if (dayWidth === 0) return 0;
    if (mode === "move") {
      return clamp(dx, -startFull * dayWidth, (totalDays - 1 - endFull) * dayWidth);
    }
    if (mode === "resize-l") {
      return clamp(dx, -startFull * dayWidth, (endFull - startFull) * dayWidth);
    }
    return clamp(
      dx,
      (startFull - endFull) * dayWidth,
      (totalDays - 1 - endFull) * dayWidth,
    );
  };

  const deltaDays = (mode: DragMode, dx: number): number =>
    dayWidth > 0 ? Math.round(clampDx(mode, dx) / dayWidth) : 0;

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    const mode = (target.dataset.dragMode ?? "move") as DragMode;
    if (mode !== "move") e.stopPropagation();
    e.preventDefault();
    target.setPointerCapture(e.pointerId);
    downRef.current = { x: e.clientX, mode, moved: false };
    setDrag({ mode, dx: 0, moved: false, pointer: { x: e.clientX, y: e.clientY } });
    onSelect();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const down = downRef.current;
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 3) down.moved = true;
    setDrag({
      mode: down.mode,
      dx,
      moved: down.moved,
      pointer: { x: e.clientX, y: e.clientY },
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const down = downRef.current;
    if (!down) return;
    downRef.current = null;
    const dx = e.clientX - down.x;

    if (!down.moved) {
      setDrag(null);
      if (down.mode === "move") {
        // wait out the double-click window before opening the popover,
        // so dblclick-to-rename can land on the bar
        const { clientX, clientY } = e;
        if (clickTimerRef.current !== null) clearTimeout(clickTimerRef.current);
        clickTimerRef.current = window.setTimeout(() => {
          clickTimerRef.current = null;
          onOpenPopover(clientX, clientY);
        }, 250);
      }
      return;
    }

    const delta = deltaDays(down.mode, dx);
    if (down.mode === "move") {
      snapRef.current = clampDx("move", dx) - delta * dayWidth;
      onDatesChange(delta, delta);
    } else if (down.mode === "resize-l") {
      onDatesChange(delta, 0);
    } else {
      onDatesChange(0, delta);
    }
    setDrag(null);
  };

  /* Snap settle: the residual pixels ease out with a touch of spring */
  useEffect(() => {
    if (drag || snapRef.current === 0 || !barRef.current) return;
    const residual = snapRef.current;
    snapRef.current = 0;
    if (reducedMotion()) return;
    animate(barRef.current, {
      x: [residual, 0],
      ease: spring({ stiffness: 280, damping: 22 }),
      onComplete: () => {
        if (barRef.current) barRef.current.style.transform = "";
      },
    });
  }, [drag, project.start_date, project.end_date]);

  /* Birth: a new bar grows from its start day */
  useEffect(() => {
    if (!born || !barRef.current) return;
    onBornConsumed();
    if (reducedMotion()) return;
    barRef.current.style.transformOrigin = "left center";
    animate(barRef.current, {
      scaleX: [0, 1],
      duration: 250,
      ease: "outQuint",
      onComplete: () => {
        if (barRef.current) barRef.current.style.transform = "";
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [born]);

  /* ----- visual position during drag ----- */

  let style: React.CSSProperties = { left: leftPx, width: widthPx };
  let liveStart = project.start_date;
  let liveEnd = project.end_date;

  if (drag && dayWidth > 0) {
    const dx = clampDx(drag.mode, drag.dx);
    const delta = deltaDays(drag.mode, drag.dx);
    if (drag.mode === "move") {
      style = { left: leftPx + dx, width: widthPx };
      liveStart = shiftIso(project.start_date, delta);
      liveEnd = shiftIso(project.end_date, delta);
    } else if (drag.mode === "resize-l") {
      style = { left: leftPx + dx, width: widthPx - dx };
      liveStart = shiftIso(project.start_date, delta);
    } else {
      style = { left: leftPx, width: widthPx + dx };
      liveEnd = shiftIso(project.end_date, delta);
    }
  }

  const showAvatar = person !== null && widthPx >= 64 && !clippedLeft;
  const nameInside = widthPx === 0 || widthPx >= (showAvatar ? 120 : 88);
  const dragging = drag !== null && drag.moved;

  return (
    <>
      <div
        ref={barRef}
        role="button"
        tabIndex={0}
        data-no-pan
        data-drag-mode="move"
        aria-label={`${project.name || "Sans titre"}, ${spec.label}, du ${formatDay(project.start_date)} au ${formatDay(project.end_date)}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && barRef.current) {
            const r = barRef.current.getBoundingClientRect();
            onOpenPopover(r.left + r.width / 2, r.bottom);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (clickTimerRef.current !== null) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
          }
          onStartRename();
        }}
        className={`group absolute top-1/2 h-9 -translate-y-1/2 touch-none select-none ${
          dragging ? "z-10 cursor-grabbing" : "cursor-grab"
        } rounded-lg ${clippedLeft ? "rounded-l-none" : ""} ${clippedRight ? "rounded-r-none" : ""} ${spec.bar} ${
          selected ? "shadow-[0_0_0_2px_var(--color-ink)]" : ""
        } focus-visible:shadow-[0_0_0_2px_var(--color-ink)] focus:outline-hidden`}
        style={style}
      >
        {showAvatar && !editing && (
          <span className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2">
            <Avatar person={person} className="size-6" />
          </span>
        )}
        {nameInside && !editing && (
          <p
            className={`pointer-events-none truncate pr-2.5 text-xs/9 font-semibold ${showAvatar ? "pl-8.5" : "pl-2.5"}`}
          >
            {project.name || "Sans titre"}
          </p>
        )}
        {/* resize handles — revealed by cursor, hinted by grips on hover */}
        {!clippedLeft && (
          <div
            className="bar-handle absolute inset-y-0 left-0 flex w-2 items-center justify-center rounded-l-lg"
            data-drag-mode="resize-l"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="h-3 w-0.5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40" />
          </div>
        )}
        {!clippedRight && (
          <div
            className="bar-handle absolute inset-y-0 right-0 flex w-2 items-center justify-center rounded-r-lg"
            data-drag-mode="resize-r"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="h-3 w-0.5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40" />
          </div>
        )}
      </div>

      {/* Name beside short bars */}
      {!nameInside && !editing && (
        <p
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-xs font-semibold ${spec.outsideText}`}
          style={{ left: leftPx + widthPx + 8, maxWidth: "12rem" }}
        >
          {project.name || "Sans titre"}
        </p>
      )}

      {/* Dates tooltip while dragging */}
      {dragging && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 whitespace-nowrap text-white shadow-float"
          style={{ left: drag.pointer.x, top: drag.pointer.y - 16 }}
        >
          <p className="text-xs font-semibold tabular-nums">
            {formatDay(liveStart)} → {formatDay(liveEnd)}
          </p>
        </div>
      )}

      {/* Inline rename */}
      {editing && (
        <NameInput
          defaultValue={project.name}
          leftPx={leftPx}
          onCommit={(name, withRing) => {
            if (withRing && barRef.current) {
              const r = barRef.current.getBoundingClientRect();
              void ringAt(r.left + Math.min(r.width, 120) / 2, r.top + r.height / 2);
            }
            onCommitName(name);
          }}
          onCancel={() => onCommitName(project.name)}
        />
      )}
    </>
  );
}

function NameInput({
  defaultValue,
  leftPx,
  onCommit,
  onCancel,
}: {
  defaultValue: string;
  leftPx: number;
  onCommit: (name: string, withRing: boolean) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      name="project-name"
      data-no-pan
      aria-label="Nom du projet"
      placeholder="Nom du projet"
      defaultValue={defaultValue}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onCommit((e.target as HTMLInputElement).value, true);
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      onBlur={(e) => onCommit(e.target.value, false)}
      className="absolute top-1/2 z-20 w-52 -translate-y-1/2 rounded-lg bg-white px-2.5 py-1.5 text-sm shadow-float outline-2 -outline-offset-1 outline-ink placeholder:text-mute"
      style={{ left: leftPx }}
    />
  );
}
