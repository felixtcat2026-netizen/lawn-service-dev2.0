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

const INPUT =
  "h-12 w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-3 text-base";
const TEXTAREA =
  "w-full rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-base";
const FIELD_LABEL = "block space-y-1 text-sm font-medium text-gray-700";
const CONFIRM_BTN =
  "h-12 flex-1 rounded-xl bg-(--color-primary) text-base font-semibold text-white transition-colors active:bg-(--color-primary-dark) disabled:opacity-60";
const DANGER_BTN =
  "h-12 flex-1 rounded-xl bg-(--color-danger) text-base font-semibold text-white disabled:opacity-60";
const CANCEL_BTN = "h-12 px-4 text-[15px] font-medium text-gray-600";
const SECONDARY_BTN =
  "flex min-h-11 items-center justify-center rounded-xl border border-(--color-border) bg-(--color-surface) px-2 py-2 text-center text-[13px] font-medium leading-tight text-gray-800 active:bg-gray-50 disabled:opacity-60";

/**
 * The Start/Complete/Move/Skip/Stop-and-Reschedule controls for a single
 * job, extracted out of JobCard so the exact same logic can run either
 * inline (JobCard, on the Today page) or inside JobDetailModal (the
 * Schedule page's List/Week/Day/Month views) without duplicating it.
 *
 * Every control is at least 44px tall and every text field is 16px, so it
 * works one-handed on a phone without the browser zooming in on focus.
 */
