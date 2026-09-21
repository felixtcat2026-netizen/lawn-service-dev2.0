"use client";

import { useActionState, useState } from "react";
import { createSchedule } from "@/lib/actions/schedules";
import { ServiceDescriptionPicker } from "@/components/ServiceDescriptionPicker";

const RECURRENCE_PHRASE: Record<string, string> = {
  one_time: "one-time",
  weekly: "weekly",
  biweekly: "every-two-weeks",
  monthly: "monthly",
};

export function ScheduleForm({
  customers,
  activeSchedules,
  prefill,
}: {
  customers: { id: string; name: string; defaultPriceDollars: string }[];
  activeSchedules: { customerId: string; description: string; recurrence: string }[];
  /** Used when arriving from a reactivated customer: their last schedule's details, ready to reuse. */
  prefill?: { customerId: string; description: string; priceDollars: string; estimatedMinutes: string };
}) {
  const [state, formAction, pending] = useActionState(createSchedule, { error: null });
  const [customerId, setCustomerId] = useState(prefill?.customerId ?? "");

  const selected = customers.find((c) => c.id === customerId);
  const existing = activeSchedules.filter((s) => s.customerId === customerId);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="text-lg font-semibold">New Service Schedule</h2>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Customer</span>
        <select
          name="customer_id"
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
        >
          <option value="">Select a customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {selected && existing.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{selected.name} already has an active schedule:</p>
          <ul className="mt-1 list-inside list-disc">
            {existing.map((s, i) => (
              <li key={i}>
                {s.description} ({RECURRENCE_PHRASE[s.recurrence] ?? s.recurrence})
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Creating another adds a second set of visits. To change how often this customer is
            serviced, disable the old schedule under Active Schedules first, then skip or move its
            remaining visits.
          </p>
        </div>
      )}

      <ServiceDescriptionPicker initialDescription={prefill?.description} />

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Price</span>
          <input
            name="price"
            required
            defaultValue={prefill?.priceDollars}
            placeholder="50.00"
            className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Est. minutes (optional)</span>
          <input
            name="estimated_minutes"
            type="number"
            min="1"
            defaultValue={prefill?.estimatedMinutes}
            className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Start date</span>
          <input
            name="start_date"
            type="date"
            required
            className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Recurrence</span>
          <select
            name="recurrence"
            required
            className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="monthly">Monthly</option>
            <option value="one_time">One time</option>
          </select>
        </label>
      </div>

      {state.error && <p className="text-sm text-(--color-danger)">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-(--color-primary) px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : "Create Schedule"}
      </button>
    </form>
  );
}
