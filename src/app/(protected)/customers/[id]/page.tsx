import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/org";
import { CustomerForm } from "@/components/CustomerForm";
import { CustomerStatusControls } from "@/components/CustomerStatusControls";
import { updateCustomer } from "@/lib/actions/customers";
import { formatCents } from "@/lib/domain/money";
import type { JobChangeType } from "@/lib/supabase/types";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const org = await getCurrentOrganization(supabase);

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!customer) notFound();

  if (edit === "1") {
    const boundUpdate = updateCustomer.bind(null, id);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Edit Customer</h1>
        <CustomerForm
          action={boundUpdate}
          submitLabel="Save Changes"
          defaultValues={customer}
        />
        <Link href={`/customers/${id}`} className="block text-center text-sm text-gray-500">
          Cancel
        </Link>
      </div>
    );
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, scheduled_date, status, price_cents, completion_notes")
    .eq("customer_id", id)
    .order("scheduled_date", { ascending: false });

  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: timeEntries } =
    jobIds.length > 0
      ? await supabase
          .from("time_entries")
          .select("job_id, duration_seconds")
          .in("job_id", jobIds)
          .not("duration_seconds", "is", null)
      : { data: [] as { job_id: string; duration_seconds: number | null }[] };

  const durationByJob = new Map<string, number>();
  for (const entry of timeEntries ?? []) {
    if (entry.duration_seconds == null) continue;
    durationByJob.set(entry.job_id, (durationByJob.get(entry.job_id) ?? 0) + entry.duration_seconds);
  }

  // Reasons given for moves/skips/manual corrections along the way -- not
  // just the final completion note -- so a "why" entered mid-visit (e.g.
  // Stop and Reschedule's reason) isn't lost from the customer's record.
  const { data: changeHistory } =
    jobIds.length > 0
      ? await supabase
          .from("job_change_history")
          .select("job_id, change_type, previous_date, new_date, reason, changed_at")
          .in("job_id", jobIds)
          .order("changed_at", { ascending: true })
      : {
          data: [] as {
            job_id: string;
            change_type: JobChangeType;
            previous_date: string | null;
            new_date: string | null;
            reason: string | null;
            changed_at: string;
          }[],
        };

  const historyByJob = new Map<string, NonNullable<typeof changeHistory>>();
  for (const entry of changeHistory ?? []) {
    const list = historyByJob.get(entry.job_id) ?? [];
    list.push(entry);
    historyByJob.set(entry.job_id, list);
  }

  const changeTypeLabel: Record<string, string> = {
    move: "Moved",
    skip: "Skipped",
    complete: "Completed",
    timer_correction: "Manual time",
  };

  const completedDurations = (jobs ?? [])
    .filter((j) => j.status === "completed" && durationByJob.has(j.id))
    .map((j) => durationByJob.get(j.id)!);
  const averageSeconds =
    completedDurations.length > 0
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {customer.first_name} {customer.last_name}
          </h1>
          {!customer.is_active && (
            <span className="text-sm font-medium text-(--color-danger)">Inactive</span>
          )}
        </div>
        <Link
          href={`/customers/${id}?edit=1`}
          className="rounded-lg border border-(--color-border) px-3 py-2 text-sm"
        >
          Edit
        </Link>
      </div>

      <section className="space-y-1 rounded-xl border border-(--color-border) bg-(--color-surface) p-4 text-sm">
        <p>{customer.phone}</p>
        {customer.email && <p>{customer.email}</p>}
        <p>
          {customer.address_line1}, {customer.city}, {customer.state} {customer.postal_code}
        </p>
        <p>Default price: {formatCents(customer.default_price_cents, org.currency)}</p>
        {customer.gate_code && <p>Gate code: {customer.gate_code}</p>}
        {customer.access_notes && <p>Access notes: {customer.access_notes}</p>}
        {customer.property_notes && <p>Property notes: {customer.property_notes}</p>}
        {customer.general_notes && <p>Notes: {customer.general_notes}</p>}
      </section>

      <CustomerStatusControls customerId={id} isActive={customer.is_active} />

      <section>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        <p className="mb-3 text-sm text-gray-600">
          {averageSeconds !== null
            ? `Average duration: ${Math.round(averageSeconds / 60)} min (${completedDurations.length} completed visit${completedDurations.length === 1 ? "" : "s"} with recorded time)`
            : "No completed visits with recorded time yet."}
        </p>
        {(jobs ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No visit history yet.</p>
        ) : (
          <div className="space-y-2">
            {(jobs ?? []).map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{job.scheduled_date}</span>
                  <span>{formatCents(job.price_cents, org.currency)}</span>
                </div>
                <p className="text-gray-600">
                  {job.status}
                  {durationByJob.has(job.id)
                    ? ` -- ${Math.round(durationByJob.get(job.id)! / 60)} min`
                    : ""}
                </p>
                {job.completion_notes && (
                  <p className="text-gray-500">Completion note: {job.completion_notes}</p>
                )}
                {(historyByJob.get(job.id) ?? [])
                  .filter((h) => h.change_type !== "complete")
                  .map((h, i) => (
                    <p key={i} className="text-xs text-gray-500">
                      {changeTypeLabel[h.change_type] ?? h.change_type}
                      {h.previous_date && h.new_date ? ` (${h.previous_date} -> ${h.new_date})` : ""}
                      {h.reason ? `: ${h.reason}` : ""}
                    </p>
                  ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
