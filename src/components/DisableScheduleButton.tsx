"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disableSchedule } from "@/lib/actions/schedules";

export function DisableScheduleButton({ scheduleId }: { scheduleId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div>
      <button
        disabled={pending}
        className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs disabled:opacity-60"
        onClick={() => {
          if (
            !window.confirm(
              "Disable this schedule? Resolve its future pending visits separately -- this does not cancel them automatically.",
            )
          ) {
            return;
          }
          startTransition(async () => {
            const result = await disableSchedule(scheduleId);
            if (result.error) setError(result.error);
            else {
              setError(null);
              router.refresh();
            }
          });
        }}
      >
        Disable
      </button>
      {error && <p className="mt-1 text-xs text-(--color-danger)">{error}</p>}
    </div>
  );
}
