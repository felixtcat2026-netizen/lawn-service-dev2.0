# Lawn Service App

A mobile-first daily job tracker for a one-person lawn service business:
customer -> recurring schedule -> generated job -> Start Job -> Complete
Job or stop and reschedule unfinished work.

See [CLAUDE.md](CLAUDE.md) for project scope and [docs/MVP.md](docs/MVP.md)
for full V1 requirements. [docs/BUILD-STATUS.md](docs/BUILD-STATUS.md) has
the current build status, decisions, and outstanding issues.

## Stack
Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres, Auth,
Row Level Security). Supabase is used directly -- no ORM.

## Prerequisites
- Node.js 24 (see `.nvmrc`; run `nvm use` if you use nvm)
- npm (bundled with Node)
- A Supabase project (development and, later, production)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create `.env.local` in the project root (copy `.env.local.example`) and
   fill in your Supabase project's values from **Settings -> API Keys** in
   the dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_SECRET_KEY=
   ```
   `SUPABASE_SECRET_KEY` bypasses Row Level Security -- keep it server-side
   only, never commit it, never prefix it with `NEXT_PUBLIC_`.

3. Apply the database schema. There is no local Postgres/Docker in this
   environment, so migrations are applied directly to your Supabase
   project via the dashboard's SQL Editor, in order:
   - `supabase/migrations/0001_init.sql` (tables, indexes, RLS policies)
   - `supabase/migrations/0002_functions.sql` (business-logic functions:
     job generation, timer start/complete, move/skip, deactivate/reactivate)

   Open the project's SQL Editor, paste each file's contents, and run it,
   in that order.

4. Create the owner's login (no public signup exists in this app):
   - Supabase Dashboard -> Authentication -> Users -> **Add user** (email +
     password).
   - Copy `supabase/provision_owner.sql`, replace the business name and the
     new user's UUID (shown on their Authentication -> Users detail page),
     and run it in the SQL Editor. This creates the one `organizations` row
     and links the owner to it.

5. Run the app:
   ```
   npm run dev
   ```
   Open http://localhost:3000 and sign in with the owner email/password
   from step 4.

## Checks

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build        # production build
npm test             # unit tests (pure date/money logic, no credentials needed)
npm run test:integration  # RLS, generation, and timer concurrency against
                           # your real dev Supabase project -- requires
                           # .env.local AND that migrations have been
                           # applied (step 3 above)
```

`test:integration` provisions and tears down its own throwaway
organizations/users for each test run -- it does not touch real customer
data, but it does require your dev project's schema to already exist.

## Notes on the timer
The active-job timer is enforced by the database, not just the UI: only
one open time entry is allowed per organization at a time (a partial
unique index), and completion is idempotent. Elapsed time is always
recomputed from the persisted `started_at` timestamp, so it survives
refresh, navigation, phone lock, and browser close.

## Deployment
Not yet deployed. Vercel deployment is a later step (see the build
playbook, Prompt 6) once the local walkthrough passes.
