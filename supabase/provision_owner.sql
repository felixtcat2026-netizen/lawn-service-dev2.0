-- Run this ONCE in the Supabase Dashboard SQL Editor, AFTER:
--   1. Applying 0001_init.sql and 0002_functions.sql, and
--   2. Creating the owner's auth user via
--      Authentication -> Users -> Add user (email + password).
--
-- Replace the two placeholder values below before running. Find the
-- owner's user id on the Authentication -> Users page (click the user; the
-- UUID is shown at the top). Do not commit real values here -- this file
-- stays a template.

with new_org as (
  insert into organizations (name, timezone, currency)
  values ('Replace With Business Name', 'America/Chicago', 'USD')
  returning id
)
insert into organization_members (organization_id, user_id, role)
select id, 'REPLACE-WITH-OWNER-AUTH-USER-UUID'::uuid, 'owner'
from new_org;
