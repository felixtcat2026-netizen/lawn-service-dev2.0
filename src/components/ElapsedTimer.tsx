"use client";

import { useEffect, useState } from "react";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * Always derives elapsed time from the persisted started_at timestamp, not
 * a counter that could reset on refresh/navigation/phone lock -- this
 * component just ticks a display; the source of truth is the server.
 *
 * priorSeconds is the sum of any earlier closed segments on this same job
 * (e.g. from a previous Stop and Reschedule), so the owner sees total time
 * on the visit, not just the current live segment.
 */
export function ElapsedTimer({
  startedAt,
  priorSeconds = 0,
  className = "font-display text-2xl font-semibold tabular-nums",
}: {
  startedAt: string;
  priorSeconds?: number;
  className?: string;
}) {
  const startedMs = new Date(startedAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className}>{formatElapsed(now - startedMs + priorSeconds * 1000)}</span>
  );
}
