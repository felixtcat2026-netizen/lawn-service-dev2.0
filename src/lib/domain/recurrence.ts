import type { RecurrenceType } from "@/lib/supabase/types";

// Mirrors the occurrence math in supabase/migrations/0002_functions.sql
// (generate_jobs_for_schedule). Kept as plain, dependency-free date-string
// arithmetic (YYYY-MM-DD) so it matches Postgres `date` semantics exactly
// and has no timezone-conversion surprises of its own -- the caller is
// responsible for resolving "today" in the business timezone first (see
// businessToday below) before passing dates in here.
//
// Used client-side for schedule previews ("next 3 visits") and unit
// tested directly; the database function is the actual source of truth
// for generated jobs.

function parseDate(iso: string): { year: number; month: number; day: number } {
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return { year, month, day };
}

function toIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-indexed; day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(iso: string, days: number): string {
  const { year, month, day } = parseDate(iso);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Monthly occurrence for a given month offset from the anchor's month,
 * clamped to the last day of a short month and returning to the original
 * day once that day exists again. Monthly is NOT "every 4 weeks."
 */
function monthlyOccurrence(startIso: string, monthOffset: number): string {
  const { year, month, day: anchorDay } = parseDate(startIso);
  const totalMonths = month - 1 + monthOffset;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const clampedDay = Math.min(anchorDay, daysInMonth(targetYear, targetMonth));
  return toIso(targetYear, targetMonth, clampedDay);
}

export interface ScheduleOccurrenceInput {
  startDate: string; // YYYY-MM-DD
  recurrence: RecurrenceType;
}

/**
 * All occurrence dates for a schedule from its start date through
 * (inclusive of) throughDate. Mirrors the database generator's window
 * logic, minus the "resume from cursor" part (the DB tracks that; this is
 * for preview/testing where the whole range is wanted).
 */
export function occurrencesThrough(
  schedule: ScheduleOccurrenceInput,
  throughDate: string,
): string[] {
  const { startDate, recurrence } = schedule;
  if (compareDates(startDate, throughDate) > 0) return [];

  const occurrences: string[] = [];

  if (recurrence === "one_time") {
    occurrences.push(startDate);
    return occurrences;
  }

  if (recurrence === "weekly" || recurrence === "biweekly") {
    const step = recurrence === "weekly" ? 7 : 14;
    let occurrence = startDate;
    while (compareDates(occurrence, throughDate) <= 0) {
      occurrences.push(occurrence);
      occurrence = addDays(occurrence, step);
    }
    return occurrences;
  }

  // monthly
  let monthOffset = 0;
  for (;;) {
    const occurrence = monthlyOccurrence(startDate, monthOffset);
    if (compareDates(occurrence, throughDate) > 0) break;
    if (compareDates(occurrence, startDate) >= 0) occurrences.push(occurrence);
    monthOffset += 1;
  }
  return occurrences;
}

/** The next N occurrence dates on/after fromDate (inclusive), for preview UI. */
export function nextOccurrences(
  schedule: ScheduleOccurrenceInput,
  fromDate: string,
  count: number,
): string[] {
  // Look far enough ahead to find `count` occurrences even for monthly
  // schedules; 2 years comfortably covers any V1 case.
  const lookahead = addDays(fromDate, 730);
  const all = occurrencesThrough(schedule, lookahead);
  return all.filter((d) => compareDates(d, fromDate) >= 0).slice(0, count);
}

/** "Today" as YYYY-MM-DD in the given IANA business timezone. */
export function businessToday(timezone: string, now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD.
  return formatter.format(now);
}
