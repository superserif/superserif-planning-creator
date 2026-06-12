"use client";

import { useEffect, useRef, useState } from "react";
import { animate, spring } from "animejs";
import type { Person, Project } from "@/lib/types";
import { barSpec } from "@/lib/types";
import { clamp, dayIndex, formatDay, shiftIso } from "@/lib/dates";
import { reducedMotion, ringAt } from "@/lib/motion";
import Avatar from "@/components/avatar";

type DragMode = "move" | "resize-l" | "resize-r";

interface DragState {
  mode: DragMode;
  dx: number;
  dy: number;
  moved: boolean;
  pointer: { x: number; y: number };
}

const SNAP_RANGE = 2; // days of magnetism toward a neighbour's edge
const MAX_FACES = 3;

export default function GanttBar({
  project,
  persons,
  rangeStartYear,
  totalDays,
  dayWidth,
  snapStarts,
  selected,
  editing,
  born,
  readOnly,
  onBornConsumed,
  onSelect,
  onOpenPopover,
  onMoveDrop,
  onResize,
  onStartRename,
  onCommitName,
}: {
  project: Project;
  /** every assignee — the faces on the block */
  persons: Person[];
  rangeStartYear: number;
  totalDays: number;
  dayWidth: number;
  snapStarts: number[];
  selected: boolean;
  editing: boolean;
  born: boolean;
  readOnly: boolean;
  onBornConsumed: () => void;
  onSelect: (additive: boolean) => void;
  onOpenPopover: (x: number, y: number) => void;
  onMoveDrop: (deltaDays: number, targetGroupKey: string | null) => void;
  onResize: (deltaStart: number, deltaEnd: number) => void;
  onStartRename: () => void;
  onCommitName: (name: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<{
    x: number;
    y: number;
    mode: DragMode;
    moved: boolean;
    additive: boolean;
  } | null>(null);
  const snapRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(
    () => () => {
      if (clickTimerRef.current !== null) clearTimeout(clickTimerRef.current);
    },
    [],
  );

  const spec = barSpec(project);
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

  const deltaDays = (mode: DragMode, dx: number): number => {
    if (dayWidth === 0) return 0;
    let delta = Math.round(clampDx(mode, dx) / dayWidth);
    if (mode === "move") {
      const proposed = startFull + delta;
      for (const s of snapStarts) {
        if (
          Math.abs(proposed - s) <= SNAP_RANGE &&
          s >= 0 &&
          s + (endFull - startFull) <= totalDays - 1
        ) {
          delta = s - startFull;
          break;
        }
      }
    }
    return delta;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || readOnly || e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    const mode = (target.dataset.dragMode ?? "move") as DragMode;
    if (mode !== "move") e.stopPropagation();
    e.preventDefault();
    target.setPointerCapture(e.pointerId);
    downRef.current = {
      x: e.clientX,
      y: e.clientY,
      mode,
      moved: false,
      additive: e.shiftKey,
    };
    setDrag({
      mode,
      dx: 0,
      dy: 0,
      moved: false,
      pointer: { x: e.clientX, y: e.clientY },
    });
    onSelect(e.shiftKey);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const down = downRef.current;
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 3) down.moved = true;
    setDrag({
      mode: down.mode,
      dx,
      dy,
      moved: down.moved,
      pointer: { x: e.clientX, y: e.clientY },
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const down = downRef.current;
    if (!down) return;
    downRef.current = null;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;

    if (!down.moved) {
      setDrag(null);
      if (down.mode === "move" && !down.additive) {
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
      let targetGroup: string | null = null;
      if (Math.abs(dy) > 22) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        targetGroup =
          under?.closest<HTMLElement>("[data-group]")?.dataset.group ?? null;
      }
      onMoveDrop(delta, targetGroup);
    } else if (down.mode === "resize-l") {
      onResize(delta, 0);
    } else {
      onResize(0, delta);
    }
    setDrag(null);
  };

  /* Snap settle */
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
  }, [drag, project.start_date, project.end_date, project.assignees]);

  /* Birth */
  useEffect(() => {
    if (!born || !barRef.current) return;
    onBornConsumed();
    if (reducedMotion()) return;
    const el = barRef.current;
    el.style.transformOrigin = "left center";
    animate(el, { scaleX: [0, 1], ease: spring({ stiffness: 180, damping: 15 }) });
    animate(el, {
      scaleY: [0.4, 1],
      delay: 70,
      duration: 420,
      ease: "outBack(2.4)",
      onComplete: () => {
        el.style.transform = "";
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
      style = { left: leftPx + dx, width: widthPx, top: `calc(50% + ${drag.dy}px)` };
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

  const faces = persons.slice(0, MAX_FACES);
  const extra = persons.length - faces.length;
  const facesWidth =
    faces.length > 0 ? 4 + 20 + (faces.length - 1) * 13 + (extra > 0 ? 16 : 0) : 0;
  const showFaces = faces.length > 0 && widthPx >= facesWidth + 36 && !clippedLeft;
  const hoursLabel =
    project.hours_total && project.hours_total > 0
      ? `${project.hours_done ?? 0}/${project.hours_total}h · ${Math.round(((project.hours_done ?? 0) / project.hours_total) * 100)} %`
      : null;
  const nameInside = widthPx === 0 || widthPx >= (showFaces ? facesWidth + 64 : 56);
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
          if (e.key === "Enter" && barRef.current && !readOnly) {
            const r = barRef.current.getBoundingClientRect();
            onOpenPopover(r.left + r.width / 2, r.bottom);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (readOnly) return;
          if (clickTimerRef.current !== null) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
          }
          onStartRename();
        }}
        className={`group absolute top-1/2 flex h-7 -translate-y-1/2 items-center touch-none transition-[scale,box-shadow] duration-200 select-none ${
          dragging
            ? "z-20 cursor-grabbing"
            : readOnly
              ? "cursor-default"
              : "cursor-grab hover:scale-[1.02]"
        } rounded-md ${clippedLeft ? "rounded-l-none" : ""} ${clippedRight ? "rounded-r-none" : ""} ${spec.bar} ${
          selected
            ? "shadow-[0_0_0_2px_#ffffff,0_0_0_4px_var(--color-ink)]"
            : readOnly
              ? ""
              : "hover:shadow-[0_4px_12px_rgb(0_0_0/0.14)]"
        } focus-visible:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_var(--color-ink)] focus:outline-hidden`}
        style={style}
      >
        {showFaces && !editing && (
          <span className="pointer-events-none flex shrink-0 items-center pl-1">
            {faces.map((p, i) => (
              <span key={p.id} className={i > 0 ? "-ml-1.75" : ""}>
                <Avatar person={p} className="size-5 ring-1 ring-white" />
              </span>
            ))}
            {extra > 0 && (
              <span className="-ml-1.75 flex size-5 items-center justify-center rounded-full bg-white/85 text-[0.5625rem] font-semibold text-ink ring-1 ring-white">
                +{extra}
              </span>
            )}
          </span>
        )}
        {nameInside && !editing && (
          <p className="pointer-events-none min-w-0 flex-1 truncate pr-2 pl-1.5 text-[0.6875rem] font-semibold">
            {project.name || "Sans titre"}
            {hoursLabel && (
              <span className="pl-1.5 font-medium tabular-nums opacity-65">
                {hoursLabel}
              </span>
            )}
          </p>
        )}
        {!clippedLeft && !readOnly && (
          <div
            className="bar-handle absolute inset-y-0 left-0 flex w-2 items-center justify-center rounded-l-md"
            data-drag-mode="resize-l"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="h-2.5 w-0.5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40" />
          </div>
        )}
        {!clippedRight && !readOnly && (
          <div
            className="bar-handle absolute inset-y-0 right-0 flex w-2 items-center justify-center rounded-r-md"
            data-drag-mode="resize-r"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="h-2.5 w-0.5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-40" />
          </div>
        )}
      </div>

      {!nameInside && !editing && (
        <p
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-[0.6875rem] font-semibold ${spec.outsideText}`}
          style={{ left: leftPx + widthPx + 8, maxWidth: "12rem" }}
        >
          {project.name || "Sans titre"}
        </p>
      )}

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
    if (inputRef.current && !reducedMotion()) {
      animate(inputRef.current, {
        y: [8, 0],
        scale: [0.96, 1],
        opacity: [0, 1],
        duration: 280,
        ease: "outQuint",
      });
    }
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
      className="absolute top-1/2 z-20 w-52 rounded-lg bg-white px-3 py-1.5 text-xs caret-rausch shadow-float outline -outline-offset-1 outline-black/10 placeholder:text-mute [translate:0_-50%]"
      style={{ left: leftPx }}
    />
  );
}
