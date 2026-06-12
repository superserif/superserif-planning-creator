"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Person, Status } from "@/lib/types";
import { STATUSES, STATUS_ORDER } from "@/lib/types";
import Avatar from "@/components/avatar";
import MoonMoonIcon from "@/components/moonmoon-icon";

function Chevron() {
  return (
    <svg
      viewBox="0 0 8 5"
      width="8"
      height="5"
      fill="none"
      className="pointer-events-none col-start-2 row-start-1 place-self-center"
    >
      <path d="M.5.5 4 4 7.5.5" stroke="currentcolor" />
    </svg>
  );
}

const selectClasses =
  "col-span-full row-start-1 appearance-none rounded-lg bg-transparent py-2 pr-8 pl-3 text-base/6 sm:py-1.5 sm:text-sm/6 outline -outline-offset-1 outline-hairline focus-visible:outline-2 focus-visible:outline-ink";

export default function FilterBar({
  people,
  filterPerson,
  filterStatus,
  filterMoonmoon,
  onFilterMoonmoon,
  search,
  localMode,
  searchRef,
  onFilterPerson,
  onFilterStatus,
  onSearch,
  onAddPerson,
  onRemovePerson,
  onCapacityChange,
}: {
  people: Person[];
  filterPerson: string;
  filterStatus: Status | "";
  filterMoonmoon: boolean;
  onFilterMoonmoon: (on: boolean) => void;
  search: string;
  localMode: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onFilterPerson: (id: string) => void;
  onFilterStatus: (s: Status | "") => void;
  onSearch: (q: string) => void;
  onAddPerson: (name: string) => void;
  onRemovePerson: (id: string) => void;
  onCapacityChange: (id: string, capacity: number) => void;
}) {
  const [peopleOpen, setPeopleOpen] = useState(false);
  const hasFilter = Boolean(filterPerson || filterStatus || filterMoonmoon || search.trim());

  return (
    <div className="relative flex shrink-0 flex-wrap items-center gap-2 border-b border-black/8 px-4 py-2.5 sm:px-6">
      <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
        <select
          name="filter-person"
          aria-label="Filtrer par personne"
          value={filterPerson}
          onChange={(e) => onFilterPerson(e.target.value)}
          className={selectClasses}
        >
          <option value="">Toutes les personnes</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Chevron />
      </span>

      <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
        <select
          name="filter-status"
          aria-label="Filtrer par statut"
          value={filterStatus}
          onChange={(e) => onFilterStatus(e.target.value as Status | "")}
          className={selectClasses}
        >
          <option value="">Tous les statuts</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUSES[s].label}
            </option>
          ))}
        </select>
        <Chevron />
      </span>

      <button
        type="button"
        aria-pressed={filterMoonmoon}
        title="Uniquement les projets Moon-Moon"
        onClick={() => onFilterMoonmoon(!filterMoonmoon)}
        className={`flex items-center gap-1.5 rounded-lg py-2 pr-3 pl-2 text-base/6 transition-colors outline -outline-offset-1 focus-visible:outline-2 focus-visible:outline-ink sm:py-1.5 sm:text-sm/6 ${
          filterMoonmoon
            ? "bg-ink text-white outline-ink"
            : "outline-hairline hover:bg-cloud"
        }`}
      >
        <MoonMoonIcon className="size-4" />
        Moon-Moon
      </button>

      <div className="relative min-w-0 flex-1 max-sm:order-last max-sm:basis-full sm:max-w-64">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="pointer-events-none absolute top-1/2 left-3 size-4 shrink-0 -translate-y-1/2 stroke-mute"
        >
          <circle cx="7" cy="7" r="4.5" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          name="search"
          aria-label="Rechercher un projet"
          placeholder="Rechercher un projet"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded-full bg-transparent py-2 pr-12 pl-9 text-base/6 outline -outline-offset-1 outline-hairline placeholder:text-mute focus-visible:outline-2 focus-visible:outline-ink sm:py-1.5 sm:text-sm/6"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-sm px-1 font-sans text-[0.625rem] text-mute outline -outline-offset-1 outline-hairline max-sm:hidden">
          ⌘K
        </kbd>
      </div>

      {hasFilter && (
        <button
          type="button"
          onClick={() => {
            onFilterPerson("");
            onFilterStatus("");
            onFilterMoonmoon(false);
            onSearch("");
          }}
          className="rounded-lg px-2 py-1.5 text-sm text-ash hover:bg-cloud hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          Réinitialiser
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        {localMode && <p className="text-xs text-mute max-sm:hidden">Mode démo — local</p>}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPeopleOpen((o) => !o)}
            className="rounded-lg px-3 py-2 text-base/6 outline -outline-offset-1 outline-hairline hover:bg-cloud focus-visible:outline-2 focus-visible:outline-ink sm:py-1.5 sm:text-sm/6"
          >
            Le studio
          </button>
          {peopleOpen && (
            <PeoplePanel
              people={people}
              onAdd={onAddPerson}
              onRemove={onRemovePerson}
              onCapacityChange={onCapacityChange}
              onClose={() => setPeopleOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PeoplePanel({
  people,
  onAdd,
  onRemove,
  onCapacityChange,
  onClose,
}: {
  people: Person[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onCapacityChange: (id: string, capacity: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  const submit = () => {
    if (name.trim()) {
      onAdd(name);
      setName("");
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 z-50 mt-2 w-72 rounded-xl bg-white p-2 shadow-float"
    >
      <div className="flex items-baseline justify-between px-2 pt-1 pb-2">
        <p className="text-xs font-semibold text-ash">Le studio</p>
        <p className="text-[0.6875rem] text-mute">Projets max / période</p>
      </div>
      <ul role="list">
        {people.map((p) => (
          <li key={p.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Avatar person={p} className="size-6" />
            <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label={`Réduire la capacité de ${p.name}`}
                onClick={() => onCapacityChange(p.id, Math.max(1, p.capacity - 1))}
                className="flex size-5 items-center justify-center rounded-full text-ash hover:bg-cloud hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
              >
                <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                  <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <span className="w-4 text-center text-sm font-semibold tabular-nums">
                {p.capacity}
              </span>
              <button
                type="button"
                aria-label={`Augmenter la capacité de ${p.name}`}
                onClick={() => onCapacityChange(p.id, Math.min(8, p.capacity + 1))}
                className="flex size-5 items-center justify-center rounded-full text-ash hover:bg-cloud hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
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
            </span>
            <button
              type="button"
              aria-label={`Supprimer ${p.name}`}
              onClick={() => onRemove(p.id)}
              className="relative flex size-6 shrink-0 items-center justify-center rounded-full text-mute opacity-0 group-hover:opacity-100 hover:bg-cloud hover:text-alert focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ink"
            >
              <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                <path
                  d="m4.5 4.5 7 7m0-7-7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </li>
        ))}
        {people.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-mute">Personne pour l&rsquo;instant.</li>
        )}
      </ul>
      <div className="mt-1 flex gap-1.5 border-t border-black/6 p-2 pb-1">
        <input
          type="text"
          name="new-person"
          aria-label="Nom de la personne"
          placeholder="Ajouter une personne"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-base/6 outline -outline-offset-1 outline-hairline placeholder:text-mute focus-visible:outline-2 focus-visible:outline-ink sm:text-sm/6"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-lg px-2.5 py-1.5 text-sm font-semibold outline -outline-offset-1 outline-hairline hover:bg-cloud focus-visible:outline-2 focus-visible:outline-ink"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}
