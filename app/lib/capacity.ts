import type { Person, Project } from "./types";

/** Statuses that count as workload — finished and archived work doesn't weigh. */
const ACTIVE = new Set(["devise", "demarre"]);

/**
 * Number of active projects of a person overlapping [startIso, endIso].
 * ISO date strings compare lexically, which is chronological.
 */
export function personLoad(
  projects: Project[],
  personId: string,
  startIso: string,
  endIso: string,
  excludeId?: string,
): number {
  return projects.filter(
    (p) =>
      p.assignees.includes(personId) &&
      p.id !== excludeId &&
      !p.holiday &&
      ACTIVE.has(p.status) &&
      p.start_date <= endIso &&
      p.end_date >= startIso,
  ).length;
}

/**
 * True when the person is on a holiday overlapping [startIso, endIso].
 * A holiday makes the person unavailable — no other task can be associated.
 */
export function isOnHoliday(
  projects: Project[],
  personId: string,
  startIso: string,
  endIso: string,
  excludeId?: string,
): boolean {
  return projects.some(
    (p) =>
      p.holiday === true &&
      p.assignees.includes(personId) &&
      p.id !== excludeId &&
      ACTIVE.has(p.status) &&
      p.start_date <= endIso &&
      p.end_date >= startIso,
  );
}

export function isAtCapacity(
  projects: Project[],
  person: Person,
  startIso: string,
  endIso: string,
  excludeId?: string,
): boolean {
  if (isOnHoliday(projects, person.id, startIso, endIso, excludeId)) return true;
  return personLoad(projects, person.id, startIso, endIso, excludeId) >= person.capacity;
}

/** Studio-wide load over a window, as a 0–100+ percentage of summed capacities. */
export function studioLoadPct(
  projects: Project[],
  people: Person[],
  startIso: string,
  endIso: string,
): number {
  const totalCapacity = people.reduce((sum, p) => sum + p.capacity, 0);
  if (totalCapacity === 0) return 0;
  const totalLoad = people.reduce(
    (sum, p) => sum + personLoad(projects, p.id, startIso, endIso),
    0,
  );
  return Math.round((totalLoad / totalCapacity) * 100);
}
