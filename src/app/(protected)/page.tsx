import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/org";
import { businessToday } from "@/lib/domain/recurrence";
import { formatCents } from "@/lib/domain/money";
import { formatLongDateLabel } from "@/lib/domain/jobDisplay";
import { summarizeDay } from "@/lib/domain/todaySummary";
import { JobActionsPanel } from "@/components/JobActionsPanel";
import { JobCard, type JobCardData } from "@/components/JobCard";
import { TodayHeroCard } from "@/components/TodayHeroCard";
import { TodaySummary } from "@/components/TodaySummary";

interface JobJoinRow {
  id: string;
  schedule_id: string;
  status: JobCardData["status"];
  scheduled_date: string;
  original_service_date: string;
  description: string;
  price_cents: number;
  estimated_minutes: number | null;
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

const JOB_COLUMNS =
  "id, schedule_id, status, scheduled_date, original_service_date, description, price_cents, estimated_minutes, completion_notes, skip_reason, customers(first_name, last_name, address_line1, city, state)";

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

  const [todayResult, overdueResult, activeEntryResult, moveHistoryResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("scheduled_date", today)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .lt("scheduled_date", today)
      .in("status", ["scheduled", "rescheduled"])
      .order("scheduled_date", { ascending: true }),
    supabase.from("time_entries").select("job_id, started_at").is("ended_at", null).maybeSingle(),
    supabase
      .from("job_change_history")
      .select("job_id, changed_at")
      .eq("change_type", "move")
      .eq("previous_date", today),
  ]);

  const todayJobs = (todayResult.data ?? []) as unknown as JobJoinRow[];
  const allOverdueJobs = (overdueResult.data ?? []) as unknown as JobJoinRow[];
  const activeEntry = activeEntryResult.data;

  // Jobs that were planned for today but moved to another date today (e.g.
  // Stop and Reschedule). They no longer have today's scheduled_date, so
  // they only show up in the change history.
  const todayIds = new Set(todayJobs.map((j) => j.id));
  const movedAwayIds = [
    ...new Set(
      (moveHistoryResult.data ?? [])
        .filter(
          (h) =>
            !todayIds.has(h.job_id) &&
            businessToday(org.timezone, new Date(h.changed_at)) === today,
        )
        .map((h) => h.job_id),
    ),
  ];

  let movedAwayJobs: { id: string; price_cents: number; customers: { first_name: string; last_name: string } | null }[] = [];
  if (movedAwayIds.length > 0) {
    const { data } = await supabase
      .from("jobs")
      .select("id, price_cents, customers(first_name, last_name)")
      .in("id", movedAwayIds);
    movedAwayJobs = (data ?? []) as unknown as typeof movedAwayJobs;
  }

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

  const activeJob = [...todayJobs, ...allOverdueJobs].find((j) => j.id === activeEntry?.job_id);
  const pendingToday = todayJobs.filter(
    (j) => j.status === "scheduled" || j.status === "rescheduled",
  );
  const heroJob = activeJob ?? pendingToday[0];
  const thenJobs = pendingToday.filter((j) => j.id !== heroJob?.id);
  const completedToday = todayJobs.filter((j) => j.status === "completed");
  const overdueJobs = allOverdueJobs.filter((j) => j.id !== heroJob?.id);

  const movedCents = movedAwayJobs.reduce((sum, j) => sum + j.price_cents, 0);
  const movedNames = movedAwayJobs.map((j) =>
    j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : "A job",
  );
  const summary = summarizeDay(
    todayJobs.map((j) => ({ status: j.status, priceCents: j.price_cents })),
    movedCents,
  );
  const jobCount = todayJobs.length + movedAwayJobs.length;

  return (
    <div className="space-y-4">
      <section className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
          <p className="mt-0.5 text-sm text-gray-600">{formatLongDateLabel(today)}</p>
        </div>
        {jobCount > 0 && (
          <p className="text-sm text-gray-600">
            {jobCount} {jobCount === 1 ? "job" : "jobs"}
          </p>
        )}
      </section>

      {summary.scheduledCents > 0 && (
        <TodaySummary summary={summary} movedNames={movedNames} currency={org.currency} />
      )}

      {overdueJobs.length > 0 && (
        <details className="group rounded-2xl border border-amber-200 bg-amber-50">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-3.5 py-2.5 text-amber-800 [&::-webkit-details-marker]:hidden">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2L14.5 13.5H1.5L8 2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="flex-1 text-sm font-semibold">
              {overdueJobs.length} overdue ·{" "}
              {overdueJobs
                .slice(0, 2)
                .map((j) => (j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : "Unknown"))
                .join(", ")}
              {overdueJobs.length > 2 ? ` +${overdueJobs.length - 2} more` : ""}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="space-y-3 border-t border-amber-200 p-3">
            {overdueJobs.map((job) => (
              <JobCard key={job.id} job={toCard(job, org.currency, true, null)} />
            ))}
          </div>
        </details>
      )}

      {heroJob && (
        <TodayHeroCard
          job={toCard(
            heroJob,
            org.currency,
            allOverdueJobs.some((j) => j.id === heroJob.id),
            heroJob.id === activeEntry?.job_id ? activeEntry.started_at : null,
            heroJob.id === activeEntry?.job_id ? activeJobPriorSeconds : 0,
          )}
          estimatedMinutes={heroJob.estimated_minutes}
        />
      )}

      {!heroJob && summary.scheduledCents > 0 && (
        <section className="rounded-3xl border border-(--color-border) bg-(--color-surface) px-5 py-7 text-center">
          <p className="text-xl font-bold">All done for today</p>
          <p className="mt-1.5 text-[15px] tabular-nums text-gray-600">
            {formatCents(summary.earnedCents, org.currency)} earned
          </p>
        </section>
      )}

      {!heroJob && summary.scheduledCents === 0 && overdueJobs.length === 0 && (
        <p className="text-sm text-gray-600">No jobs scheduled for today.</p>
      )}

      {thenJobs.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold tracking-wider text-gray-600">THEN</h2>
          <div className="space-y-2">
            {thenJobs.map((job) => {
              const card = toCard(job, org.currency, false, null);
              return (
                <details
                  key={job.id}
                  className="group rounded-2xl border border-(--color-border) bg-(--color-surface)"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold tabular-nums text-gray-700">
                      {todayJobs.indexOf(job) + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{card.customerName}</span>
                      <span className="block truncate text-[13px] text-gray-600">
                        {card.description}
                      </span>
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums">
                      {formatCents(card.priceCents, card.currency)}
                    </span>
                  </summary>
                  <div className="border-t border-(--color-border) p-3.5">
                    <p className="mb-3 text-sm text-gray-600">{card.address}</p>
                    <JobActionsPanel job={card} />
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {completedToday.length > 0 && (
        <details className="group rounded-2xl border border-(--color-border) bg-(--color-surface)">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-(--color-primary)" aria-hidden="true">
              <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex-1 text-sm font-semibold">
              Finished today · {completedToday.length}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-gray-500 transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="space-y-3 border-t border-(--color-border) p-3">
            {completedToday.map((job) => (
              <JobCard key={job.id} job={toCard(job, org.currency, false, null)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
