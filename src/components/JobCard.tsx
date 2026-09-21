import { JobActionsPanel } from "@/components/JobActionsPanel";
import { StatusChip } from "@/components/StatusChip";
import { formatDateLabel } from "@/lib/domain/jobDisplay";
import { formatCents } from "@/lib/domain/money";
import type { JobStatus } from "@/lib/supabase/types";

export interface JobCardData {
  id: string;
  scheduleId: string;
  customerName: string;
  address: string;
  status: JobStatus;
  scheduledDate: string;
  originalServiceDate: string;
  description: string;
  priceCents: number;
  currency: string;
  completionNotes: string | null;
  skipReason: string | null;
  activeTimerStartedAt: string | null;
  /** Sum of any earlier closed segments on this job (e.g. before a Stop and Reschedule). */
  priorSegmentSeconds: number;
  isOverdue: boolean;
}

export function JobCard({ job }: { job: JobCardData }) {
  const movedFrom =
    job.status === "rescheduled" && job.scheduledDate !== job.originalServiceDate
      ? job.originalServiceDate
      : null;
  const showOverdue = job.isOverdue && job.status !== "completed" && job.status !== "cancelled";

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-(--color-primary-dark)">
          {formatDateLabel(job.scheduledDate)}
          {movedFrom && (
            <span className="font-normal text-gray-600"> · from {formatDateLabel(movedFrom)}</span>
          )}
        </p>
        <StatusChip status={job.status} skipReason={job.skipReason} />
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xl font-bold leading-tight tracking-tight">
          {job.customerName}
        </p>
        <p className="font-display text-xl font-bold tabular-nums">
          {formatCents(job.priceCents, job.currency)}
        </p>
      </div>
      <p className="mt-1 text-sm text-gray-600">{job.address}</p>
      <p className="mt-1.5 text-[15px] leading-snug">{job.description}</p>

      {showOverdue && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-(--color-danger)">
          Overdue. Originally due {formatDateLabel(job.originalServiceDate)}.
        </p>
      )}

      <div className="mt-4">
        <JobActionsPanel job={job} />
      </div>
    </div>
  );
}
