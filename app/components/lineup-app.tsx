"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Person, Project, Status } from "@/lib/types";
import { createStore, type Store, type StoreData } from "@/lib/store";
import { getSupabase } from "@/lib/supabase-client";
import {
  clamp,
  dayIndex,
  daysInRange,
  isoFromDay,
  shiftIso,
  todayIso,
} from "@/lib/dates";
import { celebrateAt } from "@/lib/motion";
import AppHeader from "@/components/app-header";
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

export default function LineupApp() {
  const [store] = useState<Store>(createStore);
  const [rangeStartYear] = useState(() => new Date().getFullYear() - 1);

  const [data, setData] = useState<StoreData>({ projects: [], people: [] });
  const [loaded, setLoaded] = useState(false);
  const [filterPerson, setFilterPerson] = useState("");
  const [filterStatus, setFilterStatus] = useState<Status | "">("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [bornId, setBornId] = useState<string | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const [centerLabel, setCenterLabel] = useState("");

  const ganttRef = useRef<GanttHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  /* ----- project actions, all optimistic ----- */

  const persist = useCallback(
    (op: () => Promise<void>) => {
      op().catch(() => {
        setToast({ message: "Échec de la synchronisation" });
        void reload();
      });
    },
    [reload],
  );

  const upsertLocal = useCallback((p: Project) => {
    setData((d) => {
      const i = d.projects.findIndex((x) => x.id === p.id);
      const projects =
        i >= 0
          ? d.projects.map((x) => (x.id === p.id ? p : x))
          : [...d.projects, p];
      return { ...d, projects };
    });
  }, []);

  const createProject = useCallback(
    (startDay: number, personId: string | null) => {
      const total = daysInRange(rangeStartYear, YEAR_COUNT);
      const start = clamp(startDay, 0, total - NEW_PROJECT_DAYS);
      const project: Project = {
        id: crypto.randomUUID(),
        name: "",
        start_date: isoFromDay(rangeStartYear, start),
        end_date: isoFromDay(rangeStartYear, start + NEW_PROJECT_DAYS - 1),
        status: "devise",
        person_id: personId,
      };
      upsertLocal(project);
      setSelectedId(project.id);
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
      persist(() => store.upsertProject(project));
    },
    [rangeStartYear, store, upsertLocal, persist],
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

  const updateProject = useCallback(
    (p: Project) => {
      upsertLocal(p);
      persist(() => store.upsertProject(p));
    },
    [store, upsertLocal, persist],
  );

  const commitName = useCallback(
    (id: string, name: string) => {
      const project = data.projects.find((p) => p.id === id);
      if (!project) return;
      const trimmed = name.trim();
      if (!trimmed) {
        // a nameless new project dies quietly
        setData((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== id) }));
        persist(() => store.deleteProject(id));
      } else {
        updateProject({ ...project, name: trimmed });
      }
      setEditingId(null);
    },
    [data.projects, store, updateProject, persist],
  );

  const setStatus = useCallback(
    (id: string, status: Status, origin?: { x: number; y: number }) => {
      const project = data.projects.find((p) => p.id === id);
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
    [data.projects, updateProject],
  );

  const assignPerson = useCallback(
    (id: string, personId: string | null) => {
      const project = data.projects.find((p) => p.id === id);
      if (!project) return;
      updateProject({ ...project, person_id: personId });
    },
    [data.projects, updateProject],
  );

  const removeProject = useCallback(
    (id: string) => {
      const project = data.projects.find((p) => p.id === id);
      if (!project) return;
      setData((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== id) }));
      setPopover(null);
      setSelectedId(null);
      persist(() => store.deleteProject(id));
      setToast({
        message: "Projet supprimé",
        actionLabel: "Annuler",
        onAction: () => {
          upsertLocal(project);
          persist(() => store.upsertProject(project));
        },
      });
    },
    [data.projects, store, upsertLocal, persist],
  );

  const addPerson = useCallback(
    (name: string) => {
      const person: Person = { id: crypto.randomUUID(), name: name.trim(), avatar: null };
      if (!person.name) return;
      setData((d) => ({ ...d, people: [...d.people, person] }));
      persist(() => store.addPerson(person));
    },
    [store, persist],
  );

  const removePerson = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        people: d.people.filter((p) => p.id !== id),
        projects: d.projects.map((p) =>
          p.person_id === id ? { ...p, person_id: null } : p,
        ),
      }));
      if (filterPerson === id) setFilterPerson("");
      persist(() => store.deletePerson(id));
    },
    [store, persist, filterPerson],
  );

  /* ----- keyboard ----- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.repeat) {
        if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          addProjectAtCenter(null);
          return;
        }
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.select();
          return;
        }
      }
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";
      if (e.key === "Escape") {
        setPopover(null);
        if (!typing) setSelectedId(null);
        return;
      }
      if (typing || editingId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeProject(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, editingId, removeProject, addProjectAtCenter]);

  /* ----- derived ----- */

  const groups = useMemo<GanttGroup[]>(() => {
    const total = daysInRange(rangeStartYear, YEAR_COUNT);
    const inRange = data.projects.filter(
      (p) =>
        dayIndex(p.end_date, rangeStartYear) >= 0 &&
        dayIndex(p.start_date, rangeStartYear) < total,
    );
    const byStart = (a: Project, b: Project) =>
      a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name);
    const peopleIds = new Set(data.people.map((p) => p.id));
    const result: GanttGroup[] = data.people.map((person) => ({
      key: person.id,
      person,
      projects: inRange.filter((p) => p.person_id === person.id).sort(byStart),
    }));
    const orphans = inRange
      .filter((p) => !p.person_id || !peopleIds.has(p.person_id))
      .sort(byStart);
    if (orphans.length > 0) {
      result.push({ key: "none", person: null, projects: orphans });
    }
    return result;
  }, [data.projects, data.people, rangeStartYear]);

  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return new Set(
      groups
        .flatMap((g) => g.projects)
        .filter((p) => !filterPerson || p.person_id === filterPerson)
        .filter((p) => !filterStatus || p.status === filterStatus)
        .filter((p) => !q || p.name.toLowerCase().includes(q))
        .map((p) => p.id),
    );
  }, [groups, filterPerson, filterStatus, search]);

  const filtersActive = Boolean(filterPerson || filterStatus || search.trim());

  const popoverProject = popover
    ? (data.projects.find((p) => p.id === popover.projectId) ?? null)
    : null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <AppHeader
        centerLabel={centerLabel}
        onPrevMonth={() => ganttRef.current?.scrollByMonths(-1)}
        onNextMonth={() => ganttRef.current?.scrollByMonths(1)}
        onToday={() => ganttRef.current?.scrollToToday()}
        onAddProject={() => addProjectAtCenter(null)}
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
        search={search}
        localMode={store.mode === "local"}
        searchRef={searchRef}
        onFilterPerson={setFilterPerson}
        onFilterStatus={setFilterStatus}
        onSearch={setSearch}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
      />
      <Gantt
        ref={ganttRef}
        rangeStartYear={rangeStartYear}
        yearCount={YEAR_COUNT}
        groups={groups}
        visibleIds={visibleIds}
        filtersActive={filtersActive}
        closedGroups={closedGroups}
        selectedId={selectedId}
        editingId={editingId}
        bornId={bornId}
        loaded={loaded}
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
        onSelect={(id) => setSelectedId(id)}
        onOpenPopover={(projectId, x, y) => {
          setSelectedId(projectId);
          setPopover({ projectId, x, y });
        }}
        onDatesChange={(id, deltaStart, deltaEnd) => {
          const project = data.projects.find((p) => p.id === id);
          if (!project || (deltaStart === 0 && deltaEnd === 0)) return;
          updateProject({
            ...project,
            start_date: shiftIso(project.start_date, deltaStart),
            end_date: shiftIso(project.end_date, deltaEnd),
          });
        }}
        onStartRename={(id) => {
          setEditingId(id);
          setPopover(null);
        }}
        onCommitName={commitName}
        onCenterChange={setCenterLabel}
      />
      {popoverProject && popover && (
        <ProjectPopover
          project={popoverProject}
          people={data.people}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
          onStatus={(status, origin) => setStatus(popoverProject.id, status, origin)}
          onAssign={(personId) => assignPerson(popoverProject.id, personId)}
          onRename={() => {
            setEditingId(popoverProject.id);
            setPopover(null);
          }}
          onDelete={() => removeProject(popoverProject.id)}
        />
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </main>
  );
}
