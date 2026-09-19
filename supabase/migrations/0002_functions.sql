-- Business-logic functions. All are SECURITY INVOKER (the default) so Row
-- Level Security is enforced using the calling owner's session exactly as
-- it would be for a direct table query -- these functions provide
-- atomicity and validation, not privilege escalation. A p_job_id or
-- p_schedule_id belonging to another organization simply will not be found
-- (RLS hides the row), so cross-organization access fails closed.

-- ---------------------------------------------------------------------------
-- Job generation
-- ---------------------------------------------------------------------------
create or replace function insert_job_occurrence(p_schedule service_schedules, p_occurrence date)
returns void
language plpgsql
security invoker
as $$
begin
  insert into jobs (
    organization_id, customer_id, schedule_id,
    original_service_date, scheduled_date, status,
    description, price_cents, estimated_minutes
  )
  values (
    p_schedule.organization_id, p_schedule.customer_id, p_schedule.id,
    p_occurrence, p_occurrence, 'scheduled',
    p_schedule.description, p_schedule.price_cents, p_schedule.estimated_minutes
  )
  on conflict (schedule_id, original_service_date) do nothing;
end;
$$;

-- Generates a rolling 8-week window of jobs for one schedule, in the
-- business's timezone, resuming from the schedule's cursor
-- (last_generated_through) so a long absence is caught up rather than
-- skipped. Safe to call repeatedly/concurrently: every insert is
-- deduplicated by the (schedule_id, original_service_date) unique
-- constraint.
create or replace function generate_jobs_for_schedule(p_schedule_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_schedule service_schedules%rowtype;
  v_org organizations%rowtype;
  v_today date;
  v_window_end date;
  v_cursor date;
  v_occurrence date;
  v_step int;
  v_anchor_day int;
  v_month_cursor date;
  v_days_in_month int;
begin
  select * into v_schedule from service_schedules where id = p_schedule_id;
  if not found then
    return;
  end if;
  if not v_schedule.is_active then
    return;
  end if;

  select * into v_org from organizations where id = v_schedule.organization_id;
  v_today := (now() at time zone v_org.timezone)::date;
  v_window_end := v_today + 56; -- rolling 8-week window
  v_cursor := coalesce(v_schedule.last_generated_through, v_schedule.start_date - 1);

  if v_schedule.recurrence = 'one_time' then
    if v_schedule.start_date <= v_window_end and v_schedule.start_date > v_cursor then
      perform insert_job_occurrence(v_schedule, v_schedule.start_date);
    end if;

  elsif v_schedule.recurrence in ('weekly', 'biweekly') then
    v_step := case when v_schedule.recurrence = 'weekly' then 7 else 14 end;
    v_occurrence := v_schedule.start_date;
    while v_occurrence <= v_window_end loop
      if v_occurrence > v_cursor then
        perform insert_job_occurrence(v_schedule, v_occurrence);
      end if;
      v_occurrence := v_occurrence + v_step;
    end loop;

  elsif v_schedule.recurrence = 'monthly' then
    v_anchor_day := extract(day from v_schedule.start_date);
    v_month_cursor := date_trunc('month', v_schedule.start_date)::date;
    loop
      v_days_in_month := extract(day from ((v_month_cursor + interval '1 month - 1 day')::date));
      v_occurrence := v_month_cursor + (least(v_anchor_day, v_days_in_month) - 1);
      exit when v_occurrence > v_window_end;
      if v_occurrence >= v_schedule.start_date and v_occurrence > v_cursor then
        perform insert_job_occurrence(v_schedule, v_occurrence);
      end if;
      v_month_cursor := (v_month_cursor + interval '1 month')::date;
    end loop;
  end if;

  update service_schedules set last_generated_through = v_window_end where id = v_schedule.id;
end;
$$;

-- Entry point called on dashboard load and after saving a schedule.
create or replace function generate_jobs_for_organization()
returns void
language plpgsql
security invoker
as $$
declare
  r service_schedules%rowtype;
begin
  for r in
    select * from service_schedules
    where organization_id in (select current_org_ids()) and is_active
  loop
    perform generate_jobs_for_schedule(r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Timer: start / complete / manual completion
-- ---------------------------------------------------------------------------

-- Starting a job is one atomic operation: insert the open time entry and
-- flip the job to in_progress. The partial unique index
-- time_entries_one_active_per_org turns a race between two taps or two
-- tabs into a unique_violation here, which is reported as a distinct,
-- catchable error rather than a duplicate active timer.
create or replace function start_job(p_job_id uuid)
returns jobs
language plpgsql
security invoker
as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if v_job.status not in ('scheduled', 'rescheduled') then
    raise exception 'job is not in a startable status' using errcode = 'JOBS1';
  end if;

  begin
    insert into time_entries (organization_id, job_id, started_at)
    values (v_job.organization_id, v_job.id, now());
  exception when unique_violation then
    raise exception 'ACTIVE_TIMER_EXISTS' using errcode = 'JOBS2';
  end;

  update jobs set status = 'in_progress' where id = v_job.id returning * into v_job;
  return v_job;
end;
$$;

-- Idempotent: calling this again after the job is already completed simply
-- returns the current row without adding time or duplicating history.
create or replace function complete_job(p_job_id uuid, p_notes text default null)
returns jobs
language plpgsql
security invoker
as $$
declare
  v_job jobs%rowtype;
  v_entry time_entries%rowtype;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;

  if v_job.status = 'completed' then
    return v_job;
  end if;
  if v_job.status <> 'in_progress' then
    raise exception 'job has no active timer to complete' using errcode = 'JOBS4';
  end if;

  select * into v_entry from time_entries
    where job_id = v_job.id and ended_at is null
    order by started_at desc limit 1;
  if not found then
    raise exception 'no active time entry found for job' using errcode = 'JOBS4';
  end if;

  update time_entries
    set ended_at = now(), duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int)
    where id = v_entry.id;

  update jobs set status = 'completed', completed_at = now(), completion_notes = p_notes
    where id = v_job.id returning * into v_job;

  insert into job_change_history (organization_id, job_id, change_type, reason, previous_values)
  values (v_job.organization_id, v_job.id, 'complete', p_notes, jsonb_build_object('time_entry_id', v_entry.id));

  return v_job;
end;
$$;

-- For a forgotten timer: the job was never started, so completion needs an
-- explicit reasoned manual duration instead of a live entry. Restricted to
-- jobs that were never started (in_progress must go through complete_job)
-- so a real running timer can never be silently overwritten.
create or replace function complete_job_manual(
  p_job_id uuid,
  p_duration_seconds integer,
  p_reason text,
  p_notes text default null
)
returns jobs
language plpgsql
security invoker
as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;

  if v_job.status = 'completed' then
    return v_job;
  end if;
  if v_job.status not in ('scheduled', 'rescheduled') then
    raise exception 'a job with an active timer must be completed with complete_job' using errcode = 'JOBS5';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 0 then
    raise exception 'duration must be zero or a positive number of seconds' using errcode = 'JOBS6';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required for a manual duration' using errcode = 'JOBS6';
  end if;

  insert into time_entries (
    organization_id, job_id, started_at, ended_at, duration_seconds,
    is_manual_correction, correction_reason
  )
  values (
    v_job.organization_id, v_job.id,
    now() - make_interval(secs => p_duration_seconds), now(), p_duration_seconds,
    true, p_reason
  );

  update jobs set status = 'completed', completed_at = now(), completion_notes = p_notes
    where id = v_job.id returning * into v_job;

  insert into job_change_history (organization_id, job_id, change_type, reason, previous_values)
  values (v_job.organization_id, v_job.id, 'timer_correction', p_reason, jsonb_build_object('duration_seconds', p_duration_seconds));

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Move / Skip / Stop and Reschedule
-- ---------------------------------------------------------------------------

-- Moves a not-yet-started (or already-moved) job to a new date. Landing on
-- a date that already has another non-cancelled visit for the same
-- customer raises DATE_CONFLICT unless p_confirm_conflict is true, letting
-- the owner explicitly keep both rather than silently merging them.
create or replace function move_job(
  p_job_id uuid,
  p_new_date date,
  p_reason text default null,
  p_confirm_conflict boolean default false
)
returns jobs
language plpgsql
security invoker
as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if v_job.status not in ('scheduled', 'rescheduled') then
    raise exception 'only a scheduled or rescheduled job can be moved this way' using errcode = 'JOBS7';
  end if;

  if not p_confirm_conflict and exists (
    select 1 from jobs
    where customer_id = v_job.customer_id
      and id <> v_job.id
      and scheduled_date = p_new_date
      and status <> 'cancelled'
  ) then
    raise exception 'DATE_CONFLICT' using errcode = 'JOBS8';
  end if;

  insert into job_change_history (organization_id, job_id, change_type, previous_date, new_date, reason)
  values (v_job.organization_id, v_job.id, 'move', v_job.scheduled_date, p_new_date, p_reason);

  update jobs set scheduled_date = p_new_date, status = 'rescheduled'
    where id = v_job.id returning * into v_job;

  return v_job;
end;
$$;

-- Closes the active timer (retaining its duration) and moves the job in
-- one call, for unfinished work found mid-visit. A later start_job opens a
-- new entry; total time is the sum of all closed entries plus any live one.
create or replace function stop_and_reschedule(
  p_job_id uuid,
  p_new_date date,
  p_reason text default null,
  p_confirm_conflict boolean default false
)
returns jobs
language plpgsql
security invoker
as $$
declare
  v_job jobs%rowtype;
  v_entry time_entries%rowtype;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if v_job.status <> 'in_progress' then
    raise exception 'job is not in progress' using errcode = 'JOBS9';
  end if;

  select * into v_entry from time_entries
    where job_id = v_job.id and ended_at is null
    order by started_at desc limit 1;
  if not found then
    raise exception 'no active time entry found for job' using errcode = 'JOBS9';
  end if;

  if not p_confirm_conflict and exists (
    select 1 from jobs
    where customer_id = v_job.customer_id
      and id <> v_job.id
      and scheduled_date = p_new_date
      and status <> 'cancelled'
  ) then
    raise exception 'DATE_CONFLICT' using errcode = 'JOBS8';
  end if;

  update time_entries
    set ended_at = now(), duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int)
    where id = v_entry.id;

  insert into job_change_history (organization_id, job_id, change_type, previous_date, new_date, reason)
  values (v_job.organization_id, v_job.id, 'move', v_job.scheduled_date, p_new_date, p_reason);

  update jobs set scheduled_date = p_new_date, status = 'rescheduled'
    where id = v_job.id returning * into v_job;

  return v_job;
