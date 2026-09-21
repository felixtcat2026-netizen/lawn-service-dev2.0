import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/org";
import { businessToday } from "@/lib/domain/recurrence";
import { ScheduleForm } from "@/components/ScheduleForm";
import { DisableScheduleButton } from "@/components/DisableScheduleButton";
import { JobCard, type JobCardData } from "@/components/JobCard";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";
import { addMonthsIso, compareIso } from "@/lib/domain/calendar";

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

function toCard(row: JobJoinRow, currency: string, isOverdue: boolean): JobCardData {
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
    activeTimerStartedAt: null,
    priorSegmentSeconds: 0,
    isOverdue,
  };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { customer: prefillCustomerId } = await searchParams;
  const supabase = await createClient();
  const org = await getCurrentOrganization(supabase);
  await supabase.rpc("generate_jobs_for_organization");
  const today = businessToday(org.timezone);

  // A wide window for the Week/Day/Month calendar views below -- separate
  // from the 8-week "Upcoming" list, and includes every status (including
  // cancelled/completed) so past and skipped visits are browsable too.
  const calendarStart = addMonthsIso(today, -2);
  const calendarEnd = addMonthsIso(today, 3);

  const [
    { data: activeCustomers },
    { data: schedules },
    { data: upcomingJobs },
    { data: overdueJobs },
    { data: calendarJobsRaw },
  ] = await Promise.all([
      supabase
        .from("customers")
        .select("id, first_name, last_name, default_price_cents")
        .eq("is_active", true)
        .order("last_name"),
      supabase
        .from("service_schedules")
        .select("id, customer_id, description, recurrence, price_cents, start_date, is_active, customers(first_name, last_name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select(
          "id, schedule_id, status, scheduled_date, original_service_date, description, price_cents, completion_notes, skip_reason, customers(first_name, last_name, address_line1, city, state)",
        )
        .gte("scheduled_date", today)
        .neq("status", "cancelled")
        .order("scheduled_date", { ascending: true }),
      supabase
        .from("jobs")
        .select(
          "id, schedule_id, status, scheduled_date, original_service_date, description, price_cents, completion_notes, skip_reason, customers(first_name, last_name, address_line1, city, state)",
        )
        .lt("scheduled_date", today)
        .in("status", ["scheduled", "rescheduled"])
        .order("scheduled_date", { ascending: true }),
      supabase
        .from("jobs")
        .select(
          "id, schedule_id, status, scheduled_date, original_service_date, description, price_cents, completion_notes, skip_reason, customers(first_name, last_name, address_line1, city, state)",
        )
        .gte("scheduled_date", calendarStart)
        .lte("scheduled_date", calendarEnd)
        .order("scheduled_date", { ascending: true }),
    ]);

  const customerOptions = (activeCustomers ?? []).map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    defaultPriceDollars: (c.default_price_cents / 100).toFixed(2),
  }));

  // Arriving from a reactivated customer: start the new-schedule form with
  // their last schedule's details so resuming service takes two taps.
  let prefill:
    | { customerId: string; description: string; priceDollars: string; estimatedMinutes: string }
    | undefined;
  const prefillCustomer = customerOptions.find((c) => c.id === prefillCustomerId);
  if (prefillCustomer) {
    const { data: last } = await supabase
      .from("service_schedules")
      .select("description, price_cents, estimated_minutes")
      .eq("customer_id", prefillCustomer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    prefill = {
      customerId: prefillCustomer.id,
      description: last?.description ?? "",
      priceDollars: last
        ? (last.price_cents / 100).toFixed(2)
        : prefillCustomer.defaultPriceDollars,
      estimatedMinutes: last?.estimated_minutes ? String(last.estimated_minutes) : "",
    };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Schedule</h1>

      <ScheduleForm
        key={prefill?.customerId ?? "blank"}
        prefill={prefill}
        customers={customerOptions}
        activeSchedules={(schedules ?? []).map((s) => ({
          customerId: s.customer_id,
          description: s.description,
          recurrence: s.recurrence,
        }))}
      />

      <section>
        <h2 className="mb-1 text-lg font-semibold">Active Schedules</h2>
        <p className="mb-3 text-sm text-gray-600">
          A schedule can&apos;t be edited. To change how often a customer is serviced, disable the
          old schedule, skip or move the visits it already put on the calendar, then create a new
          schedule above. Leaving the old one running would give the customer double visits.
        </p>
        {(schedules ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No active schedules yet.</p>
        ) : (
          <div className="space-y-2">
            {(schedules ?? []).map((s) => {
              const customer = s.customers as { first_name: string; last_name: string } | null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {customer ? `${customer.first_name} ${customer.last_name}` : "Unknown"} --{" "}
                      {s.description}
                    </p>
                    <p className="text-gray-500">
                      {s.recurrence.replace("_", " ")} since {s.start_date}
                    </p>
                  </div>
                  <DisableScheduleButton scheduleId={s.id} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(overdueJobs ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-(--color-danger)">Overdue</h2>
          <div className="space-y-3">
            {(overdueJobs as unknown as JobJoinRow[]).map((job) => (
              <JobCard key={job.id} job={toCard(job, org.currency, true)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Upcoming</h2>
        {(upcomingJobs ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming jobs in the next 8 weeks.</p>
        ) : (
          <div className="space-y-3">
            {(upcomingJobs as unknown as JobJoinRow[]).map((job) => (
              <JobCard key={job.id} job={toCard(job, org.currency, false)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Calendar</h2>
        <ScheduleCalendar
          jobs={(calendarJobsRaw as unknown as JobJoinRow[] | null ?? []).map((job) =>
            toCard(job, org.currency, compareIso(job.scheduled_date, today) < 0),
          )}
          today={today}
        />
      </section>
    </div>
  );
}
