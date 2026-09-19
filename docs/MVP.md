# Version 1 (MVP) Requirements

Goal: replace one owner's iPhone Notes with a reliable, mobile-first daily
tool. Core workflow:

Customer -> recurring schedule -> generated job -> Start Job ->
Complete Job OR stop and reschedule unfinished work.

## Stack and scope
Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL, Supabase
Auth, Row Level Security, Vercel-compatible hosting. Supabase directly, no
Prisma. Check current official documentation for installed versions. Commit
a lockfile; keep the setup reproducible.

One business, one owner login, one service property per customer for now.
Keep `organization_id` throughout business data for future expansion. The
owner operates the timer in V1; separate crew accounts come later.

**Explicitly out of scope for V1:** weather, SMS, email automation, routing,
payments, invoices, crew management, advanced analytics, AI, customer
portal, public signup, photos, realtime subscriptions, offline
synchronization.

## 1. Authentication and data access
- Owner login/logout; protected pages and server operations.
- Document how to provision the owner and their organization safely.
- Tables (or equivalent): organizations, organization membership, customers,
  service schedules, jobs, time entries, and a small job-change history.
- Use migrations, foreign keys, useful indexes, and organization-consistent
  relationships. Never trust an `organization_id` supplied by the browser.
- Enable RLS on all exposed tables; restrict reads/writes by membership.
- Test signed-out access and another organization's access, including
  writes — both must be denied.
- Secret/service-role keys stay server-only, never in `NEXT_PUBLIC` vars.

## 2. Customers
- List, search, add, edit, view, and deactivate customers.
- Fields: first and last name, phone, optional email, service address,
  city/state/postal code, default visit price, general notes, property
  notes, gate code, pet/access notes.
- Validate required fields and prices.
- Deactivating a customer keeps their historical jobs, disables their
  schedules, and cancels future unstarted jobs — after a clear confirmation.
- Any active job must be resolved before deactivation.
- Reactivation must not silently restart old schedules.
- Store price values in integer minor currency units (e.g. cents).

## 3. Service schedules and automatic job generation
- A schedule belongs to a customer: service description, price, optional
  estimated minutes, start date, recurrence, active flag.
- Recurrence options: one-time, weekly, every two weeks, monthly.
  - Weekly/biweekly use the start date as the weekday anchor.
  - Monthly uses the same day of month, clamped to the last day in short
    months, then returns to the original day in later months. Monthly is
    NOT "every 4 weeks."
- Use the business timezone for service dates and dashboard date
  boundaries; store event timestamps in UTC. Confirm timezone/currency if
  not already documented (see BUILD-STATUS).
- Automatically generate a rolling 8-week window of jobs when a schedule is
  saved and when the authenticated owner opens the dashboard. Provide a safe
  retry. This is a run-on-use mechanism in V1, not an unattended background
  scheduler.
- After a long absence, catch up missed occurrences since the last
  generation cursor and show past pending work as overdue. Never silently
  mark it done.
- Generation must be transactional and safe under retries/concurrent
  requests.
- Uniquely identify an occurrence by `schedule_id` + its ORIGINAL service
  date. Store that original date separately from the current scheduled
  date. Database uniqueness must prevent duplicate occurrences even after a
  move, skip, or cancellation.
- Snapshot service description and price onto each job so history stays
  stable if the schedule later changes.
- Schedules can be disabled; no complex in-place series editing in V1. To
  change cadence: disable the old schedule, resolve its future pending
  visits, and create a new schedule. Explain this in the UI so visits are
  not accidentally duplicated.

## 4. Jobs and rescheduling
- Provide a Today view and an upcoming date-based job list with an overdue
  section.
- Statuses: `scheduled`, `in_progress`, `completed`, `rescheduled`,
  `cancelled`.
  - `rescheduled` means pending work on a changed date — still startable.
- Actions: move to Tomorrow, move to a Custom Date, or Skip This Visit (the
  same label for all cadences; for weekly work it skips that week).
- Moving a job retains its original occurrence identity and records move
  history. A move must not shift the recurring schedule or duplicate the
  visit.
- Skip marks that occurrence `cancelled` with a skip reason, preserved so
  the generator cannot recreate it. The next regular occurrence is
  unaffected.
