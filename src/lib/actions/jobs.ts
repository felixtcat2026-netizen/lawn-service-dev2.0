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
