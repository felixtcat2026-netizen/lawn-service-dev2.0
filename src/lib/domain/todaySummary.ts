import type { JobStatus } from "@/lib/supabase/types";

export interface DayJob {
  status: JobStatus;
  priceCents: number;
}

export interface DaySummary {
  /** Everything planned for today, including jobs that were moved off it. */
  scheduledCents: number;
  earnedCents: number;
  workingCents: number;
  movedCents: number;
  todoCents: number;
}

/**
 * Splits today's planned dollars into earned / in progress / moved to
 * another day / still to do. movedCents covers jobs that were on today's
 * plan but are no longer on today's date, so the owner can see why earned
 * is lower than scheduled instead of wondering where the money went.
 */
export function summarizeDay(todayJobs: DayJob[], movedCents: number): DaySummary {
  let todayTotal = 0;
  let earnedCents = 0;
  let workingCents = 0;
  for (const job of todayJobs) {
    todayTotal += job.priceCents;
    if (job.status === "completed") earnedCents += job.priceCents;
    else if (job.status === "in_progress") workingCents += job.priceCents;
  }
  return {
    scheduledCents: todayTotal + movedCents,
    earnedCents,
    workingCents,
    movedCents,
    todoCents: todayTotal - earnedCents - workingCents,
  };
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
