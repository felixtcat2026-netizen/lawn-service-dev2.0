"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobCardData } from "@/components/JobCard";
import { JobDetailModal } from "@/components/JobDetailModal";
import {
  addDaysIso,
  addMonthsIso,
  compareIso,
  isSameMonth,
  monthGridDates,
  weekDates,
} from "@/lib/domain/calendar";
import { STATUS_DOT_CLASS, formatDateLabel, formatShortDateLabel } from "@/lib/domain/jobDisplay";
import { formatCents } from "@/lib/domain/money";

type View = "week" | "day" | "month";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return MONTH_LABEL.format(new Date((year ?? 1970), (month ?? 1) - 1, 1));
}

export function ScheduleCalendar({
  jobs,
  today,
}: {
  jobs: JobCardData[];
  today: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(today);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, JobCardData[]>();
    for (const job of jobs) {
      const list = map.get(job.scheduledDate) ?? [];
      list.push(job);
      map.set(job.scheduledDate, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.customerName.localeCompare(b.customerName));
    }
    return map;
  }, [jobs]);

  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : undefined;

  function step(direction: 1 | -1) {
    if (view === "day") setCursor((d) => addDaysIso(d, direction));
    else if (view === "week") setCursor((d) => addDaysIso(d, direction * 7));
    else setCursor((d) => addMonthsIso(d, direction));
  }

  function goToday() {
    setCursor(today);
  }

  return (
    <div>
      <div className="mb-3 flex rounded-lg border border-(--color-border) p-1 text-sm">
        {(["week", "day", "month"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-md py-1.5 text-center capitalize ${
              view === v ? "bg-(--color-primary) text-white" : "text-gray-600"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => step(-1)}
          aria-label="Previous"
          className="rounded-lg border border-(--color-border) px-3 py-1.5 text-sm"
        >
          ‹
        </button>
        <button onClick={goToday} className="text-sm font-medium text-(--color-primary-dark)">
          {view === "month"
            ? monthLabel(cursor)
            : view === "week"
              ? `Week of ${formatShortDateLabel(weekDates(cursor)[0]!)}`
              : formatDateLabel(cursor)}
        </button>
        <button
          onClick={() => step(1)}
          aria-label="Next"
          className="rounded-lg border border-(--color-border) px-3 py-1.5 text-sm"
        >
          ›
        </button>
      </div>

      {view === "day" && (
        <DayView
          date={cursor}
          jobs={jobsByDate.get(cursor) ?? []}
          onSelect={setSelectedJobId}
        />
      )}
      {view === "week" && (
        <WeekView
          dates={weekDates(cursor)}
          today={today}
          jobsByDate={jobsByDate}
          onSelect={setSelectedJobId}
        />
      )}
      {view === "month" && (
        <MonthView
          monthIso={cursor}
          today={today}
          jobsByDate={jobsByDate}
          onSelect={setSelectedJobId}
        />
      )}

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function DayView({
  date,
  jobs,
  onSelect,
}: {
  date: string;
  jobs: JobCardData[];
  onSelect: (id: string) => void;
}) {
  if (jobs.length === 0) {
    return <p className="text-sm text-gray-500">No jobs on {formatDateLabel(date)}.</p>;
  }
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <JobSummaryRow key={job.id} job={job} onClick={() => onSelect(job.id)} />
      ))}
    </div>
  );
}

function WeekView({
  dates,
  today,
  jobsByDate,
  onSelect,
}: {
  dates: string[];
  today: string;
  jobsByDate: Map<string, JobCardData[]>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {dates.map((date) => {
        const dayJobs = jobsByDate.get(date) ?? [];
        return (
          <div key={date}>
            <p
              className={`mb-1 text-sm font-semibold ${date === today ? "text-(--color-primary-dark)" : "text-gray-700"}`}
            >
              {formatDateLabel(date)} {date === today && "(today)"}
            </p>
            {dayJobs.length === 0 ? (
              <p className="pl-2 text-xs text-gray-400">No jobs</p>
            ) : (
              <div className="space-y-1.5">
                {dayJobs.map((job) => (
                  <JobSummaryRow key={job.id} job={job} onClick={() => onSelect(job.id)} compact />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  monthIso,
  today,
  jobsByDate,
  onSelect,
}: {
  monthIso: string;
  today: string;
  jobsByDate: Map<string, JobCardData[]>;
  onSelect: (id: string) => void;
}) {
  const grid = monthGridDates(monthIso);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((date) => {
          const dayJobs = (jobsByDate.get(date) ?? []).slice().sort((a, b) => compareIso(a.scheduledDate, b.scheduledDate));
          const visible = dayJobs.slice(0, 3);
          const overflow = dayJobs.length - visible.length;
          const inMonth = isSameMonth(date, monthIso);
          const [, , dayNum] = date.split("-");
          return (
            <div
              key={date}
              className={`min-h-[4.5rem] rounded-lg border p-1 text-left ${
                date === today
                  ? "border-(--color-primary) bg-green-50"
                  : "border-(--color-border)"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <p className="text-xs text-gray-500">{Number(dayNum)}</p>
              <div className="mt-1 space-y-0.5">
                {visible.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => onSelect(job.id)}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white ${STATUS_DOT_CLASS[job.status]}`}
                    title={job.customerName}
                  >
                    {job.customerName}
                  </button>
                ))}
                {overflow > 0 && <p className="text-[10px] text-gray-500">+{overflow} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobSummaryRow({
  job,
  onClick,
  compact,
}: {
  job: JobCardData;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface) text-left ${
        compact ? "px-2 py-1.5" : "p-3"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[job.status]}`} />
        <div>
          <p className="text-sm font-medium">{job.customerName}</p>
          {!compact && <p className="text-xs text-gray-500">{job.description}</p>}
        </div>
      </div>
      <span className="text-sm text-gray-600">{formatCents(job.priceCents, job.currency)}</span>
    </button>
  );
}
