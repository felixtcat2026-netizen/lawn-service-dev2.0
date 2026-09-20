import { formatCents } from "@/lib/domain/money";
import { joinNames, type DaySummary } from "@/lib/domain/todaySummary";

const PARTS = [
  { key: "completedCents", label: "Done", bar: "bg-green-200", dot: "bg-green-200" },
  { key: "workingCents", label: "Working", bar: "bg-green-400", dot: "bg-green-400" },
  { key: "movedCents", label: "Moved", bar: "bg-amber-400", dot: "bg-amber-400" },
  { key: "todoCents", label: "To do", bar: "bg-white/20", dot: "bg-white/40" },
] as const;

/**
 * Where today's service value stands: completed so far, what's in progress, what was
 * moved to another day, and what's still to do. Moved jobs are called out
 * explicitly so "completed" being lower than "scheduled" is never a mystery.
 */
export function TodaySummary({
  summary,
  movedNames,
  currency,
}: {
  summary: DaySummary;
  movedNames: string[];
  currency: string;
}) {
  const segments = PARTS.filter((p) => summary[p.key] > 0);

  return (
    <section className="space-y-3.5 rounded-3xl bg-(--color-primary-dark) p-5 text-white">
      <div>
        <p className="text-sm font-medium text-green-100">Completed service value</p>
        <p className="mt-1 font-display text-5xl font-bold leading-none tracking-tight tabular-nums">
          {formatCents(summary.completedCents, currency)}
        </p>
        <p className="mt-2 text-[15px] tabular-nums text-green-100">
          of {formatCents(summary.scheduledCents, currency)} scheduled service value
        </p>
      </div>

      <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
        {segments.map((p) => (
          <div
            key={p.key}
            className={p.bar}
            style={{ width: `${(summary[p.key] / summary.scheduledCents) * 100}%` }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] tabular-nums text-green-50">
        {PARTS.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.dot}`} />
            {p.label} {formatCents(summary[p.key], currency)}
          </li>
        ))}
      </ul>

      {movedNames.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl bg-white/10 px-3 py-2.5 text-[13px] leading-snug text-green-50">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="mt-px shrink-0"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 7.2v4M8 4.9v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>
            {joinNames(movedNames)} {movedNames.length === 1 ? "was" : "were"} stopped and
            rescheduled, so {formatCents(summary.movedCents, currency)} is not counted today.
          </span>
        </div>
      )}
    </section>
  );
}
