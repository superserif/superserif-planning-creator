"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Person, Project, Status } from "@/lib/types";
import { createStore, type Store, type StoreData } from "@/lib/store";
import { getSupabase } from "@/lib/supabase-client";
import { useReadOnly } from "@/lib/read-only";
import {
  clamp,
  dayIndex,
  daysInRange,
  formatDay,
  formatMonthYear,
  isoFromDay,
  monthSpansRange,
  shiftIso,
  todayIso,
} from "@/lib/dates";
import { isAtCapacity, studioLoadPct } from "@/lib/capacity";
import { celebrateAt } from "@/lib/motion";
import AppHeader, { type MonthOption, type OverloadAlert } from "@/components/app-header";
import FilterBar from "@/components/filter-bar";
import Gantt, { type GanttGroup, type GanttHandle } from "@/components/gantt";
import ProjectPopover from "@/components/project-popover";
import Toast, { type ToastState } from "@/components/toast";

const YEAR_COUNT = 3;
const NEW_PROJECT_DAYS = 30; // a new project spans one month

export interface PopoverState {
  projectId: string;
  x: number;
  y: number;
}

/** One atomic edit on the project list — before/after pairs, undoable. */
interface Change {
  id: string;
  before: Project | null;
  after: Project | null;
}

export default function LineupApp() {
  const [store] = useState<Store>(createStore);
  const [rangeStartYear] = useState(() => new Date().getFullYear() - 1);
  const readOnly = useReadOnly();

  const [data, setData] = useState<StoreData>({ projects: [], people: [] });
  const [loaded, setLoaded] = useState(false);
  const [filterPerson, setFilterPerson] = useState("");
  const [filterStatus, setFilterStatus] = useState<Status | "">("");
  const [filterMoonmoon, setFilterMoonmoon] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [bornId, setBornId] = useState<string | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const [centerLabel, setCenterLabel] = useState("");
  const [centerDay, setCenterDay] = useState(0);
  const [viewMode, setViewMode] = useState<"members" | "projects">("members");

  const ganttRef = useRef<GanttHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const undoStackRef = useRef<Change[][]>([]);
  const redoStackRef = useRef<Change[][]>([]);

  const reload = useCallback(async () => {
    try {
      const next = await store.load();
      setData(next);
    } catch {
      setToast({ message: "Impossible de charger les données" });
    }
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoaded(true);
      })
      .catch(() => setToast({ message: "Impossible de charger les données" }));
    const unsubscribe = store.subscribe(() => {
      void reload();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store, reload]);

  /* ----- the single mutation path: optimistic, persisted, undoable ----- */

  const persist = useCallback(
    (op: () => Promise<void>) => {
      op().catch(() => {
        setToast({ message: "Échec de la synchronisation" });
        void reload();
      });
    },
    [reload],
  );

  const commit = useCallback(
    (changes: Change[], record = true) => {
      if (changes.length === 0) return;
      setData((d) => {
        let projects = d.projects;
        for (const c of changes) {
          projects = projects.filter((p) => p.id !== c.id);
          if (c.after) projects = [...projects, c.after];
        }
        return { ...d, projects };
      });
      persist(async () => {
        for (const c of changes) {
          if (c.after) await store.upsertProject(c.after);
          else await store.deleteProject(c.id);
        }
      });
      if (record) {
        undoStackRef.current.push(changes);
        if (undoStackRef.current.length > 100) undoStackRef.current.shift();
        redoStackRef.current = [];
      }
    },
    [store, persist],
  );

  const undo = useCallback(() => {
    const changes = undoStackRef.current.pop();
    if (!changes) return;
    commit(
      changes.map((c) => ({ id: c.id, before: c.after, after: c.before })),
      false,
    );
    redoStackRef.current.push(changes);
    setEditingId(null);
    setPopover(null);
  }, [commit]);

  const redo = useCallback(() => {
    const changes = redoStackRef.current.pop();
    if (!changes) return;
    commit(changes, false);
    undoStackRef.current.push(changes);
  }, [commit]);

  const findProject = useCallback(
    (id: string) => data.projects.find((p) => p.id === id),
    [data.projects],
  );

  const updateProject = useCallback(
    (after: Project) => {
      const before = findProject(after.id) ?? null;
      commit([{ id: after.id, before, after }]);
    },
    [findProject, commit],
  );

  /* ----- creation ----- */

  const capacityToast = useCallback((person: Person) => {
    setToast({
      message: `${person.name} a atteint son maximum sur cette période (${person.capacity})`,
    });
  }, []);

  const createRange = useCallback(
    (startDay: number, endDay: number, personId: string | null) => {
      const total = daysInRange(rangeStartYear, YEAR_COUNT);
      const start = clamp(Math.min(startDay, endDay), 0, total - 1);
      const end = clamp(Math.max(startDay, endDay), start, total - 1);
      const startIso = isoFromDay(rangeStartYear, start);
      const endIso = isoFromDay(rangeStartYear, end);
      if (personId) {
        const person = data.people.find((p) => p.id === personId);
        if (person && isAtCapacity(data.projects, person, startIso, endIso)) {
          capacityToast(person);
          return;
        }
      }
      const project: Project = {
        id: crypto.randomUUID(),
        name: "",
        start_date: startIso,
        end_date: endIso,
        status: "devise",
        assignees: personId ? [personId] : [],
        moonmoon: false,
        hours_done: 0,
        hours_total: null,
      };
      commit([{ id: project.id, before: null, after: project }]);
      setSelectedIds(new Set([project.id]));
      setEditingId(project.id);
      setBornId(project.id);
      setPopover(null);
      if (personId) {
        setClosedGroups((s) => {
          if (!s.has(personId)) return s;
          const next = new Set(s);
          next.delete(personId);
          return next;
        });
      }
    },
    [rangeStartYear, data.people, data.projects, commit, capacityToast],
  );

  const createProject = useCallback(
    (startDay: number, personId: string | null) =>
      createRange(startDay, startDay + NEW_PROJECT_DAYS - 1, personId),
    [createRange],
  );

  /** New project centered on the current view, one month long. */
  const addProjectAtCenter = useCallback(
    (personId: string | null = null) => {
      const center =
        ganttRef.current?.getCenterDay() ?? dayIndex(todayIso(), rangeStartYear);
      createProject(center - Math.floor(NEW_PROJECT_DAYS / 2), personId);
    },
    [createProject, rangeStartYear],
  );

  /* ----- edit actions ----- */

  const commitName = useCallback(
    (id: string, name: string) => {
      const project = findProject(id);
      if (!project) return;
      const trimmed = name.trim();
      if (!trimmed) {
        // a nameless new project dies quietly
        commit([{ id, before: project, after: null }]);
      } else if (trimmed !== project.name) {
        updateProject({ ...project, name: trimmed });
      }
      setEditingId(null);
    },
    [findProject, commit, updateProject],
  );

  const setStatus = useCallback(
    (id: string, status: Status, origin?: { x: number; y: number }) => {
      const project = findProject(id);
      if (!project || project.status === status) {
        setPopover(null);
        return;
      }
      updateProject({ ...project, status });
      setPopover(null);
      if (status === "termine" && origin) {
        void celebrateAt(origin.x, origin.y);
      }
    },
    [findProject, updateProject],
  );

  /** Add or remove one assignee — the task stays one block, shared. */
  const toggleAssignee = useCallback(
    (id: string, personId: string) => {
      const project = findProject(id);
      if (!project) return;
      if (project.assignees.includes(personId)) {
        updateProject({
          ...project,
          assignees: project.assignees.filter((a) => a !== personId),
        });
        return;
      }
      const person = data.people.find((p) => p.id === personId);
      if (
        person &&
        isAtCapacity(data.projects, person, project.start_date, project.end_date, id)
      ) {
        capacityToast(person);
        return;
      }
      updateProject({ ...project, assignees: [...project.assignees, personId] });
    },
    [findProject, data.people, data.projects, updateProject, capacityToast],
  );

  const setHours = useCallback(
    (id: string, done: number | null, total: number | null) => {
      const project = findProject(id);
      if (!project) return;
      updateProject({ ...project, hours_done: done ?? 0, hours_total: total });
    },
    [findProject, updateProject],
  );

  const toggleMoonmoon = useCallback(
    (id: string) => {
      const project = findProject(id);
      if (!project) return;
      updateProject({ ...project, moonmoon: !project.moonmoon });
    },
    [findProject, updateProject],
  );

  /** Duplicate: the copy lands right after the original, on its own row. */
  const duplicateProject = useCallback(
    (id: string) => {
      const project = findProject(id);
      if (!project) return;
      const duration =
        dayIndex(project.end_date, rangeStartYear) -
        dayIndex(project.start_date, rangeStartYear) +
        1;
      const start = shiftIso(project.end_date, 2);
      const end = shiftIso(start, duration - 1);
      for (const assigneeId of project.assignees) {
        const person = data.people.find((p) => p.id === assigneeId);
        if (person && isAtCapacity(data.projects, person, start, end)) {
          capacityToast(person);
          return;
        }
      }
      const copy: Project = {
        ...project,
        id: crypto.randomUUID(),
        start_date: start,
        end_date: end,
      };
      commit([{ id: copy.id, before: null, after: copy }]);
      setSelectedIds(new Set([copy.id]));
      setBornId(copy.id);
      setPopover(null);
    },
    [findProject, data.people, data.projects, rangeStartYear, commit, capacityToast],
  );

  const removeProjects = useCallback(
    (ids: string[]) => {
      const removed = data.projects.filter((p) => ids.includes(p.id));
      if (removed.length === 0) return;
      commit(removed.map((p) => ({ id: p.id, before: p, after: null })));
      setPopover(null);
      setSelectedIds(new Set());
      setToast({
        message:
          removed.length > 1 ? `${removed.length} projets supprimés` : "Projet supprimé",
        actionLabel: "Annuler",
        onAction: undo,
      });
    },
    [data.projects, commit, undo],
  );

  /** End of a bar drag: shift dates (batch when multi-selected), maybe reassign. */
  const handleMoveDrop = useCallback(
    (id: string, delta: number, targetGroupKey: string | null, sourceGroupKey: string) => {
      const project = findProject(id);
      if (!project) return;

      // vertical reassign only makes sense between member groups
      const sourceIsPerson = data.people.some((p) => p.id === sourceGroupKey);
      const targetPerson =
        targetGroupKey && targetGroupKey !== "none"
          ? (data.people.find((p) => p.id === targetGroupKey) ?? null)
          : null;
      const dropToNone = targetGroupKey === "none" && sourceIsPerson;
      const dropToOther =
        targetPerson !== null &&
        sourceIsPerson &&
        targetPerson.id !== sourceGroupKey &&
        !project.assignees.includes(targetPerson.id);

      if (dropToNone || dropToOther) {
        const start = shiftIso(project.start_date, delta);
        const end = shiftIso(project.end_date, delta);
        if (dropToOther) {
          if (isAtCapacity(data.projects, targetPerson, start, end, id)) {
            capacityToast(targetPerson);
            return; // the bar springs back
          }
        }
        const assignees = dropToNone
          ? project.assignees.filter((a) => a !== sourceGroupKey)
          : project.assignees.map((a) => (a === sourceGroupKey ? targetPerson!.id : a));
        updateProject({ ...project, start_date: start, end_date: end, assignees });
        return;
      }

      if (delta === 0) return;
      const batch =
        selectedIds.has(id) && selectedIds.size > 1 ? [...selectedIds] : [id];
      const changes: Change[] = [];
      for (const pid of batch) {
        const p = findProject(pid);
        if (!p) continue;
        changes.push({
          id: pid,
          before: p,
          after: {
            ...p,
            start_date: shiftIso(p.start_date, delta),
            end_date: shiftIso(p.end_date, delta),
          },
        });
      }
      commit(changes);
    },
    [findProject, data.people, data.projects, selectedIds, updateProject, commit, capacityToast],
  );

  const handleResize = useCallback(
    (id: string, deltaStart: number, deltaEnd: number) => {
      const project = findProject(id);
      if (!project || (deltaStart === 0 && deltaEnd === 0)) return;
      updateProject({
        ...project,
        start_date: shiftIso(project.start_date, deltaStart),
        end_date: shiftIso(project.end_date, deltaEnd),
      });
    },
    [findProject, updateProject],
  );

  const toggleSelect = useCallback((id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      // grabbing an already-selected bar keeps the batch (for block moves)
      return prev.has(id) ? prev : new Set([id]);
    });
    if (additive) setPopover(null);
  }, []);

  /* ----- people ----- */

  const addPerson = useCallback(
    (name: string) => {
      const person: Person = {
        id: crypto.randomUUID(),
        name: name.trim(),
        avatar: null,
        capacity: 3,
      };
      if (!person.name) return;
      setData((d) => ({ ...d, people: [...d.people, person] }));
      persist(() => store.addPerson(person));
    },
    [store, persist],
  );

  const changeCapacity = useCallback(
    (id: string, capacity: number) => {
      const person = data.people.find((p) => p.id === id);
      if (!person || person.capacity === capacity) return;
      const next = { ...person, capacity };
      setData((d) => ({
        ...d,
        people: d.people.map((p) => (p.id === id ? next : p)),
      }));
      persist(() => store.updatePerson(next));
    },
    [data.people, store, persist],
  );

  const removePerson = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        people: d.people.filter((p) => p.id !== id),
        projects: d.projects.map((p) => ({
          ...p,
          assignees: p.assignees.filter((a) => a !== id),
        })),
      }));
      if (filterPerson === id) setFilterPerson("");
      persist(() => store.deletePerson(id));
    },
    [store, persist, filterPerson],
  );

  /* ----- share link ----- */

  const shareLink = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: row, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "share_secret")
      .single();
    if (error || !row) {
      setToast({ message: "Impossible de générer le lien" });
      return;
    }
    const url = `${window.location.origin}/?partage=${encodeURIComponent(btoa(row.value))}`;
    await navigator.clipboard.writeText(url);
    setToast({ message: "Lien de lecture seule copié" });
  }, []);

  /* ----- keyboard ----- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";
      if ((e.metaKey || e.ctrlKey) && !e.repeat && !typing) {
        const key = e.key.toLowerCase();
        if (key === "p" && !readOnly) {
          e.preventDefault();
          addProjectAtCenter(null);
          return;
        }
        if (key === "k") {
          e.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.select();
          return;
        }
        if (key === "d" && !readOnly && selectedIds.size > 0) {
          e.preventDefault();
          [...selectedIds].forEach((id) => duplicateProject(id));
          return;
        }
        if (key === "z" && !readOnly) {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
      }
      if (e.key === "Escape") {
        setPopover(null);
        if (!typing) setSelectedIds(new Set());
        return;
      }
      if (typing || editingId || readOnly) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        e.preventDefault();
        removeProjects([...selectedIds]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedIds,
    editingId,
    readOnly,
    removeProjects,
    addProjectAtCenter,
    duplicateProject,
    undo,
    redo,
  ]);

  /* ----- derived ----- */

  const inRangeProjects = useMemo(() => {
    const total = daysInRange(rangeStartYear, YEAR_COUNT);
    const byStart = (a: Project, b: Project) =>
      a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name);
    return data.projects
      .filter(
        (p) =>
          dayIndex(p.end_date, rangeStartYear) >= 0 &&
          dayIndex(p.start_date, rangeStartYear) < total,
      )
      .sort(byStart);
  }, [data.projects, rangeStartYear]);

  const groups = useMemo<GanttGroup[]>(() => {
    if (viewMode === "projects") {
      // one group per project; its rows are the assignees
      return inRangeProjects.map((p) => ({
        key: p.id,
        person: null,
        projects: [p],
      }));
    }
    const peopleIds = new Set(data.people.map((p) => p.id));
    const result: GanttGroup[] = data.people.map((person) => ({
      key: person.id,
      person,
      projects: inRangeProjects.filter((p) => p.assignees.includes(person.id)),
    }));
    const orphans = inRangeProjects.filter(
      (p) => !p.assignees.some((a) => peopleIds.has(a)),
    );
    if (orphans.length > 0) {
      result.push({ key: "none", person: null, projects: orphans });
    }
    return result;
  }, [viewMode, inRangeProjects, data.people]);

  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return new Set(
      inRangeProjects
        .filter((p) => !filterPerson || p.assignees.includes(filterPerson))
        .filter((p) => !filterStatus || p.status === filterStatus)
        .filter((p) => !filterMoonmoon || p.moonmoon)
        .filter((p) => !q || p.name.toLowerCase().includes(q))
        .map((p) => p.id),
    );
  }, [inRangeProjects, filterPerson, filterStatus, filterMoonmoon, search]);

  const peopleById = useMemo(
    () => new Map(data.people.map((p) => [p.id, p])),
    [data.people],
  );

  /* Auto-start: a "Non démarré" whose start day has arrived becomes "En cours". */
  useEffect(() => {
    if (!loaded || readOnly) return;
    const today = todayIso();
    const due = data.projects.filter(
      (p) => p.status === "devise" && p.start_date <= today,
    );
    if (due.length === 0) return;
    const t = setTimeout(() => {
      commit(
        due.map((p) => ({
          id: p.id,
          before: p,
          after: { ...p, status: "demarre" as Status },
        })),
        false,
      );
      setToast({
        message:
          due.length > 1
            ? `${due.length} projets passés En cours (date de début atteinte)`
            : `« ${due[0].name || "Sans titre"} » passé En cours (date de début atteinte)`,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [loaded, readOnly, data.projects, commit]);

  const filtersActive = Boolean(
    filterPerson || filterStatus || filterMoonmoon || search.trim(),
  );

  const months = useMemo<MonthOption[]>(
    () =>
      monthSpansRange(rangeStartYear, YEAR_COUNT).map((m) => ({
        label: formatMonthYear(rangeStartYear, m.startDay),
        index: m.monthIndex,
        day: m.startDay + Math.floor(m.days / 2),
      })),
    [rangeStartYear],
  );

  const currentMonthIndex = useMemo(() => {
    const spans = monthSpansRange(rangeStartYear, YEAR_COUNT);
    const span = spans.find(
      (m) => centerDay >= m.startDay && centerDay < m.startDay + m.days,
    );
    return span?.monthIndex ?? 12;
  }, [rangeStartYear, centerDay]);

  /** Delivered this calendar year — feeds the header odometer. */
  const delivered = useMemo(() => {
    const year = String(rangeStartYear + 1);
    return data.projects.filter(
      (p) => p.status === "termine" && p.end_date.startsWith(year),
    ).length;
  }, [data.projects, rangeStartYear]);

  /** Worst week over the next 12 — the overload warning next to the logo. */
  const overload = useMemo<OverloadAlert | null>(() => {
    const start = dayIndex(todayIso(), rangeStartYear);
    let worst: OverloadAlert | null = null;
    for (let w = 0; w < 12; w++) {
      const a = start + w * 7;
      const pct = studioLoadPct(
        data.projects,
        data.people,
        isoFromDay(rangeStartYear, a),
        isoFromDay(rangeStartYear, a + 6),
      );
      if (pct > 90 && (!worst || pct > worst.pct)) {
        worst = {
          pct,
          day: a,
          label: `Semaine du ${formatDay(isoFromDay(rangeStartYear, a))} — ${pct} %`,
        };
      }
    }
    return worst;
  }, [data.projects, data.people, rangeStartYear]);

  const popoverProject = popover
    ? (data.projects.find((p) => p.id === popover.projectId) ?? null)
    : null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <AppHeader
        centerLabel={centerLabel}
        months={months}
        currentMonthIndex={currentMonthIndex}
        delivered={delivered}
        overload={overload}
        readOnly={readOnly}
        onOverloadClick={(day) => ganttRef.current?.scrollToDay(day)}
        onPickMonth={(day) => ganttRef.current?.scrollToDay(day)}
        onPrevMonth={() => ganttRef.current?.scrollByMonths(-1)}
        onNextMonth={() => ganttRef.current?.scrollByMonths(1)}
        onToday={() => ganttRef.current?.scrollToToday()}
        onAddProject={readOnly ? undefined : () => addProjectAtCenter(null)}
        onShare={store.mode === "supabase" && !readOnly ? () => void shareLink() : undefined}
        onLogout={
          store.mode === "supabase"
            ? () => void getSupabase()?.auth.signOut()
            : undefined
        }
      />
      <FilterBar
        people={data.people}
        filterPerson={filterPerson}
        filterStatus={filterStatus}
        filterMoonmoon={filterMoonmoon}
        onFilterMoonmoon={setFilterMoonmoon}
        search={search}
        localMode={store.mode === "local"}
        readOnly={readOnly}
        searchRef={searchRef}
        onFilterPerson={setFilterPerson}
        onFilterStatus={setFilterStatus}
        onSearch={setSearch}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onCapacityChange={changeCapacity}
      />
      <Gantt
        ref={ganttRef}
        rangeStartYear={rangeStartYear}
        yearCount={YEAR_COUNT}
        mode={viewMode}
        onModeChange={setViewMode}
        peopleById={peopleById}
        groups={groups}
        visibleIds={visibleIds}
        filtersActive={filtersActive}
        closedGroups={closedGroups}
        selectedIds={selectedIds}
        editingId={editingId}
        bornId={bornId}
        loaded={loaded}
        readOnly={readOnly}
        onToggleGroup={(key) =>
          setClosedGroups((s) => {
            const next = new Set(s);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          })
        }
        onBornConsumed={() => setBornId(null)}
        onCreate={createProject}
        onCreateRange={createRange}
        onToggleSelect={toggleSelect}
        onOpenPopover={(projectId, x, y) => {
          if (readOnly) return;
          setSelectedIds((prev) => (prev.has(projectId) ? prev : new Set([projectId])));
          setPopover({ projectId, x, y });
        }}
        onMoveDrop={handleMoveDrop}
        onResize={handleResize}
        onStartRename={(id) => {
          setEditingId(id);
          setPopover(null);
        }}
        onDuplicate={duplicateProject}
        onRemoveMany={removeProjects}
        onCommitName={commitName}
        onCenterChange={(label, day) => {
          setCenterLabel(label);
          setCenterDay(day);
        }}
      />
      {popoverProject && popover && !readOnly && (
        <ProjectPopover
          project={popoverProject}
          people={data.people}
          isPersonFull={(personId) => {
            const person = data.people.find((p) => p.id === personId);
            return person
              ? isAtCapacity(
                  data.projects,
                  person,
                  popoverProject.start_date,
                  popoverProject.end_date,
                  popoverProject.id,
                )
              : false;
          }}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
          onStatus={(status, origin) => setStatus(popoverProject.id, status, origin)}
          onToggleAssignee={(personId) => toggleAssignee(popoverProject.id, personId)}
          onSetHours={(done, total) => setHours(popoverProject.id, done, total)}
          onDuplicate={() => duplicateProject(popoverProject.id)}
          onToggleMoonmoon={() => toggleMoonmoon(popoverProject.id)}
          onDelete={() => removeProjects([popoverProject.id])}
        />
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </main>
  );
}
