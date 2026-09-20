import type { JobStatus } from "@/lib/supabase/types";

// Parses a "YYYY-MM-DD" business-date string into local Date parts and
// reads them back via local formatting methods -- self-consistent
// regardless of the viewer's browser timezone, instead of round-tripping
// through `new Date(iso)` (UTC) and a local formatter, which can shift the
// displayed date by a day.
export function formatDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatShortDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function tomorrowIso(fromIso: string): string {
  const d = new Date(`${fromIso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  scheduled: "bg-gray-100 text-gray-700",
  rescheduled: "bg-amber-100 text-amber-800",
  in_progress: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-400",
};

/** Solid color used for calendar chips/dots, where a soft badge background isn't visible enough. */
export const STATUS_DOT_CLASS: Record<JobStatus, string> = {
  scheduled: "bg-gray-400",
  rescheduled: "bg-amber-500",
  in_progress: "bg-(--color-primary)",
  completed: "bg-gray-300",
  cancelled: "bg-gray-200",
};

export const CHANGE_TYPE_LABEL: Record<string, string> = {
  move: "Moved",
  skip: "Skipped",
  complete: "Completed",
  timer_correction: "Manual time",
};
