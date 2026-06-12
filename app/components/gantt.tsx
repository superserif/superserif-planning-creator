"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { animate, stagger } from "animejs";
import type { Person, Project } from "@/lib/types";
import { barSpec } from "@/lib/types";
import {
  clamp,
  dayIndex,
  daysInRange,
  formatDay,
  formatMonthYear,
  isoFromDay,
  monthSpansRange,
  todayIso,
} from "@/lib/dates";
import { isAtCapacity, personLoad, studioLoadPct } from "@/lib/capacity";
import { reducedMotion } from "@/lib/motion";
import Avatar from "@/components/avatar";
import GanttBar from "@/components/gantt-bar";
import MoonMoonIcon from "@/components/moonmoon-icon";
import Tip from "@/components/tip";

const DEFAULT_VISIBLE_DAYS = 91; // default zoom: three months across the viewport
const MIN_VISIBLE_DAYS = 21;
const MAX_VISIBLE_DAYS = 420;
const MONTH_DAYS = 30.44;
const HEADER_REM = "3.25rem"; // months row (2.25) + sparkline row (1)

export interface GanttGroup {
  key: string;
  person: Person | null;
  projects: Project[];
}

export interface GanttHandle {
  scrollToToday(): void;
  scrollToDay(day: number): void;
  scrollByMonths(n: number): void;
  getCenterDay(): number;
}

const Gantt = forwardRef<
  GanttHandle,
  {
    rangeStartYear: number;
    yearCount: number;
    groups: GanttGroup[];
    visibleIds: Set<string>;
    filtersActive: boolean;
    closedGroups: Set<string>;
    selectedIds: Set<string>;
    editingId: string | null;
    bornId: string | null;
    loaded: boolean;
    readOnly: boolean;
    onToggleGroup: (key: string) => void;
    onBornConsumed: () => void;
    onCreate: (day: number, personId: string | null) => void;
    onCreateRange: (start: number, end: number, personId: string | null) => void;
    onToggleSelect: (id: string, additive: boolean) => void;
    onOpenPopover: (id: string, x: number, y: number) => void;
    onMoveDrop: (id: string, deltaDays: number, targetGroupKey: string | null) => void;
    onResize: (id: string, deltaStart: number, deltaEnd: number) => void;
    onStartRename: (id: string) => void;
    onDuplicate: (id: string) => void;
    onRemoveMany: (ids: string[]) => void;
    onCommitName: (id: string, name: string) => void;
    onCenterChange: (label: string, day: number) => void;
  }
