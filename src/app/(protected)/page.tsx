import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/org";
import { businessToday } from "@/lib/domain/recurrence";
import { formatCents } from "@/lib/domain/money";
import { JobCard, type JobCardData } from "@/components/JobCard";

interface JobJoinRow {
  id: string;
  schedule_id: string;
  status: JobCardData["status"];
  scheduled_date: string;
  original_service_date: string;
  description: string;
  price_cents: number;
  completion_notes: string | null;
  skip_reason: string | null;
  customers: {
    first_name: string;
    last_name: string;
    address_line1: string;
    city: string;
    state: string;
  } | null;
}

function toCard(
  row: JobJoinRow,
  currency: string,
  isOverdue: boolean,
  activeTimerStartedAt: string | null,
  priorSegmentSeconds = 0,
): JobCardData {
  const customer = row.customers;
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    customerName: customer ? `${customer.first_name} ${customer.last_name}` : "Unknown customer",
    address: customer ? `${customer.address_line1}, ${customer.city}, ${customer.state}` : "",
    status: row.status,
    scheduledDate: row.scheduled_date,
    originalServiceDate: row.original_service_date,
    description: row.description,
    priceCents: row.price_cents,
    currency,
    completionNotes: row.completion_notes,
    skipReason: row.skip_reason,
    activeTimerStartedAt,
    priorSegmentSeconds,
    isOverdue,
  };
}

export default async function TodayPage() {
  const supabase = await createClient();
  const org = await getCurrentOrganization(supabase);

  // Run-on-use generation: catches up missed occurrences on every load.
  await supabase.rpc("generate_jobs_for_organization");

  const today = businessToday(org.timezone);

  const [todayResult, overdueResult, activeEntryResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, schedule_id, status, scheduled_date, original_service_date, description, price_cents, completion_notes, skip_reason, customers(first_name, last_name, address_line1, city, state)",
      )
      .eq("scheduled_date", today)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase
      .from("jobs")
      .select(
        "id, schedule_id, status, scheduled_date, original_service_date, description, price_cents, completion_notes, skip_reason, customers(first_name, last_name, address_line1, city, state)",
      )
      .lt("scheduled_date", today)
      .in("status", ["scheduled", "rescheduled"])
      .order("scheduled_date", { ascending: true }),
    supabase.from("time_entries").select("job_id, started_at").is("ended_at", null).maybeSingle(),
  ]);

  const todayJobs = (todayResult.data ?? []) as unknown as JobJoinRow[];
  const overdueJobs = (overdueResult.data ?? []) as unknown as JobJoinRow[];
  const activeEntry = activeEntryResult.data;

  // Sum of any earlier closed segments on the active job (e.g. from a
  // previous Stop and Reschedule), so the timer can show total time on the
  // visit instead of resetting to 0 on restart.
  let activeJobPriorSeconds = 0;
  if (activeEntry) {
    const { data: closedEntries } = await supabase
      .from("time_entries")
      .select("duration_seconds")
      .eq("job_id", activeEntry.job_id)
      .not("ended_at", "is", null);
    activeJobPriorSeconds = (closedEntries ?? []).reduce(
      (sum, e) => sum + (e.duration_seconds ?? 0),
      0,
    );
  }

  const scheduledValueCents = todayJobs.reduce((sum, j) => sum + j.price_cents, 0);
  const completedValueCents = todayJobs
    .filter((j) => j.status === "completed")
    .reduce((sum, j) => sum + j.price_cents, 0);
  const completedCount = todayJobs.filter((j) => j.status === "completed").length;
  const remainingCount = todayJobs.filter((j) =>
    ["scheduled", "rescheduled", "in_progress"].includes(j.status),
  ).length;

  const activeJob = [...todayJobs, ...overdueJobs].find((j) => j.id === activeEntry?.job_id);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-gray-500">{today}</p>
      </section>

      {activeJob && activeEntry && (
        <section className="rounded-xl border-2 border-(--color-primary) bg-green-50 p-4">
          <p className="text-sm font-medium text-(--color-primary-dark)">Currently working</p>
          <JobCard
            job={toCard(
              activeJob,
              org.currency,
              false,
              activeEntry.started_at,
              activeJobPriorSeconds,
            )}
          />
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Completed" value={String(completedCount)} />
        <Stat label="Remaining" value={String(remainingCount)} />
        <Stat label="Scheduled value" value={formatCents(scheduledValueCents, org.currency)} />
        <Stat label="Completed value" value={formatCents(completedValueCents, org.currency)} />
      </section>

      {overdueJobs.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-(--color-danger)">Overdue</h2>
          <div className="space-y-3">
            {overdueJobs.map((job) => (
              <JobCard key={job.id} job={toCard(job, org.currency, true, null)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Today&apos;s jobs</h2>
        {todayJobs.length === 0 ? (
          <p className="text-sm text-gray-500">No jobs scheduled for today.</p>
        ) : (
          <div className="space-y-3">
            {todayJobs.map((job) => (
              <JobCard
                key={job.id}
                job={toCard(
                  job,
                  org.currency,
                  false,
                  job.id === activeEntry?.job_id ? activeEntry.started_at : null,
                  job.id === activeEntry?.job_id ? activeJobPriorSeconds : 0,
                )}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
