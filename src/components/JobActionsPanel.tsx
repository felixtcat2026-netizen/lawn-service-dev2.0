"use client";

import { useState, useTransition } from "react";
import { ElapsedTimer } from "@/components/ElapsedTimer";
import { tomorrowIso } from "@/lib/domain/jobDisplay";
import {
  completeJob,
  completeJobManual,
  moveJob,
  skipJob,
  startJob,
  stopAndReschedule,
} from "@/lib/actions/jobs";
import type { JobCardData } from "@/components/JobCard";

type Panel = "none" | "complete" | "moveDate" | "skip" | "manualDuration" | "stopReschedule";

/**
 * The Start/Complete/Move/Skip/Stop-and-Reschedule controls for a single
 * job, extracted out of JobCard so the exact same logic can run either
 * inline (JobCard, on the Today page) or inside JobDetailModal (the
 * Schedule page's List/Week/Day/Month views) without duplicating it.
 */
export function JobActionsPanel({
  job,
  onChanged,
  variant = "default",
}: {
  job: JobCardData;
  onChanged?: () => void;
  /** "hero" renders the big thumb-friendly buttons and timer used on the Today page. */
  variant?: "default" | "hero";
}) {
  const hero = variant === "hero";
  const primaryBtn = hero
    ? "h-14 w-full rounded-2xl bg-(--color-primary) text-base font-bold text-white disabled:opacity-60"
    : "rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
  const stopBtn = hero
    ? "h-12 w-full rounded-2xl border border-(--color-border) text-[15px] font-semibold text-gray-700"
    : "rounded-lg border border-(--color-border) px-3 py-2 text-sm";
  const [panel, setPanel] = useState<Panel>("none");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPanel("none");
    setError(null);
    setConflict(false);
  }

  function run(action: () => Promise<{ error: string | null; conflict?: boolean }>) {
    startTransition(async () => {
      setError(null);
      setConflict(false);
      const result = await action();
      if (result.conflict) {
        setConflict(true);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      reset();
      onChanged?.();
    });
  }

  return (
    <div>
      {hero && job.status === "in_progress" && job.activeTimerStartedAt && (
        <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 p-3 text-center">
          <ElapsedTimer
            startedAt={job.activeTimerStartedAt}
            priorSeconds={job.priorSegmentSeconds}
            className="text-4xl font-bold tabular-nums text-(--color-primary-dark)"
          />
          <p className="mt-1 text-xs text-green-800">
            Time on this visit{job.priorSegmentSeconds > 0 ? " (total)" : ""}
          </p>
          {job.priorSegmentSeconds > 0 && (
            <p className="text-xs text-green-800">
              Includes {Math.round(job.priorSegmentSeconds / 60)} min from an earlier session
            </p>
          )}
        </div>
      )}

      {!hero && job.status === "in_progress" && job.activeTimerStartedAt && (
        <div className="mb-3">
          <div className="flex items-center gap-3">
            <ElapsedTimer
              startedAt={job.activeTimerStartedAt}
              priorSeconds={job.priorSegmentSeconds}
            />
            <span className="text-sm text-gray-500">
              elapsed{job.priorSegmentSeconds > 0 ? " (total)" : ""}
            </span>
          </div>
          {job.priorSegmentSeconds > 0 && (
            <p className="text-xs text-gray-500">
              Includes {Math.round(job.priorSegmentSeconds / 60)} min from an earlier session on
              this visit
            </p>
          )}
        </div>
      )}

      {job.status === "completed" && job.completionNotes && (
        <p className="mb-2 text-sm text-gray-600">Notes: {job.completionNotes}</p>
      )}
      {job.status === "cancelled" && job.skipReason && (
        <p className="mb-2 text-sm text-gray-500">Skipped: {job.skipReason}</p>
      )}

      {error && <p className="mb-2 text-sm text-(--color-danger)">{error}</p>}
      {conflict && (
        <div className="mb-2 rounded-lg bg-amber-50 p-3 text-sm">
          <p className="mb-2">Another visit is already scheduled for that date.</p>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-(--color-border) px-3 py-2 text-sm"
              onClick={() => setPanel("moveDate")}
            >
              Choose another date
            </button>
            <button
              disabled={pending}
              className="rounded-lg bg-(--color-primary) px-3 py-2 text-sm text-white"
              onClick={() => {
                const dateInput = document.getElementById(
                  `move-date-${job.id}`,
                ) as HTMLInputElement | null;
                const date = dateInput?.value ?? tomorrowIso(job.scheduledDate);
                run(() => moveJob(job.id, date, "", true));
              }}
            >
              Keep both
            </button>
          </div>
        </div>
      )}

      {(job.status === "scheduled" || job.status === "rescheduled") && panel === "none" && (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending}
            className={primaryBtn}
            onClick={() => run(() => startJob(job.id))}
          >
            Start Job
          </button>
          <button
            disabled={pending}
            className="rounded-lg border border-(--color-border) px-3 py-2 text-sm"
            onClick={() => run(() => moveJob(job.id, tomorrowIso(job.scheduledDate), "", false))}
          >
            Move to Tomorrow
          </button>
          <button
            className="rounded-lg border border-(--color-border) px-3 py-2 text-sm"
            onClick={() => setPanel("moveDate")}
          >
            Move to Custom Date
          </button>
          <button
            className="rounded-lg border border-(--color-border) px-3 py-2 text-sm"
            onClick={() => setPanel("skip")}
          >
            Skip This Visit
          </button>
          <button
            className="text-sm text-gray-500 underline"
            onClick={() => setPanel("manualDuration")}
          >
            Forgot to start the timer? Log time manually
          </button>
        </div>
      )}

      {job.status === "in_progress" && panel === "none" && (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending}
            className={primaryBtn}
            onClick={() => setPanel("complete")}
          >
            Complete Job
          </button>
          <button
            className={stopBtn}
            onClick={() => setPanel("stopReschedule")}
          >
            Stop and Reschedule
          </button>
        </div>
      )}

      {panel === "complete" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const notes = (e.currentTarget.elements.namedItem("notes") as HTMLTextAreaElement)
              .value;
            run(() => completeJob(job.id, notes));
          }}
        >
          <textarea
            name="notes"
            placeholder="Completion notes (optional)"
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm Complete
            </button>
            <button type="button" className="text-sm text-gray-500" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "stopReschedule" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const date = (form.elements.namedItem("date") as HTMLInputElement).value;
            const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
            run(() => stopAndReschedule(job.id, date, reason, false));
          }}
        >
          <input
            id={`move-date-${job.id}`}
            name="date"
            type="date"
            required
            defaultValue={tomorrowIso(job.scheduledDate)}
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
          />
          <input
            name="reason"
            type="text"
            placeholder="Reason (optional)"
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white"
            >
              Stop and Reschedule
            </button>
            <button type="button" className="text-sm text-gray-500" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "moveDate" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const date = (form.elements.namedItem("date") as HTMLInputElement).value;
            const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
            run(() => moveJob(job.id, date, reason, false));
          }}
        >
          <input
            id={`move-date-${job.id}`}
            name="date"
            type="date"
            required
            defaultValue={tomorrowIso(job.scheduledDate)}
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
          />
          <input
            name="reason"
            type="text"
            placeholder="Reason (optional)"
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white"
            >
              Move Visit
            </button>
            <button type="button" className="text-sm text-gray-500" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "skip" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("reason") as HTMLInputElement)
              .value;
            run(() => skipJob(job.id, reason));
          }}
        >
          <input
            name="reason"
            type="text"
            required
            placeholder="Reason for skipping (required)"
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-(--color-danger) px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm Skip
            </button>
            <button type="button" className="text-sm text-gray-500" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "manualDuration" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const minutes = Number((form.elements.namedItem("minutes") as HTMLInputElement).value);
            const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
            const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value;
            run(() => completeJobManual(job.id, minutes, reason, notes));
          }}
        >
          <input
            name="minutes"
            type="number"
            min="0"
            step="1"
            required
            placeholder="Minutes worked"
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
          />
          <input
            name="reason"
            type="text"
            required
            placeholder="Reason the timer wasn't used (required)"
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
          />
          <textarea
            name="notes"
            placeholder="Completion notes (optional)"
            className="w-full rounded-lg border border-(--color-border) p-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white"
            >
              Complete with Manual Time
            </button>
            <button type="button" className="text-sm text-gray-500" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
