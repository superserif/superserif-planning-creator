export const MONTHS_FR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const DAY_MS = 86_400_000;

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeap(year) ? 366 : 365;
}

/** 0-based day index of an ISO date within `year`. Can be negative or ≥ daysInYear if outside. */
export function dayIndex(iso: string, year: number): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((t - Date.UTC(year, 0, 1)) / DAY_MS);
}

export function isoFromDay(year: number, day: number): string {
  return new Date(Date.UTC(year, 0, 1) + day * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Weekday of a day index within `year` — 0 = Sunday … 6 = Saturday. */
export function weekdayOfDay(year: number, day: number): number {
  return new Date(Date.UTC(year, 0, 1) + day * DAY_MS).getUTCDay();
}

export function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export interface MonthSpan {
  label: string;
  startDay: number;
  days: number;
  monthIndex: number;
}

/** Month spans over a multi-year range starting Jan 1 of `startYear`. */
export function monthSpansRange(startYear: number, yearCount: number): MonthSpan[] {
  const origin = Date.UTC(startYear, 0, 1);
  const spans: MonthSpan[] = [];
  for (let y = 0; y < yearCount; y++) {
    for (let m = 0; m < 12; m++) {
      const start = Math.round((Date.UTC(startYear + y, m, 1) - origin) / DAY_MS);
      const end = Math.round((Date.UTC(startYear + y, m + 1, 1) - origin) / DAY_MS);
      spans.push({
        label: m === 0 ? `${MONTHS_FR[m]} ${startYear + y}` : MONTHS_FR[m],
        startDay: start,
        days: end - start,
        monthIndex: y * 12 + m,
      });
    }
  }
  return spans;
}

export function daysInRange(startYear: number, yearCount: number): number {
  let total = 0;
  for (let y = 0; y < yearCount; y++) total += daysInYear(startYear + y);
  return total;
}

const monthYearFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonthYear(startYear: number, day: number): string {
  const label = monthYearFmt.format(new Date(Date.UTC(startYear, 0, 1) + day * DAY_MS));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDay(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00Z`));
}

export function todayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
