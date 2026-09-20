import { JobActionsPanel } from "@/components/JobActionsPanel";
import type { JobCardData } from "@/components/JobCard";
import { formatDateLabel } from "@/lib/domain/jobDisplay";
import { formatCents } from "@/lib/domain/money";

/**
 * The one job to focus on right now: the job in progress, or else the next
 * one up. Big type and thumb-sized buttons, since this is used standing in
 * a yard, in sunlight, one-handed.
 */
export function TodayHeroCard({
  job,
  estimatedMinutes,
}: {
  job: JobCardData;
  estimatedMinutes: number | null;
}) {
  const working = job.status === "in_progress";
  const movedHere = job.scheduledDate !== job.originalServiceDate;

  return (
    <section className="space-y-3.5 rounded-3xl border border-(--color-border) bg-(--color-surface) p-5">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider ${
            working ? "bg-(--color-primary) text-white" : "bg-green-100 text-green-900"
          }`}
        >
          {working ? "IN PROGRESS" : "UP NEXT"}
        </span>
        {estimatedMinutes && (
          <span className="text-[13px] text-gray-600">about {estimatedMinutes} min</span>
        )}
      </div>

      <div>
        <p className="text-[26px] font-bold leading-tight tracking-tight">{job.customerName}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[15px] text-gray-600">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 14.5s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {job.address}
        </p>
        <p className="mt-2 text-base">
          {job.description} ·{" "}
          <span className="font-semibold tabular-nums">
            {formatCents(job.priceCents, job.currency)}
          </span>
        </p>
        {movedHere && (
          <p className="mt-1 text-sm text-amber-800">
            Moved from {formatDateLabel(job.originalServiceDate)}
          </p>
        )}
      </div>

      <JobActionsPanel job={job} variant="hero" />
    </section>
  );
}
