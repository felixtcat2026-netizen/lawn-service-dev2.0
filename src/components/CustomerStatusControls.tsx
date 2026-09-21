"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deactivateCustomer, reactivateCustomer } from "@/lib/actions/customers";

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function CustomerStatusControls({
  customerId,
  customerName,
  isActive,
  pendingVisitCount,
  activeScheduleCount,
}: {
  customerId: string;
  customerName: string;
  isActive: boolean;
  pendingVisitCount: number;
  activeScheduleCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reactivated, setReactivated] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (isActive) {
    const effects =
      pendingVisitCount > 0 || activeScheduleCount > 0
        ? ` This cancels ${plural(pendingVisitCount, "pending visit")} and turns off ${plural(activeScheduleCount, "schedule")}.`
        : "";

    return (
      <div className="space-y-3">
        {reactivated && (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
            <p className="font-medium">{customerName} is active again.</p>
            <p className="mt-1">
              Their old schedules stay off and their cancelled visits stay cancelled, so nothing
              restarts by surprise. Create a new schedule to resume service.
            </p>
            <Link
              href={`/schedule?customer=${customerId}`}
              className="mt-3 flex h-12 items-center justify-center rounded-xl bg-(--color-primary) text-base font-semibold text-white"
            >
              Start a new schedule
            </Link>
          </div>
        )}
        <button
          disabled={pending}
          className="min-h-11 rounded-lg border border-(--color-danger) px-4 py-2 text-sm font-medium text-(--color-danger) disabled:opacity-60"
          onClick={() => {
            if (
              !window.confirm(
                `Deactivate ${customerName}?${effects} Their history is kept and nothing is deleted.`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              const result = await deactivateCustomer(customerId);
              if (result.error) {
                setError(result.error);
              } else {
                setError(null);
                setReactivated(false);
                router.refresh();
              }
            });
          }}
        >
          Deactivate Customer
        </button>
        {error && <p className="text-sm text-(--color-danger)">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button
        disabled={pending}
        className="min-h-11 rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        onClick={() => {
          startTransition(async () => {
            const result = await reactivateCustomer(customerId);
            if (result.error) setError(result.error);
            else {
              setError(null);
              setReactivated(true);
              router.refresh();
            }
          });
        }}
      >
        Reactivate Customer
      </button>
      <p className="mt-1 text-xs text-gray-600">
        Reactivating does not restart old schedules. You&apos;ll be offered a new one next.
      </p>
      {error && <p className="mt-2 text-sm text-(--color-danger)">{error}</p>}
    </div>
  );
}