end;
$$;

-- Marks an occurrence cancelled with a skip reason. Because the row
-- already exists for this (schedule_id, original_service_date), the
-- generator's ON CONFLICT DO NOTHING guarantees it is never recreated; the
-- next regular occurrence is unaffected.
create or replace function skip_job(p_job_id uuid, p_reason text)
returns jobs
language plpgsql
security invoker
as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if v_job.status not in ('scheduled', 'rescheduled') then
    raise exception 'only a scheduled or rescheduled job can be skipped' using errcode = 'JOB10';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to skip a visit' using errcode = 'JOB10';
  end if;

  insert into job_change_history (organization_id, job_id, change_type, previous_date, reason)
  values (v_job.organization_id, v_job.id, 'skip', v_job.scheduled_date, p_reason);

  update jobs set status = 'cancelled', skip_reason = p_reason, cancelled_at = now()
    where id = v_job.id returning * into v_job;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deactivate / reactivate a customer
-- Deactivation disables the customer's schedules and cancels their future
-- unstarted jobs. It refuses if any job is currently in_progress, so the
-- owner must resolve an active visit first. Reactivation never re-enables
-- schedules on its own.
-- ---------------------------------------------------------------------------
create or replace function deactivate_customer(p_customer_id uuid)
returns customers
language plpgsql
security invoker
as $$
declare
  v_customer customers%rowtype;