export function JobActionsPanel({
  job,
  onChanged,
  variant = "default",
}: {
  job: JobCardData;
  onChanged?: () => void;
  /** "hero" renders the larger buttons and timer used for the featured job on the Today page. */
  variant?: "default" | "hero";
}) {
  const hero = variant === "hero";
  const primaryBtn = hero
    ? "h-14 w-full rounded-2xl bg-(--color-primary) text-base font-bold text-white transition-colors active:bg-(--color-primary-dark) disabled:opacity-60"
    : "h-12 w-full rounded-xl bg-(--color-primary) text-base font-semibold text-white transition-colors active:bg-(--color-primary-dark) disabled:opacity-60";
  const stopBtn = hero
    ? "h-12 w-full rounded-2xl border border-(--color-border) bg-(--color-surface) text-[15px] font-semibold text-gray-800 active:bg-gray-50"
    : "h-12 w-full rounded-xl border border-(--color-border) bg-(--color-surface) text-[15px] font-semibold text-gray-800 active:bg-gray-50";

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
            className="font-display text-4xl font-bold tabular-nums text-(--color-primary-dark)"
          />
          <p className="mt-1 text-xs text-green-900">
            Time on this visit{job.priorSegmentSeconds > 0 ? " (total)" : ""}
          </p>
          {job.priorSegmentSeconds > 0 && (
            <p className="text-xs text-green-900">
              Includes {Math.round(job.priorSegmentSeconds / 60)} min from an earlier session
            </p>
          )}
        </div>
      )}

      {!hero && job.status === "in_progress" && job.activeTimerStartedAt && (
        <div className="mb-3 rounded-xl bg-green-50 px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <ElapsedTimer
              startedAt={job.activeTimerStartedAt}
              priorSeconds={job.priorSegmentSeconds}
            />
            <span className="text-sm text-green-900">
              elapsed{job.priorSegmentSeconds > 0 ? " (total)" : ""}
            </span>
          </div>
          {job.priorSegmentSeconds > 0 && (
            <p className="text-xs text-green-900">
              Includes {Math.round(job.priorSegmentSeconds / 60)} min from an earlier session on
              this visit
            </p>
          )}
        </div>
      )}

      {job.status === "completed" && job.completionNotes && (
        <p className="mb-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Notes: {job.completionNotes}
        </p>
      )}
      {job.status === "cancelled" && job.skipReason && (
        <p className="mb-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Skipped: {job.skipReason}
        </p>
      )}

      {error && (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-(--color-danger)">{error}</p>
      )}
      {conflict && (
        <div className="mb-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-3">Another visit is already scheduled for that date.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={SECONDARY_BTN} onClick={() => setPanel("moveDate")}>
              Choose another date
            </button>
            <button
              disabled={pending}
              className="flex min-h-11 items-center justify-center rounded-xl bg-(--color-primary) px-2 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
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
        <div className="space-y-2.5">
          <button
            disabled={pending}
            className={primaryBtn}
            onClick={() => run(() => startJob(job.id))}
          >
            Start job
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              disabled={pending}
              className={SECONDARY_BTN}
              onClick={() => run(() => moveJob(job.id, tomorrowIso(job.scheduledDate), "", false))}
            >
              Move to tomorrow
            </button>
            <button className={SECONDARY_BTN} onClick={() => setPanel("moveDate")}>
              Move to a date
            </button>
            <button className={SECONDARY_BTN} onClick={() => setPanel("skip")}>
              Skip visit
            </button>
          </div>
          <button
            className="min-h-11 text-left text-sm text-gray-600 underline"
            onClick={() => setPanel("manualDuration")}
          >
            Forgot to start the timer? Log the time
          </button>
        </div>
      )}

      {job.status === "in_progress" && panel === "none" && (
        <div className="space-y-2.5">
          <button
            disabled={pending}
            className={primaryBtn}
            onClick={() => setPanel("complete")}
          >
            Complete job
          </button>
          <button className={stopBtn} onClick={() => setPanel("stopReschedule")}>
            Stop and reschedule
          </button>
        </div>
      )}

      {panel === "complete" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const notes = (e.currentTarget.elements.namedItem("notes") as HTMLTextAreaElement)
              .value;
            run(() => completeJob(job.id, notes));
          }}
        >
          <label className={FIELD_LABEL}>
            <span>Notes (optional)</span>
            <textarea name="notes" className={TEXTAREA} rows={3} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={CONFIRM_BTN}>
              {pending ? "Saving..." : "Complete job"}
            </button>
            <button type="button" className={CANCEL_BTN} onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "stopReschedule" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const date = (form.elements.namedItem("date") as HTMLInputElement).value;
            const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
            run(() => stopAndReschedule(job.id, date, reason, false));
          }}
        >
          <label className={FIELD_LABEL}>
            <span>Finish it on</span>
            <input
              id={`move-date-${job.id}`}
              name="date"
              type="date"
              required
              defaultValue={tomorrowIso(job.scheduledDate)}
              className={INPUT}
            />
          </label>
          <label className={FIELD_LABEL}>
            <span>Reason (optional)</span>
            <input name="reason" type="text" className={INPUT} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={CONFIRM_BTN}>
              {pending ? "Saving..." : "Stop and reschedule"}
            </button>
            <button type="button" className={CANCEL_BTN} onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "moveDate" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const date = (form.elements.namedItem("date") as HTMLInputElement).value;
            const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
            run(() => moveJob(job.id, date, reason, false));
          }}
        >
          <label className={FIELD_LABEL}>
            <span>Move to</span>
            <input
              id={`move-date-${job.id}`}
              name="date"
              type="date"
              required
              defaultValue={tomorrowIso(job.scheduledDate)}
              className={INPUT}
            />
          </label>
          <label className={FIELD_LABEL}>
            <span>Reason (optional)</span>
            <input name="reason" type="text" className={INPUT} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={CONFIRM_BTN}>
              {pending ? "Saving..." : "Move visit"}
            </button>
            <button type="button" className={CANCEL_BTN} onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "skip" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("reason") as HTMLInputElement)
              .value;
            run(() => skipJob(job.id, reason));
          }}
        >
          <label className={FIELD_LABEL}>
            <span>Why are you skipping this visit?</span>
            <input name="reason" type="text" required className={INPUT} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={DANGER_BTN}>
              {pending ? "Saving..." : "Skip visit"}
            </button>
            <button type="button" className={CANCEL_BTN} onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "manualDuration" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const minutes = Number((form.elements.namedItem("minutes") as HTMLInputElement).value);
            const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
            const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value;
            run(() => completeJobManual(job.id, minutes, reason, notes));
          }}
        >
          <label className={FIELD_LABEL}>
            <span>Minutes worked</span>
            <input name="minutes" type="number" min="0" step="1" required className={INPUT} />
          </label>
          <label className={FIELD_LABEL}>
            <span>Why wasn&apos;t the timer used?</span>
            <input name="reason" type="text" required className={INPUT} />
          </label>
          <label className={FIELD_LABEL}>
            <span>Notes (optional)</span>
            <textarea name="notes" className={TEXTAREA} rows={3} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={CONFIRM_BTN}>
              {pending ? "Saving..." : "Complete with this time"}
            </button>
            <button type="button" className={CANCEL_BTN} onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