>(function Gantt(
  {
    rangeStartYear,
    yearCount,
    groups,
    visibleIds,
    filtersActive,
    closedGroups,
    selectedIds,
    editingId,
    bornId,
    loaded,
    readOnly,
    onToggleGroup,
    onBornConsumed,
    onCreate,
    onCreateRange,
    onToggleSelect,
    onOpenPopover,
    onMoveDrop,
    onResize,
    onStartRename,
    onDuplicate,
    onRemoveMany,
    onCommitName,
    onCenterChange,
  },
  ref,
) {
  const totalDays = daysInRange(rangeStartYear, yearCount);
  const months = monthSpansRange(rangeStartYear, yearCount);
  const todayIdx = dayIndex(todayIso(), rangeStartYear);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const groupRefs = useRef(new Map<string, HTMLDivElement>());
  const prevTopsRef = useRef(new Map<string, number>());
  const enteredRef = useRef(false);
  const initialScrollRef = useRef(false);
  const centerDayRef = useRef(todayIdx);
  const pendingAnchorRef = useRef<{ day: number; screenX: number } | null>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const drawRef = useRef<{ anchor: number; personKey: string | null; top: number } | null>(
    null,
  );
  const markerDragRef = useRef(false);
  const geomRef = useRef({ dayWidth: 0, leftCol: 256 });

  const [dims, setDims] = useState({ width: 0, leftCol: 256 });
  const [visibleDays, setVisibleDays] = useState(DEFAULT_VISIBLE_DAYS);
  const [panning, setPanning] = useState(false);
  const [focusDay, setFocusDay] = useState(() => clamp(todayIdx, 0, totalDays - 1));
  const [draw, setDraw] = useState<{
    start: number;
    end: number;
    personKey: string | null;
    top: number;
  } | null>(null);

  const { leftCol } = dims;
  const dayWidth = dims.width > 0 ? Math.max(1.2, (dims.width - leftCol) / visibleDays) : 0;
  const totalWidth = totalDays * dayWidth;
  geomRef.current = { dayWidth, leftCol };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const lc = window.matchMedia("(min-width: 640px)").matches ? 256 : 160;
      setDims({ width: el.clientWidth, leftCol: lc });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  /* ----- scroll, zoom, anchoring ----- */

  const centerDay = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || dayWidth === 0) return todayIdx;
    const cx = el.scrollLeft + (leftCol + el.clientWidth) / 2;
    return clamp(Math.round((cx - leftCol) / dayWidth), 0, totalDays - 1);
  }, [dayWidth, leftCol, totalDays, todayIdx]);

  const scrollToDay = useCallback(
    (day: number, smooth: boolean) => {
      const el = scrollerRef.current;
      if (!el || dayWidth === 0) return;
      const left = leftCol + day * dayWidth - (leftCol + el.clientWidth) / 2;
      el.scrollTo({ left, behavior: smooth ? "smooth" : "instant" });
    },
    [dayWidth, leftCol],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToToday: () => scrollToDay(todayIdx, true),
      scrollToDay: (day: number) => scrollToDay(day, true),
      scrollByMonths: (n: number) =>
        scrollerRef.current?.scrollBy({
          left: n * MONTH_DAYS * dayWidth,
          behavior: "smooth",
        }),
      getCenterDay: () => centerDayRef.current,
    }),
    [scrollToDay, todayIdx, dayWidth],
  );

  /* Initial position: today centered. On zoom/resize, hold the anchor. */
  useLayoutEffect(() => {
    if (dayWidth === 0) return;
    if (!initialScrollRef.current) {
      initialScrollRef.current = true;
      centerDayRef.current = todayIdx;
      onCenterChange(formatMonthYear(rangeStartYear, todayIdx), todayIdx);
    }
    const el = scrollerRef.current;
    const anchor = pendingAnchorRef.current;
    if (el && anchor) {
      pendingAnchorRef.current = null;
      el.scrollLeft = leftCol + anchor.day * dayWidth - anchor.screenX;
    } else {
      scrollToDay(centerDayRef.current, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayWidth, leftCol]);

  const zoomBy = useCallback(
    (factor: number, anchorDay?: number, anchorScreenX?: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      pendingAnchorRef.current = {
        day: anchorDay ?? centerDayRef.current,
        screenX:
          anchorScreenX ?? el.scrollLeft + (leftCol + el.clientWidth) / 2 - el.scrollLeft,
      };
      setVisibleDays((v) =>
        clamp(Math.round(v * factor), MIN_VISIBLE_DAYS, MAX_VISIBLE_DAYS),
      );
    },
    [leftCol],
  );

  /* Pinch / ⌘-wheel zoom, anchored under the cursor */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const { dayWidth: dw, leftCol: lc } = geomRef.current;
      if (dw === 0) return;
      const rect = el.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const day = (el.scrollLeft + screenX - lc) / dw;
      pendingAnchorRef.current = { day, screenX };
      setVisibleDays((v) =>
        clamp(Math.round(v * Math.exp(e.deltaY * 0.0022)), MIN_VISIBLE_DAYS, MAX_VISIBLE_DAYS),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleScroll = () => {
    requestAnimationFrame(() => {
      const day = centerDay();
      if (day !== centerDayRef.current) {
        centerDayRef.current = day;
        onCenterChange(formatMonthYear(rangeStartYear, day), day);
      }
    });
  };

  /* ----- entrance + FLIP ----- */

  useEffect(() => {
    if (!loaded || enteredRef.current || groups.length === 0) return;
    enteredRef.current = true;
    if (reducedMotion()) return;
    const els = [...groupRefs.current.values()];
    animate(els, {
      y: [10, 0],
      opacity: [0, 1],
      duration: 320,
      delay: stagger(40),
      ease: "outQuint",
      onComplete: () => {
        els.forEach((el) => {
          el.style.transform = "";
          el.style.opacity = "";
        });
      },
    });
  }, [loaded, groups.length]);

  const flatProjects = groups.flatMap((g) => g.projects);

  useLayoutEffect(() => {
    const prev = prevTopsRef.current;
    const moved: { el: HTMLDivElement; delta: number }[] = [];
    for (const p of flatProjects) {
      const el = rowRefs.current.get(p.id);
      if (!el) continue;
      const before = prev.get(p.id);
      const after = el.offsetTop;
      if (before !== undefined && before !== after && el.offsetHeight > 0) {
        moved.push({ el, delta: before - after });
      }
      prev.set(p.id, after);
    }
    for (const id of [...prev.keys()]) {
      if (!flatProjects.some((p) => p.id === id)) prev.delete(id);
    }
    if (reducedMotion() || !enteredRef.current) return;
    for (const { el, delta } of moved) {
      animate(el, {
        y: [delta, 0],
        duration: 300,
        ease: "outQuint",
        onComplete: () => {
          el.style.transform = "";
        },
      });
    }
  });

  /* ----- pan / alt-draw ----- */

  const dayAtClientX = (clientX: number) => {
    const el = scrollerRef.current!;
    const rect = el.getBoundingClientRect();
    return clamp(
      Math.floor((el.scrollLeft + clientX - rect.left - leftCol) / dayWidth),
      0,
      totalDays - 1,
    );
  };

  const onPanDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el || e.button !== 0 || e.pointerType !== "mouse") return;
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!under || under.closest("[data-no-pan]")) return;

    if (e.altKey && !readOnly && dayWidth > 0) {
      // draw a new project at the chosen duration
      const rect = el.getBoundingClientRect();
      const day = dayAtClientX(e.clientX);
      const groupKey = under.closest<HTMLElement>("[data-group]")?.dataset.group ?? null;
      drawRef.current = {
        anchor: day,
        personKey: groupKey && groupKey !== "none" ? groupKey : null,
        top: el.scrollTop + (e.clientY - rect.top) - 52,
      };
      setDraw({ start: day, end: day, personKey: drawRef.current.personKey, top: drawRef.current.top });
      el.setPointerCapture(e.pointerId);
      return;
    }

    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  };

  const onPanMove = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (drawRef.current) {
      const day = dayAtClientX(e.clientX);
      const d = drawRef.current;
      setDraw({
        start: Math.min(d.anchor, day),
        end: Math.max(d.anchor, day),
        personKey: d.personKey,
        top: d.top,
      });
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) > 3) {
      pan.moved = true;
      setPanning(true);
    }
    if (pan.moved) {
      el.scrollLeft = pan.left - dx;
      el.scrollTop = pan.top - dy;
    }
  };

  const onPanUp = () => {
    if (drawRef.current && draw) {
      onCreateRange(draw.start, draw.end, draw.personKey);
    }
    drawRef.current = null;
    setDraw(null);
    panRef.current = null;
    setPanning(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (editingId || readOnly) return;
    const el = scrollerRef.current;
    if (!el || dayWidth === 0) return;
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!under || under.closest("[data-no-pan]")) return;
    const rect = el.getBoundingClientRect();
    if (el.scrollLeft + (e.clientX - rect.left) < leftCol) return;
    const day = dayAtClientX(e.clientX);
    const groupKey = under.closest<HTMLElement>("[data-group]")?.dataset.group;
    onCreate(day, groupKey && groupKey !== "none" ? groupKey : null);
  };

  /* ----- focus-day marker drag ----- */

  const onMarkerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    markerDragRef.current = true;
  };
  const onMarkerMove = (e: React.PointerEvent) => {
    if (!markerDragRef.current || dayWidth === 0) return;
    setFocusDay(dayAtClientX(e.clientX));
  };
  const onMarkerUp = () => {
    markerDragRef.current = false;
  };

  /* ----- derived: capacity, sparkline ----- */

  const people = groups.map((g) => g.person).filter((p): p is Person => p !== null);
  const focusIso = isoFromDay(rangeStartYear, focusDay);
  const createStart = clamp(centerDayRef.current - 15, 0, totalDays - 30);
  const createStartIso = isoFromDay(rangeStartYear, createStart);
  const createEndIso = isoFromDay(rangeStartYear, createStart + 29);
  const studioPct = studioLoadPct(flatProjects, people, focusIso, focusIso);
  const visibleCount = flatProjects.filter((p) => visibleIds.has(p.id)).length;

  const peopleKey = people.map((p) => `${p.id}:${p.capacity}`).join(",");
  const spark = useMemo(() => {
    const weeks = Math.floor(totalDays / 7);
    const pts: number[] = [];
    for (let w = 0; w < weeks; w++) {
      pts.push(
        studioLoadPct(
          flatProjects,
          people,
          isoFromDay(rangeStartYear, w * 7),
          isoFromDay(rangeStartYear, w * 7 + 6),
        ),
      );
    }
    const y = (pct: number) => 40 - (Math.min(pct, 120) / 120) * 38;
    let line = "";
    pts.forEach((pct, i) => {
      line += `${i === 0 ? "M" : "L"}${i + 0.5},${y(pct).toFixed(1)}`;
    });
    const area = `${line}L${weeks - 0.5},40L0.5,40Z`;
    return { weeks, line, area, hundredY: y(100) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatProjects, peopleKey, totalDays, rangeStartYear]);

  /* per-person snap candidates: the day after each project's end */
  const snapByPerson = useMemo(() => {
    const map = new Map<string, { id: string; day: number }[]>();
    for (const p of flatProjects) {
      if (!p.person_id) continue;
      const arr = map.get(p.person_id) ?? [];
      arr.push({ id: p.id, day: dayIndex(p.end_date, rangeStartYear) + 2 });
      map.set(p.person_id, arr);
    }
    return map;
  }, [flatProjects, rangeStartYear]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerCancel={onPanUp}
        onDoubleClick={handleDoubleClick}
        className={`absolute inset-0 overflow-auto overscroll-none select-none ${panning ? "cursor-grabbing" : ""}`}
      >
        <div
          className="relative flex min-h-full flex-col"
          style={{ width: leftCol + totalWidth, minWidth: "100%" }}
        >
          {/* Sticky header: months + studio-load sparkline */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-black/8 bg-white">
            <div className="flex h-9">
              <p
                data-no-pan
                title={`Charge du studio au ${formatDay(focusIso)}`}
                className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 bg-white px-4 text-xs text-mute tabular-nums sm:px-6"
                style={{ width: leftCol }}
              >
                {visibleCount} projet{visibleCount > 1 ? "s" : ""}
                <span aria-hidden="true">·</span>
                <span className={studioPct >= 100 ? "font-semibold text-alert" : ""}>
                  {studioPct} %
                </span>
              </p>
              <div className="relative" style={{ width: totalWidth }}>
                {months.map((m) => (
                  <div
                    key={m.monthIndex}
                    className={`absolute inset-y-0 flex items-center border-l border-black/6 pl-2 ${m.monthIndex % 2 === 1 ? "bg-cloud/70" : ""}`}
                    style={{ left: m.startDay * dayWidth, width: m.days * dayWidth }}
                  >
                    <p className="text-xs font-medium whitespace-nowrap text-ash">
                      {m.label}
                    </p>
                  </div>
                ))}
                {/* focus-day marker */}
                <button
                  type="button"
                  data-no-pan
                  aria-label={`Jour de référence : ${formatDay(focusIso)} — glisser pour changer`}
                  onPointerDown={onMarkerDown}
                  onPointerMove={onMarkerMove}
                  onPointerUp={onMarkerUp}
                  className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-ink px-2 py-0.5 text-[0.625rem] font-semibold whitespace-nowrap text-white shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  style={{ left: (focusDay + 0.5) * dayWidth }}
                >
                  {formatDay(focusIso)}
                </button>
              </div>
            </div>
            {/* sparkline */}
            <div className="flex h-4 border-t border-black/4">
              <span
                data-no-pan
                aria-hidden="true"
                className="sticky left-0 z-10 block shrink-0 bg-white"
                style={{ width: leftCol }}
              />
              <div
                className="relative"
                title="Charge du studio, semaine par semaine"
                style={{ width: totalWidth }}
              >
                {spark.weeks > 1 && (
                  <svg
                    viewBox={`0 0 ${spark.weeks} 40`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full"
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      x2={spark.weeks}
                      y1={spark.hundredY}
                      y2={spark.hundredY}
                      stroke="rgb(0 0 0 / 0.12)"
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path d={spark.area} fill="rgb(10 138 95 / 0.14)" />
                    <path
                      d={spark.line}
                      fill="none"
                      stroke="rgb(10 138 95 / 0.65)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Grid overlay — month tints, week ticks, today + focus lines */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 z-0"
            style={{ left: leftCol, width: totalWidth, top: HEADER_REM }}
          >
            {months.map((m) =>
              m.monthIndex % 2 === 1 ? (
                <div
                  key={m.monthIndex}
                  className="absolute inset-y-0 bg-cloud/70"
                  style={{ left: m.startDay * dayWidth, width: m.days * dayWidth }}
                />
              ) : null,
            )}
            {dayWidth > 4 &&
              Array.from({ length: Math.floor((totalDays - 1) / 7) }, (_, i) => (
                <div
                  key={i}
                  className="absolute inset-y-0 w-px bg-black/3"
                  style={{ left: (i + 1) * 7 * dayWidth }}
                />
              ))}
            {months.slice(1).map((m) => (
              <div
                key={m.monthIndex}
                className="absolute inset-y-0 w-px bg-black/6"
                style={{ left: m.startDay * dayWidth }}
              />
            ))}
            {todayIdx >= 0 && todayIdx < totalDays && (
              <div
                className="absolute inset-y-0 w-px bg-black/15"
                style={{ left: (todayIdx + 0.5) * dayWidth }}
              />
            )}
            <div
              className="absolute inset-y-0 w-px bg-ink/45"
              style={{ left: (focusDay + 0.5) * dayWidth }}
            />
            {/* draw preview */}
            {draw && (
              <div
                className="absolute h-9 rounded-lg bg-black/6 outline-dashed outline-1 outline-stone"
                style={{
                  left: draw.start * dayWidth,
                  width: (draw.end - draw.start + 1) * dayWidth,
                  top: Math.max(0, draw.top - 18),
                }}
              />
            )}
          </div>

          {/* Groups */}
          {groups.map((group) => {
            const open = !closedGroups.has(group.key);
            const groupVisible = group.projects.filter((p) => visibleIds.has(p.id));
            const groupShown = !filtersActive || groupVisible.length > 0;
            const load = group.person
              ? personLoad(flatProjects, group.person.id, focusIso, focusIso)
              : 0;
            const full =
              group.person !== null &&
              isAtCapacity(flatProjects, group.person, createStartIso, createEndIso);
            return (
              <div
                key={group.key}
                data-group={group.key}
                ref={(el) => {
                  if (el) groupRefs.current.set(group.key, el);
                  else groupRefs.current.delete(group.key);
                }}
              >
                {/* Group header */}
                <div
                  className={`flex overflow-clip transition-[height,opacity] duration-300 ${groupShown ? "h-12 opacity-100" : "h-0 opacity-0"}`}
                >
                  <div
                    data-no-pan
                    className="sticky left-0 z-30 flex shrink-0 items-center gap-2 border-b border-black/4 bg-white pr-3 pl-2 sm:pl-3.5"
                    style={{ width: leftCol }}
                  >
                    <Tip
                      label={open ? "Replier" : "Déplier"}
                      side="bottom"
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${open ? "Replier" : "Déplier"} ${group.person?.name ?? "Non assigné"}`}
                        onClick={() => onToggleGroup(group.key)}
                        className="relative flex size-6 shrink-0 items-center justify-center rounded-full text-mute hover:bg-cloud hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                        >
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
                    <Avatar person={group.person} className="size-7" />
                    <p
                      className={`min-w-0 truncate text-sm font-semibold ${group.person ? "" : "text-ash"}`}
                    >
                      {group.person?.name ?? "Non assigné"}
                    </p>
                    {group.person ? (
                      <span
                        title={`${load} projet${load > 1 ? "s" : ""} au ${formatDay(focusIso)} (max ${group.person.capacity})`}
                        className="flex shrink-0 items-center gap-1.5"
                      >
                        <span className="h-1 w-8 overflow-hidden rounded-full bg-black/10">
                          <span
                            className="block h-full rounded-full bg-leaf transition-[width] duration-300"
                            style={{
                              width: `${Math.min(100, (load / group.person.capacity) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="text-xs text-mute tabular-nums">
                          {load}/{group.person.capacity}
                        </span>
                      </span>
                    ) : (
                      <p className="text-xs text-mute tabular-nums">
                        {group.projects.length}
                      </p>
                    )}
                    <span className="flex-1" />
                    {!readOnly && (
                      <span className="group/plus relative shrink-0">
                        <button
                          type="button"
                          aria-label={`Nouveau projet — ${group.person?.name ?? "non assigné"}`}
                          aria-disabled={full}
                          onClick={() => {
                            if (full) return;
                            onCreate(createStart, group.person?.id ?? null);
                          }}
                          className={`relative flex size-6 items-center justify-center rounded-full transition-transform outline -outline-offset-1 focus-visible:outline-2 focus-visible:outline-ink ${
                            full
                              ? "cursor-not-allowed text-stone outline-black/5"
                              : "text-ash outline-hairline hover:bg-cloud hover:text-ink active:scale-90"
                          }`}
                        >
                          <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                            <path
                              d="M8 3.5v9M3.5 8h9"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute top-1/2 right-full z-30 mr-1.5 hidden -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover/plus:block"
                        >
                          {full ? "Nombre de projets max atteint" : "Nouveau projet"}
                        </span>
                      </span>
                    )}
                  </div>
                  {/* Collapsed minis */}
                  <div className="relative border-b border-black/4" style={{ width: totalWidth }}>
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"}`}
                    >
                      {group.projects.map((p) => {
                        const s = clamp(dayIndex(p.start_date, rangeStartYear), 0, totalDays - 1);
                        const e = clamp(dayIndex(p.end_date, rangeStartYear), 0, totalDays - 1);
                        return (
                          <span
                            key={p.id}
                            title={p.name}
                            className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${barSpec(p).mini}`}
                            style={{
                              left: s * dayWidth,
                              width: Math.max(6, (e - s + 1) * dayWidth),
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Project rows */}
                {group.projects.map((project) => {
                  const visible = open && groupShown && visibleIds.has(project.id);
                  const spec = barSpec(project);
                  const pct =
                    project.hours_total && project.hours_total > 0
                      ? Math.round(((project.hours_done ?? 0) / project.hours_total) * 100)
                      : null;
                  const snapStarts = (snapByPerson.get(project.person_id ?? "") ?? [])
                    .filter((s) => s.id !== project.id)
                    .map((s) => s.day);
                  return (
                    <div
                      key={project.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(project.id, el);
                        else rowRefs.current.delete(project.id);
                      }}
                      className={`flex overflow-clip transition-[height,opacity] duration-300 ${visible ? "h-12 opacity-100" : "h-0 opacity-0"}`}
                    >
                      <div
                        data-no-pan
                        className="group/row sticky left-0 z-20 flex shrink-0 items-center gap-2 border-b border-black/4 bg-white pr-3 pl-7 transition-colors hover:bg-cloud/70 sm:pl-12"
                        style={{ width: leftCol }}
                      >
                        <button
                          type="button"
                          aria-label={`Statut : ${spec.label}`}
                          title={spec.label}
                          onClick={(e) => {
                            if (readOnly) return;
                            const r = e.currentTarget.getBoundingClientRect();
                            onOpenPopover(project.id, r.left, r.bottom + 6);
                          }}
                          className="relative size-2.5 shrink-0 rounded-full transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          <span className={`absolute inset-0 rounded-full ${spec.dot}`} />
                        </button>
                        <p
                          className={`min-w-0 flex-1 truncate text-sm ${project.status === "archive" ? "text-mute" : ""}`}
                        >
                          {project.name || "Sans titre"}
                        </p>
                        {project.moonmoon && <MoonMoonIcon className="size-4" />}
                        {pct !== null && (
                          <span className="shrink-0 text-[0.625rem] text-mute tabular-nums">
                            {project.hours_done ?? 0}/{project.hours_total}h · {pct} %
                          </span>
                        )}
                        {!readOnly && (
                          <>
                            <Tip label="Dupliquer (⌘D)" side="left">
                              <button
                                type="button"
                                aria-label={`Dupliquer ${project.name || "le projet"}`}
                                onClick={() => onDuplicate(project.id)}
                                className="flex size-6 shrink-0 translate-x-1 items-center justify-center rounded-full text-ash opacity-0 transition-[opacity,translate] duration-200 group-hover/row:translate-x-0 group-hover/row:opacity-100 hover:bg-white hover:text-ink focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ink"
                              >
                                <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                                  <rect
                                    x="5.5"
                                    y="5.5"
                                    width="8"
                                    height="8"
                                    rx="1.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                  />
                                  <path
                                    d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                            </Tip>
                            <Tip label="Supprimer" side="left">
                              <button
                                type="button"
                                aria-label={`Supprimer ${project.name || "le projet"}`}
                                onClick={() => onRemoveMany([project.id])}
                                className="flex size-6 shrink-0 translate-x-1 items-center justify-center rounded-full text-alert opacity-0 transition-[opacity,translate] duration-200 delay-75 group-hover/row:translate-x-0 group-hover/row:opacity-100 hover:bg-white focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ink"
                              >
                                <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                                  <path
                                    d="M2.5 4h11M5.5 4V2.75a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4m1.75 0-.5 9a1 1 0 0 1-1 .95h-5.5a1 1 0 0 1-1-.95l-.5-9M6.5 7v4M9.5 7v4"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </Tip>
                          </>
                        )}
                      </div>
                      <div
                        className="relative border-b border-black/4"
                        style={{ width: totalWidth }}
                      >
                        <GanttBar
                          project={project}
                          person={group.person}
                          rangeStartYear={rangeStartYear}
                          totalDays={totalDays}
                          dayWidth={dayWidth}
                          snapStarts={snapStarts}
                          selected={selectedIds.has(project.id)}
                          editing={editingId === project.id}
                          born={bornId === project.id}
                          readOnly={readOnly}
                          onBornConsumed={onBornConsumed}
                          onSelect={(additive) => onToggleSelect(project.id, additive)}
                          onOpenPopover={(x, y) => onOpenPopover(project.id, x, y)}
                          onMoveDrop={(delta, target) => onMoveDrop(project.id, delta, target)}
                          onResize={(ds, de) => onResize(project.id, ds, de)}
                          onStartRename={() => onStartRename(project.id)}
                          onCommitName={(name) => onCommitName(project.id, name)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Create zone */}
          <div className={`relative flex flex-1 ${readOnly ? "" : "cursor-cell"}`}>
            <div
              data-no-pan
              aria-hidden="true"
              className="sticky left-0 z-20 shrink-0 cursor-default bg-white"
              style={{ width: leftCol }}
            />
            {loaded && visibleCount === 0 && (
              <div
                className="pointer-events-none sticky flex items-center justify-center py-10"
                style={{ left: leftCol, width: `calc(100vw - ${leftCol}px)` }}
              >
                <p className="px-6 text-center text-sm text-mute">
                  {flatProjects.length === 0
                    ? "Double-cliquez dans la grille pour créer un premier projet."
                    : "Aucun projet ne correspond aux filtres."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute right-4 bottom-4 z-30 flex flex-col gap-1.5">
        <Tip label="Zoom avant (⌘ molette)" side="left">
          <button
            type="button"
            aria-label="Zoom avant"
            onClick={() => zoomBy(0.75)}
            className="flex size-8 items-center justify-center rounded-full bg-white text-ash shadow-float transition-transform outline -outline-offset-1 outline-black/8 hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </Tip>
        <Tip label="Zoom arrière" side="left">
          <button
            type="button"
            aria-label="Zoom arrière"
            onClick={() => zoomBy(1.333)}
            className="flex size-8 items-center justify-center rounded-full bg-white text-ash shadow-float transition-transform outline -outline-offset-1 outline-black/8 hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
              <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </Tip>
      </div>
    </div>
  );
});

export default Gantt;