- Do not silently merge visits if a moved job lands on a date with another
  scheduled visit. Show a conflict message; let the owner pick another date
  or explicitly keep both. Record original/new dates, reason, and change
  timestamp.
- Completed jobs are not startable or reschedulable.

## 5. Durable job timer and completion
- Large Start Job / Complete Job controls, usable on an iPhone.
- Starting a job creates a persisted time entry with an authoritative
  server/database `started_at` timestamp and sets the job `in_progress` in
  one atomic operation.
- Display elapsed time from persisted timestamps, not a browser counter
  alone. After refresh, navigation, phone lock, browser closure, or
  re-sign-in, reconstruct the timer from saved data. Use server time to
  limit clock drift.
- Only one running job for the owner at a time, enforced in the database.
  Repeated taps, retries, and two tabs must not create duplicate active
  entries.
- Complete Job closes the active entry using a server/database `ended_at`,
  calculates a nonnegative duration in seconds, stores `completed_at` and
  optional completion notes, and marks the job `completed` atomically.
  Completion is idempotent — repeated requests must not add time or
  duplicate history.
- Stop and Reschedule: closes the current entry (retaining its duration)
  and moves the same job for unfinished work. A later Start Job opens a new
  entry; total service time is the sum of closed entries plus any live
  entry. Never leave a timer running on a rescheduled or cancelled job.
- General pause/resume controls are out of scope for V1.
- Allow owner corrections for forgotten timers, requiring a reason and
  preserving original values. Reject negative or overlapping time
  intervals.
- Completion requires either a started timer or an explicit, reasoned
  manual duration — never invent a zero duration when time was never
  recorded.
- V1 requires internet connectivity for saving actions. Clearly report
  failed saves, keep entered information available to retry, and never show
  a successful start/complete until the database confirms it. A previously
  saved timer continues measuring elapsed time while the phone is
  disconnected — this does not mean the app supports offline job updates.

## 6. Dashboard and customer history
- Show today's jobs, completed count, remaining count, and a visible active
  job.
- Overdue pending jobs shown separately; cancelled visits excluded.
- Show scheduled service value for today's noncancelled visits and
  completed service value for jobs completed today. Label both as "service
  value," not "payments collected" — payment tracking is a later phase.
- Customer history shows dates, statuses, job notes, prices, actual
  durations, and average duration for completed jobs with valid recorded
  time, including the sample count and an empty state when there's no valid
  timing history.
- Service duration excludes travel and is elapsed work time, not crew
  labor-hours.

## 7. Mobile experience
- Simple navigation: Today, Customers, Schedule.
- Large labeled buttons, readable text, accessible forms, clear
  loading/error/empty states, no horizontal scrolling.
- Keep the daily workflow to very few taps. Start with lists; a complex
  calendar or drag-and-drop interface is unnecessary.

## Build order
Foundation/auth/schema -> customers -> schedules/jobs ->
timer/complete/reschedule -> dashboard/history -> verification.

## Acceptance checklist (manual walkthrough)
- [ ] Log in and add a fictional customer named Test Lawn at a fictional
      address.
- [ ] Create a weekly service priced at 50 currency units, starting today.
- [ ] Confirm today's job and future weekly jobs appear. Refresh twice: no
      duplicates.
- [ ] Start today's job. Refresh and reopen the browser: elapsed time
      continues.
- [ ] Try to start a second job: the app directs you to the existing active
      job.
- [ ] Complete the job with a note. Confirm saved duration and customer
      history.
- [ ] Move the next visit to tomorrow. Confirm it appears once and the
      series keeps its original cadence.
- [ ] Start that visit, then Stop and Reschedule. Restart later and
      complete; both time segments count.
- [ ] Skip another visit. Refresh: it stays skipped and the following visit
      remains.
- [ ] Confirm dashboard counts and service values match these records.
- [ ] Log out: customer information and gate codes must no longer be
      accessible.
- [ ] Automated tests demonstrate month-end recurrence, two-tab timer
      safety, and cross-organization access denial.

**Done/ready-for-pilot when:** the complete workflow uses saved database
records, automated tests have results, the app runs and the checklist above
passes. If credentials block testing, the milestone is still incomplete.
