import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS, statusLabel } from "@/lib/domain/jobDisplay";
import type { JobStatus } from "@/lib/supabase/types";

export function StatusChip({
  status,
  skipReason = null,
}: {
  status: JobStatus;
  skipReason?: string | null;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`} aria-hidden="true" />
      {statusLabel(status, skipReason)}
    </span>
  );
}
