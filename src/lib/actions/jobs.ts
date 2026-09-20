"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error: string | null;
  conflict?: boolean;
}

function friendlyError(message: string): string {
  if (message === "ACTIVE_TIMER_EXISTS") {
    return "A job is already in progress. Finish or reschedule it first.";
  }
  if (message === "DATE_CONFLICT") {
    return "CONFLICT";
  }
  return message;
}

export interface RecentOccurrence {
  id: string;
  scheduledDate: string;
  status: string;
  priceCents: number;
}

/**
 * The most recent visits on the same recurring schedule that actually fall
 * before this one on the calendar, for the job detail view. Ordered and
 * filtered by scheduled_date (the real, current calendar date), not
 * original_service_date -- a job that was moved keeps its original
 * identity for generation purposes, but "recent visits" should reflect
 * what actually happened in calendar time, not the abstract recurrence
 * slot it was generated from.
 */
export async function getRecentOccurrences(
  scheduleId: string,
  beforeDate: string,
  excludeJobId: string,
): Promise<RecentOccurrence[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, scheduled_date, status, price_cents")
    .eq("schedule_id", scheduleId)
    .neq("id", excludeJobId)
    .lt("scheduled_date", beforeDate)
    .order("scheduled_date", { ascending: false })
    .limit(5);

  return (data ?? []).map((j) => ({
    id: j.id,
    scheduledDate: j.scheduled_date,
    status: j.status,
    priceCents: j.price_cents,
  }));
}

export async function startJob(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_job", { p_job_id: jobId });
  revalidatePath("/");
  revalidatePath("/schedule");
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}

export async function completeJob(
  jobId: string,
  notes: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_job", {
    p_job_id: jobId,
    p_notes: notes || null,
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}

export async function completeJobManual(
  jobId: string,
  durationMinutes: number,
  reason: string,
  notes: string,
): Promise<ActionResult> {
  if (!reason.trim()) return { error: "A reason is required for a manual duration." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_job_manual", {
    p_job_id: jobId,
    p_duration_seconds: Math.round(durationMinutes * 60),
    p_reason: reason,
    p_notes: notes || null,
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}

export async function completeJobCorrected(
  jobId: string,
  minutes: number,
  reason: string,
  notes: string,
): Promise<ActionResult> {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { error: "Enter how many minutes you actually worked." };
  }
  if (!reason.trim()) return { error: "A reason is required to correct the time." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_job_corrected", {
    p_job_id: jobId,
    p_duration_seconds: Math.round(minutes * 60),
    p_reason: reason,
    p_notes: notes || null,
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}

export interface LastTimeEntry {
  id: string;
  durationSeconds: number;
}

/** The most recent closed time entry on a job -- the one a "correct the time" form edits. */
export async function getLastTimeEntry(jobId: string): Promise<LastTimeEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("id, duration_seconds")
    .eq("job_id", jobId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.duration_seconds === null) return null;
  return { id: data.id, durationSeconds: data.duration_seconds };
}

export async function correctTimeEntry(
  entryId: string,
  minutes: number,
  reason: string,
): Promise<ActionResult> {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { error: "Enter how many minutes you actually worked." };
  }
  if (!reason.trim()) return { error: "A reason is required to correct the time." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_time_entry", {
    p_entry_id: entryId,
    p_duration_seconds: Math.round(minutes * 60),
    p_reason: reason,
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/customers/[id]", "page");
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}

export async function moveJob(
  jobId: string,
  newDate: string,
  reason: string,
  confirmConflict: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_job", {
    p_job_id: jobId,
    p_new_date: newDate,
    p_reason: reason || null,
    p_confirm_conflict: confirmConflict,
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  if (error) {
    const friendly = friendlyError(error.message);
    if (friendly === "CONFLICT") return { error: null, conflict: true };
    return { error: friendly };
  }
  return { error: null };
}

export async function stopAndReschedule(
  jobId: string,
  newDate: string,
  reason: string,
  confirmConflict: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("stop_and_reschedule", {
    p_job_id: jobId,
    p_new_date: newDate,
    p_reason: reason || null,
    p_confirm_conflict: confirmConflict,
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  if (error) {
    const friendly = friendlyError(error.message);
    if (friendly === "CONFLICT") return { error: null, conflict: true };
    return { error: friendly };
  }
  return { error: null };
}

export async function skipJob(jobId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { error: "A reason is required to skip a visit." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("skip_job", {
    p_job_id: jobId,
    p_reason: reason,
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  if (error) return { error: friendlyError(error.message) };
  return { error: null };
}
