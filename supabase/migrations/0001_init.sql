-- Lawn Service App V1 schema
-- One business, one owner, one organization. organization_id kept throughout
-- for future multi-business expansion. RLS enforced on every exposed table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type recurrence_type as enum ('one_time', 'weekly', 'biweekly', 'monthly');
create type job_status as enum ('scheduled', 'in_progress', 'completed', 'rescheduled', 'cancelled');
create type job_change_type as enum ('move', 'skip', 'complete', 'timer_correction');

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null,
  currency text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- organization_members (owner provisioned manually; no public signup)
-- ---------------------------------------------------------------------------
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_id_idx on organization_members(user_id);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  phone text not null check (btrim(phone) <> ''),
  email text,
  address_line1 text not null check (btrim(address_line1) <> ''),
  city text not null check (btrim(city) <> ''),
  state text not null check (btrim(state) <> ''),
  postal_code text not null check (btrim(postal_code) <> ''),
  default_price_cents integer not null check (default_price_cents >= 0),
  general_notes text,
  property_notes text,
  gate_code text,
  access_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_org_idx on customers(organization_id);
create index customers_org_active_idx on customers(organization_id, is_active);

-- ---------------------------------------------------------------------------
-- service_schedules
-- ---------------------------------------------------------------------------
create table service_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  description text not null check (btrim(description) <> ''),
  price_cents integer not null check (price_cents >= 0),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  start_date date not null,
  recurrence recurrence_type not null,
  is_active boolean not null default true,
  last_generated_through date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_schedules_org_idx on service_schedules(organization_id);
create index service_schedules_customer_idx on service_schedules(customer_id);
create index service_schedules_org_active_idx on service_schedules(organization_id, is_active);

-- ---------------------------------------------------------------------------
-- jobs
-- original_service_date is the permanent occurrence identity; scheduled_date
-- is the current (possibly moved) date. Unique on (schedule_id,
-- original_service_date) prevents duplicate generation even after a move,
-- skip, or cancellation.
-- ---------------------------------------------------------------------------
create table jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  schedule_id uuid not null references service_schedules(id) on delete cascade,
  original_service_date date not null,
  scheduled_date date not null,
  status job_status not null default 'scheduled',
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  estimated_minutes integer,
  completion_notes text,
  skip_reason text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, original_service_date)
);
create index jobs_org_idx on jobs(organization_id);
create index jobs_org_scheduled_date_idx on jobs(organization_id, scheduled_date);
create index jobs_org_status_idx on jobs(organization_id, status);
create index jobs_customer_idx on jobs(customer_id);

-- ---------------------------------------------------------------------------
-- time_entries
-- Partial unique index guarantees only one open (active) timer per
-- organization at the database level -- this is what makes concurrent
-- starts and repeated taps safe.
-- ---------------------------------------------------------------------------
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  is_manual_correction boolean not null default false,
  correction_reason text,
  created_at timestamptz not null default now(),
  constraint time_entries_ended_after_started check (ended_at is null or ended_at >= started_at)
);
create index time_entries_org_idx on time_entries(organization_id);
create index time_entries_job_idx on time_entries(job_id);
create unique index time_entries_one_active_per_org on time_entries(organization_id) where ended_at is null;

-- ---------------------------------------------------------------------------
-- job_change_history
-- ---------------------------------------------------------------------------
create table job_change_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  change_type job_change_type not null,
  previous_date date,
  new_date date,
  reason text,
  previous_values jsonb,
  changed_at timestamptz not null default now()
);
create index job_change_history_job_idx on job_change_history(job_id);
create index job_change_history_org_idx on job_change_history(organization_id);

-- ---------------------------------------------------------------------------
-- Consistency triggers: a schedule's organization must match its customer's,
-- and a job's organization/customer must match its schedule's. This keeps
-- organization_id internally consistent even though writes go through
-- SECURITY INVOKER functions, not raw client inserts.
-- ---------------------------------------------------------------------------
create or replace function enforce_schedule_customer_org()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> (select organization_id from customers where id = new.customer_id) then
    raise exception 'service_schedules.organization_id must match customers.organization_id';
  end if;
  return new;
