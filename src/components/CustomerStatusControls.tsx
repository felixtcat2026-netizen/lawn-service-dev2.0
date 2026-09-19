"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateCustomer, reactivateCustomer } from "@/lib/actions/customers";

export function CustomerStatusControls({
  customerId,
  isActive,
}: {
  customerId: string;
  isActive: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (isActive) {
    return (
      <div>
        <button
          disabled={pending}
          className="rounded-lg border border-(--color-danger) px-4 py-2 text-sm font-medium text-(--color-danger) disabled:opacity-60"
          onClick={() => {
            if (
              !window.confirm(
                "Deactivate this customer? This disables their schedules and cancels future unstarted visits.",
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
                router.refresh();
              }
            });
          }}
        >
          Deactivate Customer
        </button>
        {error && <p className="mt-2 text-sm text-(--color-danger)">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button
        disabled={pending}
        className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        onClick={() => {
          startTransition(async () => {
            const result = await reactivateCustomer(customerId);
            if (result.error) setError(result.error);
            else {
              setError(null);
              router.refresh();
            }
          });
        }}
      >
        Reactivate Customer
      </button>
      <p className="mt-1 text-xs text-gray-500">
        Reactivating does not restart old schedules -- create a new schedule if needed.
      </p>
      {error && <p className="mt-2 text-sm text-(--color-danger)">{error}</p>}
    </div>
  );
}
