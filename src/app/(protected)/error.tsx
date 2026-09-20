"use client";

import { useEffect } from "react";

export default function ProtectedError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-sm space-y-4 py-10 text-center" role="alert">
      <h1 className="font-display text-2xl font-bold">This page didn&apos;t load</h1>
      <p className="text-[15px] text-gray-700">
        Nothing you saved was lost. Check your connection and try again. If it keeps happening,
        sign out and back in.
      </p>
      <button
        onClick={() => retry()}
        className="h-12 w-full rounded-xl bg-(--color-primary) text-base font-semibold text-white active:bg-(--color-primary-dark)"
      >
        Try again
      </button>
    </div>
  );
}
