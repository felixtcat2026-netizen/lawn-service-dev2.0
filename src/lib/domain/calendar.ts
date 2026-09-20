// Pure date-grid helpers for the Week/Day/Month schedule views. All dates
// are "YYYY-MM-DD" business-date strings (see recurrence.ts) -- these
// functions never touch a timezone-sensitive Date parse.

function partsOf(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

function toIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function addDaysIso(iso: string, days: number): string {
  const { year, month, day } = partsOf(iso);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addMonthsIso(iso: string, months: number): string {
  const { year, month, day } = partsOf(iso);
  const totalMonths = month - 1 + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1;
  const daysInTarget = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return toIso(targetYear, targetMonth, Math.min(day, daysInTarget));
}

/** 0 = Sunday .. 6 = Saturday, computed without any local-timezone Date parsing. */
export function weekdayOf(iso: string): number {
  const { year, month, day } = partsOf(iso);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfWeek(iso: string): string {
  return addDaysIso(iso, -weekdayOf(iso));
}

export function startOfMonth(iso: string): string {
  const { year, month } = partsOf(iso);
  return toIso(year, month, 1);
}

/** Every date in the Sun-Sat week containing iso. */
export function weekDates(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
}

/**
 * A 6-row x 7-col month grid (42 days) starting on the Sunday on/before the
 * 1st and ending enough days later to fill full weeks -- the standard
 * calendar-app layout, including leading/trailing days from adjacent months.
 */
export function monthGridDates(monthIso: string): string[] {
  const firstOfMonth = startOfMonth(monthIso);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDaysIso(gridStart, i));
}

export function isSameMonth(iso: string, monthIso: string): boolean {
  const a = partsOf(iso);
  const b = partsOf(monthIso);
  return a.year === b.year && a.month === b.month;
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