begin
  select * into v_customer from customers where id = p_customer_id;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from jobs where customer_id = p_customer_id and status = 'in_progress') then
    raise exception 'resolve the active job for this customer before deactivating' using errcode = 'CUST1';
  end if;

  update service_schedules set is_active = false
    where customer_id = p_customer_id and is_active;

  update jobs set status = 'cancelled', skip_reason = 'customer deactivated', cancelled_at = now()
    where customer_id = p_customer_id and status in ('scheduled', 'rescheduled');

  update customers set is_active = false where id = p_customer_id returning * into v_customer;
  return v_customer;
end;
$$;

create or replace function reactivate_customer(p_customer_id uuid)
returns customers
language plpgsql
security invoker
as $$
declare
  v_customer customers%rowtype;
begin
  update customers set is_active = true where id = p_customer_id returning * into v_customer;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  return v_customer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated (the signed-in owner) may call these; anonymous
-- (signed-out) may not.
-- ---------------------------------------------------------------------------
revoke execute on function
  insert_job_occurrence(service_schedules, date),
  generate_jobs_for_schedule(uuid),
  generate_jobs_for_organization(),
  start_job(uuid),
  complete_job(uuid, text),
  complete_job_manual(uuid, integer, text, text),
  move_job(uuid, date, text, boolean),
  stop_and_reschedule(uuid, date, text, boolean),
  skip_job(uuid, text),
  deactivate_customer(uuid),
  reactivate_customer(uuid)
from public, anon;

grant execute on function
  generate_jobs_for_organization(),
  start_job(uuid),
  complete_job(uuid, text),
  complete_job_manual(uuid, integer, text, text),
  move_job(uuid, date, text, boolean),
  stop_and_reschedule(uuid, date, text, boolean),
  skip_job(uuid, text),
  deactivate_customer(uuid),
  reactivate_customer(uuid)
to authenticated;
