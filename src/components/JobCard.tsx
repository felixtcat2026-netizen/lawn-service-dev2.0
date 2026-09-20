import { JobActionsPanel } from "@/components/JobActionsPanel";
import { STATUS_BADGE_CLASS, formatDateLabel } from "@/lib/domain/jobDisplay";
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
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold">{job.customerName}</p>
          <p className="text-sm font-medium text-(--color-primary-dark)">
            {formatDateLabel(job.scheduledDate)}
            {job.status === "rescheduled" && job.scheduledDate !== job.originalServiceDate && (
              <span className="font-normal text-gray-500">
                {" "}
                (moved from {formatDateLabel(job.originalServiceDate)})
              </span>
            )}
          </p>
          <p className="text-sm text-gray-600">{job.address}</p>
          <p className="mt-1 text-sm">{job.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[job.status]}`}
          >
            {job.status.replace("_", " ")}
          </span>
          <span className="text-sm font-medium">
            {formatCents(job.priceCents, job.currency)}
          </span>
        </div>
      </div>

      {job.isOverdue && job.status !== "completed" && job.status !== "cancelled" && (
        <p className="mt-2 text-sm font-medium text-(--color-danger)">
          Overdue -- originally due {formatDateLabel(job.originalServiceDate)}
        </p>
      )}

      <div className="mt-3">
        <JobActionsPanel job={job} />
      </div>
    </div>
  );
}