end;
$$;
create trigger service_schedules_org_consistency
  before insert or update on service_schedules
  for each row execute function enforce_schedule_customer_org();

create or replace function enforce_job_schedule_org()
returns trigger
language plpgsql
as $$
declare
  v_schedule service_schedules%rowtype;
begin
  select * into v_schedule from service_schedules where id = new.schedule_id;
  if new.organization_id <> v_schedule.organization_id then
    raise exception 'jobs.organization_id must match service_schedules.organization_id';
  end if;
  if new.customer_id <> v_schedule.customer_id then
    raise exception 'jobs.customer_id must match service_schedules.customer_id';
  end if;
  return new;
end;
$$;
create trigger jobs_org_consistency
  before insert or update on jobs
  for each row execute function enforce_job_schedule_org();

create or replace function enforce_time_entry_job_org()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> (select organization_id from jobs where id = new.job_id) then
    raise exception 'time_entries.organization_id must match jobs.organization_id';
  end if;
  return new;
end;
$$;
create trigger time_entries_org_consistency
  before insert or update on time_entries
  for each row execute function enforce_time_entry_job_org();

create or replace function enforce_history_job_org()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> (select organization_id from jobs where id = new.job_id) then
    raise exception 'job_change_history.organization_id must match jobs.organization_id';
  end if;
  return new;
end;
$$;
create trigger job_change_history_org_consistency
  before insert on job_change_history
  for each row execute function enforce_history_job_org();

-- updated_at maintenance
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger customers_set_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger service_schedules_set_updated_at before update on service_schedules
  for each row execute function set_updated_at();
create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Membership is always derived server-side from auth.uid(); organization_id
-- supplied by a client is never trusted on its own.
-- ---------------------------------------------------------------------------
create or replace function current_org_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select organization_id from organization_members where user_id = auth.uid()
$$;

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table customers enable row level security;
alter table service_schedules enable row level security;
alter table jobs enable row level security;
alter table time_entries enable row level security;
alter table job_change_history enable row level security;

-- organizations: members can read their own org row only. No client insert/
-- update/delete -- provisioning is done with the service role.
create policy organizations_select on organizations
  for select using (id in (select current_org_ids()));

-- organization_members: a user can see their own membership row(s) only.
create policy organization_members_select on organization_members
  for select using (user_id = auth.uid());

-- customers
create policy customers_select on customers
  for select using (organization_id in (select current_org_ids()));
create policy customers_insert on customers
  for insert with check (organization_id in (select current_org_ids()));
create policy customers_update on customers
  for update using (organization_id in (select current_org_ids()))
  with check (organization_id in (select current_org_ids()));

-- service_schedules
create policy service_schedules_select on service_schedules
  for select using (organization_id in (select current_org_ids()));
create policy service_schedules_insert on service_schedules
  for insert with check (organization_id in (select current_org_ids()));
create policy service_schedules_update on service_schedules
  for update using (organization_id in (select current_org_ids()))
  with check (organization_id in (select current_org_ids()));

-- jobs
create policy jobs_select on jobs
  for select using (organization_id in (select current_org_ids()));
create policy jobs_insert on jobs
  for insert with check (organization_id in (select current_org_ids()));
create policy jobs_update on jobs
  for update using (organization_id in (select current_org_ids()))
  with check (organization_id in (select current_org_ids()));

-- time_entries
create policy time_entries_select on time_entries
  for select using (organization_id in (select current_org_ids()));
create policy time_entries_insert on time_entries
  for insert with check (organization_id in (select current_org_ids()));
create policy time_entries_update on time_entries
  for update using (organization_id in (select current_org_ids()))
  with check (organization_id in (select current_org_ids()));

-- job_change_history: append-only from the app's perspective.
create policy job_change_history_select on job_change_history
  for select using (organization_id in (select current_org_ids()));
create policy job_change_history_insert on job_change_history
  for insert with check (organization_id in (select current_org_ids()));

-- No delete policy exists on any table above, so row deletion is denied by
-- RLS for all client roles; the app only ever soft-deletes (is_active,
-- cancelled status).
