// Integration tests against a REAL Supabase dev project (no local Postgres
// available in this environment -- see docs/BUILD-STATUS.md). Requires
// migrations 0001_init.sql and 0002_functions.sql to already be applied.
//
// Each test provisions its own throwaway organization + owner user via the
// admin (secret key) client -- which bypasses RLS for setup only -- then
// exercises the app's actual RLS-scoped RPCs/queries through a normally
// signed-in client, and tears everything down afterward.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error(
    "Integration tests require NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, " +
      "and SUPABASE_SECRET_KEY in .env.local (see docs/BUILD-STATUS.md).",
  );
}

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TestOrg {
  orgId: string;
  userId: string;
  client: SupabaseClient<Database>;
}

async function provisionTestOrg(label: string): Promise<TestOrg> {
  const email = `integration-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`;
  const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError || !userData.user) {
    throw new Error(`Failed to create test user: ${userError?.message}`);
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: `Integration Test Org ${label}`, timezone: "America/Chicago", currency: "USD" })
    .select("id")
    .single();
  if (orgError || !org) throw new Error(`Failed to create test org: ${orgError?.message}`);

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: userData.user.id, role: "owner" });
  if (memberError) throw new Error(`Failed to create membership: ${memberError.message}`);

  const client = createClient<Database>(url!, publishableKey!);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Failed to sign in test user: ${signInError.message}`);

  return { orgId: org.id, userId: userData.user.id, client };
}

async function cleanupTestOrg(org: TestOrg) {
  await admin.from("organizations").delete().eq("id", org.orgId);
  await admin.auth.admin.deleteUser(org.userId);
}

async function seedCustomerAndSchedule(
  org: TestOrg,
  overrides: { startDate: string; recurrence: Database["public"]["Enums"]["recurrence_type"] },
) {
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      organization_id: org.orgId,
      first_name: "Test",
      last_name: "Lawn",
      phone: "555-0100",
      email: null,
      address_line1: "123 Fake St",
      city: "Testville",
      state: "TX",
      postal_code: "00000",
      default_price_cents: 5000,
      general_notes: null,
      property_notes: null,
      gate_code: null,
      access_notes: null,
    })
    .select("id")
    .single();
  if (customerError || !customer) throw new Error(`Failed to seed customer: ${customerError?.message}`);

  const { data: schedule, error: scheduleError } = await admin
    .from("service_schedules")
    .insert({
      organization_id: org.orgId,
      customer_id: customer.id,
      description: "Mow and edge",
      price_cents: 5000,
      estimated_minutes: 30,
      start_date: overrides.startDate,
      recurrence: overrides.recurrence,
    })
    .select("id")
    .single();
  if (scheduleError || !schedule) throw new Error(`Failed to seed schedule: ${scheduleError?.message}`);

  return { customerId: customer.id, scheduleId: schedule.id };
}

describe("organization-scoped access (RLS)", () => {
  let orgA: TestOrg;
  let orgB: TestOrg;
  let customerAId: string;

  beforeAll(async () => {
    orgA = await provisionTestOrg("access-a");
    orgB = await provisionTestOrg("access-b");
    const seeded = await seedCustomerAndSchedule(orgA, {
      startDate: "2026-06-01",
      recurrence: "weekly",
    });
    customerAId = seeded.customerId;
    // A job row is needed for the "start_job via RPC" cross-org test below.
    await admin.rpc("generate_jobs_for_schedule", { p_schedule_id: seeded.scheduleId });
  });

  afterAll(async () => {
    await cleanupTestOrg(orgA);
    await cleanupTestOrg(orgB);
  });

  it("denies signed-out reads", async () => {
    const anon = createClient<Database>(url!, publishableKey!);
    const { data, error } = await anon.from("customers").select("*").eq("id", customerAId);
    expect(error).toBeNull(); // RLS returns an empty set, not a Postgres error
    expect(data).toEqual([]);
  });

  it("denies signed-out writes", async () => {
    const anon = createClient<Database>(url!, publishableKey!);
    const { error } = await anon
      .from("customers")
      .update({ first_name: "Hacked" })
      .eq("id", customerAId);
    // RLS blocks the row from matching, so nothing is updated and no rows
    // are returned/affected -- verified below via an authenticated re-read.
    expect(error).toBeNull();

    const { data: check } = await admin
      .from("customers")
      .select("first_name")
      .eq("id", customerAId)
      .single();
    expect(check?.first_name).toBe("Test");
  });

  it("denies another organization's read of a customer", async () => {
    const { data, error } = await orgB.client.from("customers").select("*").eq("id", customerAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("denies another organization's write to a customer", async () => {
    const { error } = await orgB.client
      .from("customers")
      .update({ first_name: "Hacked" })
      .eq("id", customerAId);
    expect(error).toBeNull();

    const { data: check } = await admin
      .from("customers")
      .select("first_name")
      .eq("id", customerAId)
      .single();
    expect(check?.first_name).toBe("Test");
  });

  it("denies another organization from starting a job via RPC", async () => {
    const { data: job } = await admin
      .from("jobs")
      .select("id")
      .eq("organization_id", orgA.orgId)
      .limit(1)
      .maybeSingle();
    expect(job).toBeTruthy();

    const { error } = await orgB.client.rpc("start_job", { p_job_id: job!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("not found");
  });

  it("allows the owning organization to read its own customer", async () => {
    const { data, error } = await orgA.client.from("customers").select("*").eq("id", customerAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("job generation is idempotent (no duplicates)", () => {
  let org: TestOrg;

  beforeAll(async () => {
    org = await provisionTestOrg("gen-dedup");
  });

  afterAll(async () => {
    await cleanupTestOrg(org);
  });

  it("does not create duplicate jobs when called twice, or concurrently", async () => {
    const { scheduleId } = await seedCustomerAndSchedule(org, {
      startDate: "2026-01-05",
      recurrence: "weekly",
    });

    const { error: firstError } = await org.client.rpc("generate_jobs_for_schedule", {
      p_schedule_id: scheduleId,
    });
    expect(firstError).toBeNull();

    const { data: afterFirst } = await admin.from("jobs").select("id").eq("schedule_id", scheduleId);
    const countAfterFirst = afterFirst?.length ?? 0;
    expect(countAfterFirst).toBeGreaterThan(0);

    // Call again sequentially -- simulates a retried save.
    await org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId });
    const { data: afterSecond } = await admin.from("jobs").select("id").eq("schedule_id", scheduleId);
    expect(afterSecond?.length ?? 0).toBe(countAfterFirst);

    // Call concurrently -- simulates two tabs both loading the dashboard.
    await Promise.all([
      org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId }),
      org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId }),
    ]);
    const { data: afterConcurrent } = await admin
      .from("jobs")
      .select("id")
      .eq("schedule_id", scheduleId);
    expect(afterConcurrent?.length ?? 0).toBe(countAfterFirst);

    const originalDates = new Set(
      (afterConcurrent ?? []).map((j) => j.id),
    );
    expect(originalDates.size).toBe(countAfterFirst);
  });
});

describe("moved and skipped occurrences are not regenerated", () => {
  let org: TestOrg;

  beforeAll(async () => {
    org = await provisionTestOrg("move-skip");
  });

  afterAll(async () => {
    await cleanupTestOrg(org);
  });

  it("keeps a moved job's identity and does not duplicate it on regeneration", async () => {
    const { scheduleId } = await seedCustomerAndSchedule(org, {
      startDate: "2026-01-05",
      recurrence: "weekly",
    });
    await org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId });

    const { data: jobs } = await admin
      .from("jobs")
      .select("id, original_service_date, scheduled_date")
      .eq("schedule_id", scheduleId)
      .order("original_service_date", { ascending: true });
    const firstJob = jobs![0]!;

    const { data: moved, error: moveError } = await org.client.rpc("move_job", {
      p_job_id: firstJob.id,
      p_new_date: "2026-01-08",
      p_reason: "rain",
      p_confirm_conflict: false,
    });
    expect(moveError).toBeNull();
    expect(moved?.status).toBe("rescheduled");
    expect(moved?.scheduled_date).toBe("2026-01-08");
    expect(moved?.original_service_date).toBe(firstJob.original_service_date);

    // Regenerate: must not create a new job for the original date.
    await org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId });
    const { data: afterRegen } = await admin
      .from("jobs")
      .select("id, original_service_date")
      .eq("schedule_id", scheduleId)
      .eq("original_service_date", firstJob.original_service_date);
    expect(afterRegen).toHaveLength(1);
    expect(afterRegen![0]!.id).toBe(firstJob.id);
  });

  it("keeps a skipped occurrence cancelled and does not regenerate it", async () => {
    const { scheduleId } = await seedCustomerAndSchedule(org, {
      startDate: "2026-02-02",
      recurrence: "weekly",
    });
    await org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId });

    const { data: jobs } = await admin
      .from("jobs")
      .select("id, original_service_date")
      .eq("schedule_id", scheduleId)
      .order("original_service_date", { ascending: true });
    const firstJob = jobs![0]!;

    const { data: skipped, error: skipError } = await org.client.rpc("skip_job", {
      p_job_id: firstJob.id,
      p_reason: "customer requested skip",
    });
    expect(skipError).toBeNull();
    expect(skipped?.status).toBe("cancelled");

    await org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId });
    const { data: afterRegen } = await admin
      .from("jobs")
      .select("id, status")
      .eq("schedule_id", scheduleId)
      .eq("original_service_date", firstJob.original_service_date);
    expect(afterRegen).toHaveLength(1);
    expect(afterRegen![0]!.status).toBe("cancelled");
  });
});

describe("timer: single active timer per organization, idempotent completion", () => {
  let org: TestOrg;

  beforeAll(async () => {
    org = await provisionTestOrg("timer");
  });

  afterAll(async () => {
    await cleanupTestOrg(org);
  });

  it("allows only one of two concurrent start_job calls on different jobs to succeed", async () => {
    const { scheduleId } = await seedCustomerAndSchedule(org, {
      startDate: "2026-03-02",
      recurrence: "weekly",
    });
    await org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId });
    const { data: jobs } = await admin
      .from("jobs")
      .select("id")
      .eq("schedule_id", scheduleId)
      .order("original_service_date", { ascending: true })
      .limit(2);
    expect(jobs).toHaveLength(2);
    const jobOne = jobs![0]!;
    const jobTwo = jobs![1]!;

    const [resultOne, resultTwo] = await Promise.all([
      org.client.rpc("start_job", { p_job_id: jobOne.id }),
      org.client.rpc("start_job", { p_job_id: jobTwo.id }),
    ]);

    const errors = [resultOne.error, resultTwo.error];
    const succeeded = errors.filter((e) => e === null).length;
    const failed = errors.filter((e) => e?.message === "ACTIVE_TIMER_EXISTS").length;
    expect(succeeded).toBe(1);
    expect(failed).toBe(1);

    const { data: activeEntries } = await admin
      .from("time_entries")
      .select("id")
      .eq("organization_id", org.orgId)
      .is("ended_at", null);
    expect(activeEntries).toHaveLength(1);

    // Leave the org's timer slot clean for the next test in this suite --
    // this describe block intentionally reuses one org across tests since
    // the thing under test (one active timer per org) is itself org-wide
    // shared state.
    const startedJobId = resultOne.error === null ? jobOne.id : jobTwo.id;
    await org.client.rpc("complete_job", { p_job_id: startedJobId });
  });

  it("completes a job idempotently without adding time or duplicating history on a repeat call", async () => {
    const { scheduleId } = await seedCustomerAndSchedule(org, {
      startDate: "2026-04-06",
      recurrence: "weekly",
    });
    await org.client.rpc("generate_jobs_for_schedule", { p_schedule_id: scheduleId });
    const { data: job } = await admin
      .from("jobs")
      .select("id")
      .eq("schedule_id", scheduleId)
      .limit(1)
      .single();

    await org.client.rpc("start_job", { p_job_id: job!.id });
    const { data: firstComplete, error: firstError } = await org.client.rpc("complete_job", {
      p_job_id: job!.id,
      p_notes: "done",
    });
    expect(firstError).toBeNull();
    expect(firstComplete?.status).toBe("completed");
    const firstCompletedAt = firstComplete?.completed_at;

    const { data: secondComplete, error: secondError } = await org.client.rpc("complete_job", {
      p_job_id: job!.id,
      p_notes: "done again",
    });
    expect(secondError).toBeNull();
    expect(secondComplete?.status).toBe("completed");
    expect(secondComplete?.completed_at).toBe(firstCompletedAt);
    // Notes from the second, no-op call must not overwrite the first.
    expect(secondComplete?.completion_notes).toBe("done");

    const { data: entries } = await admin
      .from("time_entries")
      .select("id, ended_at")
      .eq("job_id", job!.id);
    expect(entries).toHaveLength(1);
    expect(entries![0]!.ended_at).not.toBeNull();

    const { data: history } = await admin
      .from("job_change_history")
      .select("id")
      .eq("job_id", job!.id)
      .eq("change_type", "complete");
    expect(history).toHaveLength(1);
  });
});
