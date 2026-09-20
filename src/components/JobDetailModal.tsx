"use client";

import { useEffect, useState } from "react";
import { JobActionsPanel } from "@/components/JobActionsPanel";
import type { JobCardData } from "@/components/JobCard";
import { getRecentOccurrences, type RecentOccurrence } from "@/lib/actions/jobs";
import {
  STATUS_BADGE_CLASS,
  formatDateLabel,
  formatShortDateLabel,
} from "@/lib/domain/jobDisplay";
import { formatCents } from "@/lib/domain/money";

/**
 * The shared "tap a job, see everything, act on it, close it" sheet used by
 * every Schedule view (List/Week/Day/Month) so the interaction is the same
 * regardless of which view the owner is looking at.
 */
export function JobDetailModal({
  job,
  onClose,
  onChanged,
}: {
  job: JobCardData;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [recent, setRecent] = useState<RecentOccurrence[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecentOccurrences(job.scheduleId, job.originalServiceDate, job.id).then((rows) => {
      if (!cancelled) setRecent(rows);
    });
    return () => {
      cancelled = true;
    };
    // job.id alone is enough: the modal is only ever open for one job at a
    // time (see ScheduleCalendar), so a new job.id always means a fresh
    // mount with recent already at its initial null state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-(--color-surface) p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{job.customerName}</p>
            <p className="text-sm font-medium text-(--color-primary-dark)">
              {formatDateLabel(job.scheduledDate)}
              {job.status === "rescheduled" && job.scheduledDate !== job.originalServiceDate && (
                <span className="font-normal text-gray-500">
                  {" "}
                  (moved from {formatDateLabel(job.originalServiceDate)})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[job.status]}`}
          >
            {job.status.replace("_", " ")}
          </span>
          <span className="text-sm font-medium">{formatCents(job.priceCents, job.currency)}</span>
        </div>

        <p className="text-sm text-gray-600">{job.address}</p>
        <p className="mb-4 mt-1 text-sm">{job.description}</p>

        <div className="mb-4 rounded-xl border border-(--color-border) p-3">
          <JobActionsPanel job={job} onChanged={onChanged} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Recent visits</h3>
          {recent === null ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-gray-400">No earlier visits on this schedule yet.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((r) => (
                <li key={r.id} className="flex justify-between text-sm text-gray-600">
                  <span>
                    {formatShortDateLabel(r.originalServiceDate)} --{" "}
                    {r.status.replace("_", " ")}
                  </span>
                  <span>{formatCents(r.priceCents, job.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
