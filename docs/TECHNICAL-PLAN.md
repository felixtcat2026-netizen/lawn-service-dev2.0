# Technical Plan (V1)

Agreed during planning (Prompt 3) and implemented in Prompt 4. This is the
build's source of truth for schema, recurrence, timer, and access rules --
update it if any of this changes.

## Pages & the owner's daily workflow
Bottom nav (mobile-first): **Today | Customers | Schedule**

- `/login` -- Supabase Auth email/password (single owner, no signup UI)
- `/` (Today) -- default landing page: today's jobs, visible active job
  banner, completed/remaining counts, today's scheduled & completed service
  value, overdue section
- `/customers` -- searchable list (active by default, toggle for inactive)
- `/customers/new`, `/customers/[id]` -- add/edit/view, with history
- `/schedule` -- create a service schedule, manage active schedules,
  upcoming jobs by date with an overdue section

## Tables & relationships
- `organizations(id, name, timezone, currency, created_at)`
- `organization_members(id, organization_id, user_id, role, created_at)` --
  unique `(organization_id, user_id)`; V1 has exactly one row, role `'owner'`
- `customers(id, organization_id, first_name, last_name, phone, email,
  address_line1, city, state, postal_code, default_price_cents,
  general_notes, property_notes, gate_code, access_notes, is_active,
  created_at, updated_at)`
- `service_schedules(id, organization_id, customer_id, description,
  price_cents, estimated_minutes, start_date, recurrence, is_active,
  last_generated_through, created_at, updated_at)` -- `recurrence`:
  `one_time | weekly | biweekly | monthly`; `last_generated_through` is the
  generation cursor
- `jobs(id, organization_id, customer_id, schedule_id,
  original_service_date, scheduled_date, status, description, price_cents,
  estimated_minutes, completion_notes, skip_reason, cancelled_at,
  completed_at, created_at, updated_at)` -- status:
  `scheduled | in_progress | completed | rescheduled | cancelled`; unique
  `(schedule_id, original_service_date)` makes generation idempotent and
  blocks re-creating a moved/skipped occurrence
- `time_entries(id, organization_id, job_id, started_at, ended_at,
  duration_seconds, is_manual_correction, correction_reason, created_at)`
  -- partial unique index on `organization_id` WHERE `ended_at IS NULL`
  enforces one active timer per organization at the database level
- `job_change_history(id, organization_id, job_id, change_type,
  previous_date, new_date, reason, previous_values, changed_at)` -- audit
  trail for moves, skips, completions, and manual timer corrections

All tables carry `organization_id`. Consistency triggers (in
`0001_init.sql`) keep a schedule's/job's/time entry's `organization_id`
aligned with its parent row, even though writes go through functions, not
raw client inserts.

## Organization access rules & safe owner setup
- RLS enabled on every table. Policies check membership via `organization_id
  in (select organization_id from organization_members where user_id =
  auth.uid())` -- a client-supplied `organization_id` is never trusted on
  its own.
- Business-logic functions (`start_job`, `complete_job`, `move_job`, etc.)
  are `SECURITY INVOKER`, so RLS applies inside them exactly as it would
  for a direct table query; a job/schedule/customer id from another
  organization simply isn't found, so cross-organization calls fail closed
  with "not found," not a permissions leak.
- Owner account: created manually in the Supabase dashboard
  (Authentication -> Users), then one `organizations` row + one
  `organization_members` row inserted via the SQL editor. No signup route
  exists in the app.

## Recurring job generation without duplicates
- `generate_jobs_for_schedule(schedule_id)` computes due occurrence dates
  from `last_generated_through` (or `start_date` if never run) out to
  today + 8 weeks, in the business timezone, then inserts with
  `ON CONFLICT (schedule_id, original_service_date) DO NOTHING` inside one
  function call (implicitly one transaction).
- Runs on: schedule save (`createSchedule` action), and on every dashboard
  load by the authenticated owner (`generate_jobs_for_organization`,
  called from the Today and Schedule pages) -- run-on-use, not a background
  scheduler.
- Monthly math: `least(anchor_day, days_in_month(target_month))` -- clamps
  in short months and returns to the original day once it exists again.
  Mirrored in TypeScript at `src/lib/domain/recurrence.ts` for schedule
  previews, and unit tested in `recurrence.test.ts`.
- A long absence is caught up automatically via the cursor; anything due in
  the past shows in the overdue section, never silently marked done.

## Moved/skipped visits and the generator
- A job's identity is `(schedule_id, original_service_date)` -- permanent,
  even after a move. `scheduled_date` is separate and is what changes.
- Move (`move_job`/`stop_and_reschedule`): updates `scheduled_date`, status
  `rescheduled`, writes `job_change_history`. Landing on a date with
  another non-cancelled visit for the same customer raises
  `DATE_CONFLICT` unless the owner explicitly confirms keeping both.
- Skip (`skip_job`): status `cancelled` with a `skip_reason`. The row
  already exists for that `original_service_date`, so the unique
  constraint blocks the generator from recreating it.

## Timer durability
- `started_at`/`ended_at` are `timestamptz` set by `now()` inside the
  database function -- never trusted from the client.
- `ElapsedTimer` (client component) re-derives elapsed time from the
  persisted `started_at` on every render; a page reload re-fetches that
  timestamp from the database, so refresh/navigation/phone lock/re-sign-in
  all reconstruct the same timer.
- `stop_and_reschedule` closes the entry (duration retained) and moves the
  job; a later `start_job` opens a new entry. Total time is the sum of
  closed entries plus any live entry.

## Concurrency safety
- `start_job`: insert + status update in one function call, guarded by the
  partial unique index on `time_entries`. A race (two tabs, a retried tap)
  becomes a `unique_violation`, surfaced to the app as
  `ACTIVE_TIMER_EXISTS`, which the UI shows as "a job is already in
  progress" rather than creating a duplicate timer.
- `complete_job`: idempotent -- if the job is already `completed`, it
  returns the current row without adding time or duplicating history.

## Milestones (build order)
1. Foundation/auth/schema -- migrations, RLS, functions, Next.js scaffold,
   Supabase SSR client setup, owner provisioning docs.
2. Customers -- CRUD, search, deactivate/reactivate.
3. Schedules & job generation -- schedule form, generation RPCs, upcoming
   list.
4. Timer/complete/reschedule -- Start/Complete/Move/Skip UI wired to the
   RPCs, `ElapsedTimer`.
5. Dashboard/history -- Today page counts/values, customer history with
   average duration.
6. Verification -- automated checks + manual walkthrough (see
   docs/BUILD-STATUS.md for what has actually been run).

## Known V1 simplifications (documented, not oversights)
- "Completed service value for jobs completed today" is computed from
  jobs whose `scheduled_date` is today's business date and whose status is
  `completed`, not from `completed_at`'s calendar date. In the normal
  workflow (start and complete a job the same day it's scheduled) these
  match; a job completed well after its scheduled date is a currently
  unhandled edge case for this specific stat.
