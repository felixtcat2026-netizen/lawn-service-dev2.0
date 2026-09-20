"use client";

import { useActionState } from "react";
import { createSchedule } from "@/lib/actions/schedules";
import { ServiceDescriptionPicker } from "@/components/ServiceDescriptionPicker";

export function ScheduleForm({
  customers,
}: {
  customers: { id: string; name: string; defaultPriceDollars: string }[];
}) {
  const [state, formAction, pending] = useActionState(createSchedule, { error: null });

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="text-lg font-semibold">New Service Schedule</h2>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Customer</span>
        <select
          name="customer_id"
          required
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

      <ServiceDescriptionPicker />

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Price</span>
          <input
            name="price"
            required
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
