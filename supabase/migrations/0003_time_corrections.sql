-- Owner corrections for timers that ran too long (e.g. forgot to tap
-- Complete Job). Both functions are SECURITY INVOKER, so RLS applies exactly
-- as for direct queries. Every correction requires a reason and writes the
-- ORIGINAL values to job_change_history (previous_values) before changing
-- anything, so nothing the owner corrected is ever lost. They reject
-- non-positive durations, times that run into the future, and any interval
-- that would overlap another time entry in the organization.

-- ---------------------------------------------------------------------------
-- Correct a CLOSED time entry (the job may already be completed).
-- Keeps started_at and moves ended_at, so the corrected interval always
-- begins when the timer actually started.
-- ---------------------------------------------------------------------------
create or replace function correct_time_entry(
  p_entry_id uuid,
  p_duration_seconds integer,
  p_reason text
)
returns time_entries
language plpgsql
security invoker
as $$
declare
  v_entry time_entries%rowtype;
  v_old time_entries%rowtype;
  v_new_end timestamptz;
begin
  select * into v_entry from time_entries where id = p_entry_id;
  if not found then
    raise exception 'That time entry was not found.' using errcode = 'P0002';
  end if;
  v_old := v_entry;

  if v_entry.ended_at is null then
    raise exception 'A running timer has to be completed, not corrected.' using errcode = 'JOB11';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to correct recorded time.' using errcode = 'JOB12';
  end if;
  if p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'The corrected time must be more than zero.' using errcode = 'JOB13';
  end if;

  -- Same value: nothing to change, and no duplicate history row.
  if v_entry.duration_seconds = p_duration_seconds then
    return v_entry;
  end if;

  v_new_end := v_entry.started_at + make_interval(secs => p_duration_seconds);
  if v_new_end > now() then
    raise exception 'The corrected time cannot run past the current time.' using errcode = 'JOB14';
  end if;

  if exists (
    select 1 from time_entries o
    where o.organization_id = v_entry.organization_id
      and o.id <> v_entry.id
      and o.started_at < v_new_end
      and coalesce(o.ended_at, 'infinity'::timestamptz) > v_entry.started_at
  ) then
    raise exception 'That time would overlap another recorded time entry.' using errcode = 'JOB15';
  end if;

  update time_entries
    set ended_at = v_new_end,
        duration_seconds = p_duration_seconds,
        is_manual_correction = true,
        correction_reason = p_reason
    where id = v_entry.id
    returning * into v_entry;

  insert into job_change_history (organization_id, job_id, change_type, reason, previous_values)
  values (
    v_entry.organization_id, v_entry.job_id, 'timer_correction', p_reason,
    jsonb_build_object(
      'time_entry_id', v_old.id,
      'original_started_at', v_old.started_at,
      'original_ended_at', v_old.ended_at,
      'original_duration_seconds', v_old.duration_seconds,
      'corrected_duration_seconds', p_duration_seconds
    )
  );

  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Complete a job whose timer is STILL RUNNING but should have stopped
-- earlier (forgot to tap Complete). Closes the live entry at
-- started_at + the owner's real duration instead of "now". The duration can
-- never exceed the time that has actually elapsed. Idempotent: repeating it
-- on a completed job returns the row without changing anything.
-- ---------------------------------------------------------------------------
create or replace function complete_job_corrected(
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
  v_entry time_entries%rowtype;
  v_elapsed integer;
  v_new_end timestamptz;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;

  if v_job.status = 'completed' then
    return v_job;
  end if;
  if v_job.status <> 'in_progress' then
    raise exception 'This job does not have a running timer to correct.' using errcode = 'JOB11';
  end if;

  select * into v_entry from time_entries
    where job_id = v_job.id and ended_at is null
    order by started_at desc limit 1;
  if not found then
    raise exception 'This job does not have a running timer to correct.' using errcode = 'JOB11';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to correct recorded time.' using errcode = 'JOB12';
  end if;
  if p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'The corrected time must be more than zero.' using errcode = 'JOB13';
  end if;

  v_elapsed := greatest(0, extract(epoch from (now() - v_entry.started_at))::int);
  if p_duration_seconds > v_elapsed then
    raise exception 'The corrected time cannot be longer than the time the timer has been running.' using errcode = 'JOB14';
  end if;

  v_new_end := v_entry.started_at + make_interval(secs => p_duration_seconds);

  update time_entries
    set ended_at = v_new_end,
        duration_seconds = p_duration_seconds,
        is_manual_correction = true,
        correction_reason = p_reason
    where id = v_entry.id;

  update jobs set status = 'completed', completed_at = now(), completion_notes = p_notes
    where id = v_job.id returning * into v_job;

  insert into job_change_history (organization_id, job_id, change_type, reason, previous_values)
  values (v_job.organization_id, v_job.id, 'complete', p_notes, jsonb_build_object('time_entry_id', v_entry.id));

  insert into job_change_history (organization_id, job_id, change_type, reason, previous_values)
  values (
    v_job.organization_id, v_job.id, 'timer_correction', p_reason,
    jsonb_build_object(
      'time_entry_id', v_entry.id,
      'original_started_at', v_entry.started_at,
      'original_ended_at', null,
      'original_elapsed_seconds', v_elapsed,
      'corrected_duration_seconds', p_duration_seconds
    )
  );

  return v_job;
end;
$$;

revoke execute on function
  correct_time_entry(uuid, integer, text),
  complete_job_corrected(uuid, integer, text, text)
from public, anon;

grant execute on function
  correct_time_entry(uuid, integer, text),
  complete_job_corrected(uuid, integer, text, text)
to authenticated;
