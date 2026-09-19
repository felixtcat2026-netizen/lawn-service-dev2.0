"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/org";
import { parsePriceToCents } from "@/lib/domain/money";
import type { RecurrenceType } from "@/lib/supabase/types";

export interface ActionResult {
  error: string | null;
}

const RECURRENCES: RecurrenceType[] = ["one_time", "weekly", "biweekly", "monthly"];

export async function createSchedule(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceInput = String(formData.get("price") ?? "").trim();
  const estimatedMinutesRaw = String(formData.get("estimated_minutes") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const recurrence = String(formData.get("recurrence") ?? "") as RecurrenceType;

  if (!customerId || !description || !startDate || !RECURRENCES.includes(recurrence)) {
    return { error: "Customer, description, start date, and recurrence are required." };
  }

  let priceCents: number;
  try {
    priceCents = parsePriceToCents(priceInput);
  } catch {
    return { error: "Enter a valid price, like 50 or 50.00." };
  }

  let estimatedMinutes: number | null = null;
  if (estimatedMinutesRaw) {
    const n = Number(estimatedMinutesRaw);
    if (!Number.isInteger(n) || n <= 0) {
      return { error: "Estimated minutes must be a positive whole number." };
    }
    estimatedMinutes = n;
  }

  const supabase = await createClient();
  const org = await getCurrentOrganization(supabase);

  const { data: schedule, error: insertError } = await supabase
    .from("service_schedules")
    .insert({
      organization_id: org.id,
      customer_id: customerId,
      description,
      price_cents: priceCents,
      estimated_minutes: estimatedMinutes,
      start_date: startDate,
      recurrence,
    })
    .select("id")
    .single();

  if (insertError || !schedule) {
    return { error: "Could not save the schedule. Please try again." };
  }

  // Generate this schedule's rolling 8-week window immediately so its jobs
  // show up without waiting for the next dashboard load.
  await supabase.rpc("generate_jobs_for_schedule", { p_schedule_id: schedule.id });

  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}

export async function disableSchedule(scheduleId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_schedules")
    .update({ is_active: false })
    .eq("id", scheduleId);

  revalidatePath("/schedule");
  revalidatePath("/");
  if (error) return { error: "Could not disable the schedule." };
  return { error: null };
}
