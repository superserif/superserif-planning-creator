"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { animate, stagger } from "animejs";
import type { Person, Project } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import {
  clamp,
  dayIndex,
  daysInRange,
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

const VISIBLE_DAYS = 91; // default zoom: three months across the viewport
const MONTH_DAYS = 30.44;

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
    selectedId: string | null;
    editingId: string | null;
    bornId: string | null;
    loaded: boolean;
    onToggleGroup: (key: string) => void;
    onBornConsumed: () => void;
    onCreate: (day: number, personId: string | null) => void;
    onSelect: (id: string) => void;
    onOpenPopover: (id: string, x: number, y: number) => void;
    onDatesChange: (id: string, deltaStart: number, deltaEnd: number) => void;
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
    selectedId,
    editingId,
    bornId,
    loaded,
    onToggleGroup,
    onBornConsumed,
    onCreate,
    onSelect,
    onOpenPopover,
    onDatesChange,
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
  const groupRefs = useRef(new Map<string, HTMLDivElement>());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevTopsRef = useRef(new Map<string, number>());
  const enteredRef = useRef(false);
  const initialScrollRef = useRef(false);
  const centerDayRef = useRef(todayIdx);
  const panRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const [dims, setDims] = useState({ dayWidth: 0, leftCol: 256 });
  const [panning, setPanning] = useState(false);
  const [viewWin, setViewWin] = useState<{ a: number; b: number } | null>(null);

  const { dayWidth, leftCol } = dims;
  const totalWidth = totalDays * dayWidth;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const lc = window.matchMedia("(min-width: 640px)").matches ? 256 : 160;
      setDims({ dayWidth: Math.max(2, (el.clientWidth - lc) / VISIBLE_DAYS), leftCol: lc });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

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
        scrollerRef.current?.scrollBy({ left: n * MONTH_DAYS * dayWidth, behavior: "smooth" }),
      getCenterDay: () => centerDayRef.current,
    }),
    [scrollToDay, todayIdx, dayWidth],
  );

  /* Initial position: today at the center of a three-month window.
     On later zoom changes (viewport resize), stay anchored on the same day. */
  useLayoutEffect(() => {
    if (dayWidth === 0) return;
    if (!initialScrollRef.current) {
      initialScrollRef.current = true;
      centerDayRef.current = todayIdx;
      onCenterChange(formatMonthYear(rangeStartYear, todayIdx), todayIdx);
    }
    scrollToDay(centerDayRef.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayWidth, leftCol]);

  const computeViewWin = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || dayWidth === 0) return;
    const a = clamp(Math.floor(el.scrollLeft / dayWidth), 0, totalDays - 1);
    const b = clamp(
      Math.ceil((el.scrollLeft + el.clientWidth - leftCol) / dayWidth),
      0,
      totalDays - 1,
    );
    setViewWin((prev) => (prev && prev.a === a && prev.b === b ? prev : { a, b }));
  }, [dayWidth, leftCol, totalDays]);

  useEffect(() => {
    computeViewWin();
  }, [computeViewWin]);

  const handleScroll = () => {
    requestAnimationFrame(() => {
      const day = centerDay();
      if (day !== centerDayRef.current) {
        centerDayRef.current = day;
        onCenterChange(formatMonthYear(rangeStartYear, day), day);
      }
      computeViewWin();
    });
  };

  /* Entrance: groups rise once */
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

  /* Rows: duplicated projects share a name, and a line */
  const rowsOfGroup = (g: GanttGroup) => {
    const byName = new Map<string, Project[]>();
    for (const p of g.projects) {
      const arr = byName.get(p.name);
      if (arr) arr.push(p);
      else byName.set(p.name, [p]);
    }
    return [...byName.entries()].map(([name, cases]) => ({
      key: `${g.key}::${name || "__untitled"}`,
      name,
      cases,
    }));
  };

  const flatProjects = groups.flatMap((g) => g.projects);
  const flatRowKeys = groups.flatMap((g) => rowsOfGroup(g).map((r) => r.key));

  /* FLIP: rows glide when their vertical position changes */
  useLayoutEffect(() => {
    const prev = prevTopsRef.current;
    const moved: { el: HTMLDivElement; delta: number }[] = [];
    for (const key of flatRowKeys) {
      const el = rowRefs.current.get(key);
      if (!el) continue;
      const before = prev.get(key);
      const after = el.offsetTop;
      if (before !== undefined && before !== after && el.offsetHeight > 0) {
        moved.push({ el, delta: before - after });
      }
      prev.set(key, after);
    }
    for (const key of [...prev.keys()]) {
      if (!flatRowKeys.includes(key)) prev.delete(key);
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

  /* ----- pan by dragging the grid ----- */

  const onPanDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el || e.button !== 0 || e.pointerType !== "mouse") return;
    if ((e.target as HTMLElement).closest("[data-no-pan]")) return;
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
    const pan = panRef.current;
    const el = scrollerRef.current;
    if (!pan || !el) return;
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
    panRef.current = null;
    setPanning(false);
  };

  /* ----- create by double-click ----- */

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (editingId) return;
    const el = scrollerRef.current;
    if (!el) return;
    // resolve by coordinates: the pan's pointer capture retargets events
    // to the scroller, so e.target can't be trusted here
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!under || under.closest("[data-no-pan]")) return;
    const rect = el.getBoundingClientRect();
    const contentX = el.scrollLeft + (e.clientX - rect.left);
    if (contentX < leftCol) return;
    const day = clamp(Math.floor((contentX - leftCol) / dayWidth), 0, totalDays - 1);
    const groupKey = under.closest<HTMLElement>("[data-group]")?.dataset.group;
    onCreate(day, groupKey && groupKey !== "none" ? groupKey : null);
  };

  const visibleCount = flatProjects.filter((p) => visibleIds.has(p.id)).length;

  /* Capacity over the visible window, and over the window where a new project would land */
  const winStartIso = viewWin ? isoFromDay(rangeStartYear, viewWin.a) : null;
  const winEndIso = viewWin ? isoFromDay(rangeStartYear, viewWin.b) : null;
  const createStart = clamp(centerDayRef.current - 15, 0, totalDays - 30);
  const createStartIso = isoFromDay(rangeStartYear, createStart);
  const createEndIso = isoFromDay(rangeStartYear, createStart + 29);
  const people = groups.map((g) => g.person).filter((p): p is Person => p !== null);
  const studioPct =
    winStartIso && winEndIso
      ? studioLoadPct(flatProjects, people, winStartIso, winEndIso)
      : 0;

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      onPointerDown={onPanDown}
      onPointerMove={onPanMove}
      onPointerUp={onPanUp}
      onPointerCancel={onPanUp}
      onDoubleClick={handleDoubleClick}
      className={`flex-1 overflow-auto overscroll-none select-none ${panning ? "cursor-grabbing" : ""}`}
    >
      <div
        className="relative flex min-h-full flex-col"
        style={{ width: leftCol + totalWidth, minWidth: "100%" }}
      >
        {/* Month header */}
        <div className="sticky top-0 z-30 flex h-9 shrink-0 border-b border-black/8 bg-white">
          <p
            data-no-pan
            title="Charge du studio sur la période visible"
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
                <p className="text-xs font-medium whitespace-nowrap text-ash">{m.label}</p>
              </div>
            ))}
            <span
              aria-hidden="true"
              className="absolute -bottom-[3px] z-10 size-1.5 -translate-x-1/2 rounded-full bg-ink"
              style={{ left: (todayIdx + 0.5) * dayWidth }}
            />
          </div>
        </div>

        {/* Grid overlay — month tints, week ticks, today line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-9 z-0"
          style={{ left: leftCol, width: totalWidth }}
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
          {Array.from({ length: Math.floor((totalDays - 1) / 7) }, (_, i) => (
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
          <div
            className="absolute inset-y-0 w-px bg-ink/20"
            style={{ left: (todayIdx + 0.5) * dayWidth }}
          />
        </div>

        {/* Groups */}
        {groups.map((group) => {
          const open = !closedGroups.has(group.key);
          const groupVisible = group.projects.filter((p) => visibleIds.has(p.id));
          const groupShown = !filtersActive || groupVisible.length > 0;
          const load =
            group.person && winStartIso && winEndIso
              ? personLoad(flatProjects, group.person.id, winStartIso, winEndIso)
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
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={`${open ? "Replier" : "Déplier"} ${group.person?.name ?? "Non assigné"}`}
                    onClick={() => onToggleGroup(group.key)}
                    className="relative flex size-6 shrink-0 items-center justify-center rounded-full text-mute hover:bg-cloud hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
                    />
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
                  <Avatar person={group.person} className="size-7" />
                  <p
                    className={`min-w-0 truncate text-sm font-semibold ${group.person ? "" : "text-ash"}`}
                  >
                    {group.person?.name ?? "Non assigné"}
                  </p>
                  {group.person ? (
                    <span
                      title={`${load} projet${load > 1 ? "s" : ""} sur la période visible (max ${group.person.capacity})`}
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
                  <span className="group/plus relative shrink-0">
                    <button
                      type="button"
                      aria-label={`Nouveau projet — ${group.person?.name ?? "non assigné"}`}
                      aria-disabled={full}
                      title={full ? undefined : "Nouveau projet"}
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
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
                      />
                      <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                        <path
                          d="M8 3.5v9M3.5 8h9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    {full && (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute top-1/2 right-full z-30 mr-1.5 hidden -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover/plus:block"
                      >
                        Nombre de projets max atteint
                      </span>
                    )}
                  </span>
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
                          className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${STATUSES[p.status].mini}`}
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

              {/* Project rows — duplicated cases share a line */}
              {rowsOfGroup(group).map((row) => {
                const visible =
                  open && groupShown && row.cases.some((c) => visibleIds.has(c.id));
                const first = row.cases[0];
                const last = row.cases[row.cases.length - 1];
                const spec = STATUSES[first.status];
                const hasMoonmoon = row.cases.some((c) => c.moonmoon);
                return (
                  <div
                    key={row.key}
                    ref={(el) => {
                      if (el) rowRefs.current.set(row.key, el);
                      else rowRefs.current.delete(row.key);
                    }}
                    className={`flex overflow-clip transition-[height,opacity] duration-300 ${visible ? "h-12 opacity-100" : "h-0 opacity-0"}`}
                  >
                    <div
                      data-no-pan
                      className="group/row sticky left-0 z-20 flex shrink-0 items-center gap-2.5 border-b border-black/4 bg-white pr-3 pl-7 transition-colors hover:bg-cloud/70 sm:pl-12"
                      style={{ width: leftCol }}
                    >
                      <button
                        type="button"
                        aria-label={`Statut : ${spec.label}`}
                        title={spec.label}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          onOpenPopover(first.id, r.left, r.bottom + 6);
                        }}
                        className="relative size-2.5 shrink-0 rounded-full transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        <span className={`absolute inset-0 rounded-full ${spec.dot}`} />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
                        />
                      </button>
                      <p
                        className={`min-w-0 flex-1 truncate text-sm ${first.status === "archive" ? "text-mute" : ""}`}
                      >
                        {row.name || "Sans titre"}
                      </p>
                      {hasMoonmoon && <MoonMoonIcon className="size-4" />}
                      {row.cases.length > 1 && (
                        <span className="text-xs text-mute tabular-nums">
                          ×{row.cases.length}
                        </span>
                      )}
                      {/* hover actions, staggered in */}
                      <button
                        type="button"
                        aria-label={`Dupliquer ${row.name || "le projet"}`}
                        title="Dupliquer (⌘D)"
                        onClick={() => onDuplicate(last.id)}
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
                      <button
                        type="button"
                        aria-label={`Supprimer ${row.name || "le projet"}`}
                        title="Supprimer"
                        onClick={() => onRemoveMany(row.cases.map((c) => c.id))}
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
                    </div>
                    <div
                      className="relative border-b border-black/4"
                      style={{ width: totalWidth }}
                    >
                      {row.cases.map((project) => (
                        <GanttBar
                          key={project.id}
                          project={project}
                          person={group.person}
                          rangeStartYear={rangeStartYear}
                          totalDays={totalDays}
                          dayWidth={dayWidth}
                          selected={selectedId === project.id}
                          editing={editingId === project.id}
                          born={bornId === project.id}
                          onBornConsumed={onBornConsumed}
                          onSelect={() => onSelect(project.id)}
                          onOpenPopover={(x, y) => onOpenPopover(project.id, x, y)}
                          onDatesChange={(ds, de) => onDatesChange(project.id, ds, de)}
                          onStartRename={() => onStartRename(project.id)}
                          onCommitName={(name) => onCommitName(project.id, name)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Create zone */}
        <div className="relative flex flex-1 cursor-cell">
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
  );
});

export default Gantt;
