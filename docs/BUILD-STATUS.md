# Build Status

## Deactivate / reactivate cleanup — 2026-09-20

Decision: cancelled visits are never deleted (history, and the cancelled rows
are what stop the generator recreating them). The confusion was display and
next steps, so:

- Schedule calendar hides cancelled visits by default, with a "Show skipped
  and cancelled visits (N)" toggle (`filterCalendarJobs`).
- A visit cancelled by deactivating its customer reads "Customer inactive"
  (not "Skipped") on cards, the calendar modal and customer history
  (`statusLabel`, `CUSTOMER_DEACTIVATED_REASON` must match the SQL string in
  `deactivate_customer`).
- Deactivate confirmation states how many pending visits and schedules it
  affects and that nothing is deleted.
- After reactivating, a notice explains old schedules stay off and offers
  "Start a new schedule", which opens `/schedule?customer=<id>` with the
  customer selected and their last schedule's description, price and
  estimated minutes prefilled.
- Deliberately kept: deactivation also cancels overdue pending visits;
  no "restore old schedule" button (re-enabling after a long gap would make
  the generator create months of overdue jobs).
- Checks run: typecheck, lint, 33 unit tests, production build, and the
  integration suite against the dev project: 17/17 pass (2 new: deactivate
  cancels but never deletes, reactivation restarts nothing and generation
  adds no jobs; deactivation is refused while a job is in progress).
  NOT verified in a browser/phone: the calendar toggle, reactivation notice
  and prefilled schedule form.

## Phase 1 gap fixes — 2026-09-20

Closing the remaining MVP gaps found in the Phase 1 review:

- **Timer corrections** (`supabase/migrations/0003_time_corrections.sql`,
  **must be applied in the Supabase SQL Editor**): `complete_job_corrected`
  (a timer left running is closed at the owner's real duration, never longer
  than actual elapsed time) and `correct_time_entry` (fix a closed entry,
  including on completed jobs). Both require a reason, reject zero/negative
  durations, times in the future and overlap with any other time entry, and
  write the original values to `job_change_history.previous_values`. UI:
  "Forgot to tap Complete? Enter the real time" on a running job and
  "Recorded time wrong? Correct it" on a completed one (`JobActionsPanel`).
- **Schedule change explanation**: Schedule page explains disable-then-create;
  the new-schedule form warns when the selected customer already has an
  active schedule; the Disable confirmation says what it does and doesn't do.
- **Loading / error screens**: `(protected)/loading.tsx`,
  `(protected)/error.tsx`, `not-found.tsx`, `global-error.tsx`.
- **Wording**: the Today summary now says "Completed service value" and
  "scheduled service value" (MVP section 6), not "earned".
- Migration 0003 applied to the dev project by the owner (2026-09-20).
- Checks run: typecheck, lint, 29/29 unit tests, production build, and the
  integration suite against the dev project: **15/15 pass** (11 existing +
  4 new: corrected completion preserves the original reading and is
  idempotent; closed-entry correction keeps originals; overlap, future, zero
  and missing-reason rejected; another organization cannot correct an entry).
  NOT verified: the new screens and forms in a browser or on a phone.

## Today page redesign + service-description chips — 2026-09-20

Owner-approved designs (mocked up as Design artifacts, then built):

- **Service description picker** (`ServiceDescriptionPicker.tsx`, used by
  `ScheduleForm`): tappable task chips build the description sentence, plus
  an optional detail line. Emits a plain `description` form field, so
  `createSchedule` is unchanged.
- **Today page "Mix"** (`(protected)/page.tsx`): dollar summary on top
  (`TodaySummary`: earned / working / moved / to do, with a note naming any
  job stopped and rescheduled today so earned < scheduled is explained), then
  a collapsible Overdue banner, then one hero card (`TodayHeroCard`) for the
  job in progress or next up with big Start / Complete / Stop and Reschedule
  buttons (`JobActionsPanel variant="hero"`), then a "Then" list (tap a row
  to expand its full actions) and a collapsed "Finished today" list so
  completion notes stay viewable.
- "Moved" dollars come from `job_change_history` (move rows with
  `previous_date` = today, made today in the business timezone, for jobs no
  longer on today's date). Pure math is in `lib/domain/todaySummary.ts`
  with unit tests.
- Checks run: typecheck, lint, `npm test` (29/29), production build — all
  pass. NOT run: a browser walkthrough of the new Today page (no browser
  tool here); owner should check it on the phone after Vercel redeploys.

## Job card polish for phones — 2026-09-20

- Shared `JobCard`, `JobActionsPanel`, hero card, and calendar modal restyled:
  name left / price right in the rounded system face (`font-display` =
  `ui-rounded`), sentence-case status chip (`StatusChip`, "rescheduled" now
  reads "Moved"), full-width 48-56px primary button, three-up secondary
  action row, 44px+ tap targets, 16px labelled form fields, visible keyboard
  focus, reduced-motion respected. Removed all-caps labels and the numbered
  circles on the "Coming up" list (order there is not a route).
- Checks run: typecheck, lint, 29/29 tests, production build, and confirmed
  `.font-display` is emitted in the built CSS. NOT run: visual check in a
  browser or on a phone (none available here); owner should review on the
  phone after the Vercel redeploy.

## Live verification (Prompt 5, partial) — completed 2026-09-19

The DEVELOPMENT Supabase project is now fully provisioned: both migrations
applied, owner auth user created, one `organizations` row + one
`organization_members` row linking them (confirmed via direct query — an
earlier duplicate run of `provision_owner.sql` created a second org/
membership row, found and cleaned up before it could cause confusion).

- **`npm run test:integration`: pass, 11/11**, run for real against the
  live dev project. Covers signed-out + cross-organization denial
  (reads and writes, including via RPC), job-generation dedup under
  sequential and concurrent calls, moved/skipped occurrence identity
  surviving regeneration, two-tab timer concurrency (exactly one of two
  concurrent `start_job` calls succeeds), and idempotent `complete_job`.
- Two test-isolation bugs were found and fixed in
  `src/test/database.integration.test.ts` itself (not app bugs): the
  cross-org RPC test needed its setup to actually generate a job row
  first, and the timer describe block needed its first test to close out
  the timer it started so the next test in the same org didn't inherit an
  already-active timer. Both fixed; full suite now green.
- Dev server (`npm run dev`) confirmed running and reachable at
  localhost:3000.
- Manual owner walkthrough (Prompt 5's browser checklist): not yet
  confirmed done — in progress with the owner directly in the browser,
  since no browser tool is available in this environment.

## First development pass (Prompt 4) — completed 2026-09-16

### What's done
Full V1 application code, per docs/TECHNICAL-PLAN.md:
- **Schema & access** (`supabase/migrations/0001_init.sql`): all seven
  tables, enums, indexes, the unique `(schedule_id, original_service_date)`
  constraint, the partial unique index enforcing one active timer per
  organization, consistency triggers, and RLS policies on every table
  (membership derived from `auth.uid()`, never a client-supplied
  `organization_id`).
- **Business logic** (`supabase/migrations/0002_functions.sql`): job
  generation (rolling 8-week window, cursor-based catch-up, month-end
  clamp-and-return), `start_job`/`complete_job`/`complete_job_manual`
  (idempotent), `move_job`/`stop_and_reschedule` (with `DATE_CONFLICT`
  handling), `skip_job`, `deactivate_customer`/`reactivate_customer`. All
  `SECURITY INVOKER` so RLS applies inside them exactly as it would for a
  direct query.
- **App** (Next.js App Router, `src/app`): `/login`, Today (`/`),
  `/customers` (list/search/add/edit/history/deactivate-reactivate),
  `/schedule` (create schedules, disable schedules, upcoming + overdue
  list). `src/app/proxy.ts` refreshes the Supabase session cookie; the
  `(protected)` route group's layout does the actual auth-gate redirect,
  per current Next.js 16 guidance to keep the proxy thin and put auth
  decisions in layouts/route handlers instead.
- **Timer UI**: `ElapsedTimer` re-derives elapsed time from the persisted
  `started_at` on every render (see `src/components/ElapsedTimer.tsx`);
  `JobCard` wires Start/Complete/Move/Skip/Stop-and-Reschedule to the RPCs
  and surfaces `ACTIVE_TIMER_EXISTS`/`DATE_CONFLICT` as UI states rather
  than raw errors.
- **Tests**:
  - `src/lib/domain/recurrence.test.ts`, `money.test.ts` — 15 unit tests for
    recurrence/month-end/timezone math and price parsing. **Actually run,
    all passing** (`npm test`).
  - `src/test/database.integration.test.ts` — RLS (signed-out + cross-org
    denial), generation dedup under sequential/concurrent calls, moved/
    skipped occurrence identity, two-tab timer concurrency, idempotent
    completion. **Written but NOT run** — see blocker below.
- `supabase/provision_owner.sql` — template for the one-time owner/org
  insert, to run after creating the auth user by hand.

### Checks run and results
- `npm run typecheck` (tsc --noEmit): **pass**.
- `npm run lint` (eslint): **pass**.
- `npm run build` (next build, production): **pass** — all routes compiled;
  `/`, `/customers`, `/customers/[id]`, `/customers/new`, `/schedule` are
  dynamic (expected, they read the session); `/login` is static.
- `npm test` (vitest, pure logic, no credentials needed): **pass, 15/15**.
- `npm run test:integration`: **now run and passing, 11/11** — see "Live
  verification" section above (this was NOT run at the time this section
  was originally written; updated 2026-09-19).
- Manual browser walkthrough (owner login → add customer → create
  schedule → start/complete/reschedule/skip a job → dashboard/history):
  in progress with the owner in the browser — see "Live verification"
  section above. Not yet confirmed complete.

### Notable build-time fixes (worth knowing about)
- `typescript@7.0.2` (current "latest" at build time) resolved Supabase's
  generic `Database` typing to `never` throughout the app when the table
  Row/Insert/Update types were declared with `interface`; declaring them as
  `type` aliases instead fixed it. Downgraded to `typescript@6.0.3` (last
  pre-rewrite stable line) for safety, and the same `interface`→`type` fix
  applies regardless — see `src/lib/supabase/types.ts`.
- `eslint@10` broke `eslint-config-next`'s bundled parser at lint time
  (`scopeManager.addGlobals is not a function` — an internal API mismatch,
  not a config problem). Pinned `eslint@9.39.5`, the newest line
  `eslint-config-next@16.3.5` actually supports.
- Next.js 16 renamed `middleware.ts` to `proxy.ts` (now living inside
  `app/`) and narrowed its intended use to routing only; auth redirects now
  belong in layouts/route handlers. The app follows this: `src/app/proxy.ts`
  only refreshes the session cookie, and `(protected)/layout.tsx` does the
  actual redirect-if-signed-out check.

### Known V1 simplification (see docs/TECHNICAL-PLAN.md for the full note)
"Completed service value for jobs completed today" uses each job's
`scheduled_date`, not `completed_at`'s calendar date. Matches the normal
same-day workflow; a job completed well after its scheduled date is an
unhandled edge case for this one dashboard figure.

### Outstanding blocker
Resolved 2026-09-19 — see "Live verification" section at the top. The dev
Supabase project is provisioned and the integration suite passes against
it. What remains is the manual browser walkthrough (Prompt 5's checklist)
with the owner, since this environment has no browser tool.

### Manual steps completed
1. ✅ DEVELOPMENT Supabase project created, `.env.local` filled in.
2. ✅ `supabase/migrations/0001_init.sql` and `0002_functions.sql` applied.
3. ✅ Owner auth user created (Authentication → Users → Add user, with
   Auto Confirm enabled to skip the email-link flow entirely).
4. ✅ `supabase/provision_owner.sql` run — one `organizations` row, one
   `organization_members` row (a duplicate from an accidental double-run
   was found and cleaned up).
5. In progress: manual owner walkthrough in the browser at localhost:3000
   (dev server running).

## Environment setup (Prompt 2) — completed 2026-09-16
- Git repository initialized locally (`main` branch, no commits yet — nothing
  has been committed; review `git status` before the first commit).
- `.gitignore` added: excludes `node_modules/`, `.next/`, all `.env*` files,
  Supabase local temp dirs, build output, and OS/editor cruft.
- Node.js: none was installed. Installed `nvm` via Homebrew (added init
  lines to `~/.zshrc`), then installed Node.js **v24.21.0** (current Active
  LTS) via `nvm install 24` and set as the default nvm alias. `npm` v11.19.0
  came bundled with it.
- `.nvmrc` added (pins `24`) so future shells/CI/Vercel resolve the same
  Node major version automatically via `nvm use`.
- Package manager: **npm** (ships with Node, matches Vercel's default,
  no extra install needed).
- Business timezone: **America/Chicago**.
- Business currency: **USD** (prices stored as integer cents, per MVP.md).
- Supabase: no project created yet — this requires the owner to sign in via
  browser. See "Manual steps you still need to do" below.

### Environment variable names (values are NOT recorded anywhere in this repo)
Create a file named `.env.local` in the project root once the Next.js app is
scaffolded (it's already covered by `.gitignore`, so it will never be
committed). It must contain exactly these three keys:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
  safe to expose to the browser (Row Level Security still gates every
  query) and follow Next.js's `NEXT_PUBLIC_` convention for client-readable
  env vars.
- `SUPABASE_SECRET_KEY` (replaces the legacy `service_role` key; Supabase is
  deprecating `anon`/`service_role` naming during 2026) bypasses Row Level
  Security and must stay server-only — never prefix it with `NEXT_PUBLIC_`,
  never log it, never commit it.
- All three values come from the Supabase dashboard: **Settings → API Keys**
  on the DEVELOPMENT project, once it exists.

### Manual steps you still need to do (cannot be done from here)
1. Go to https://supabase.com/dashboard, sign in (or create a free account).
2. Click **New Project**. Name it something like `lawn-service-dev`, choose
   a strong database password (store it in a password manager, not in this
   repo or chat), pick a region close to you, and use the **Free** tier —
   do not select a paid plan.
3. Wait for provisioning (~1-2 minutes).
4. Open **Settings → API Keys** and copy the Project URL, the publishable
   key, and the secret key into your local `.env.local` using the exact
   variable names above. Do not paste these into chat, docs, or commit them.
5. Owner login and organization are provisioned manually (no public
   signup), planned as follows — actual creation happens once the schema
   migration exists (next build phase):
   - Create the owner's auth user via **Authentication → Users → Add
     user** in the Supabase dashboard (email + password), or via the
     Supabase CLI/SQL once available.
   - Insert one row in `organizations` and one membership row linking that
     user to it, via the SQL editor, after migrations create those tables.
   - No signup UI will exist in the app; this manual provisioning is the
     only way an owner account is created in V1.
6. Confirm back here once the dev project exists and `.env.local` is filled
   in, so live database work (schema, RLS tests) can be verified against a
   real project.

## Existing work found
- Project folder created with `lawn-service-build-playbook.md` (the source
  playbook this project follows) and empty placeholder files: `CLAUDE.md`,
  `README.md`, `docs/MVP.md`, `docs/ROADMAP.md`, `docs/BUILD-STATUS.md`,
  `docs/TECHNICAL-PLAN.md`.
- No git repository yet (`git` not initialized in this folder).
- No `package.json`, no application code, no `node_modules` — nothing has
  been scaffolded.
- This session (Prompt 1) filled in `CLAUDE.md`, `docs/MVP.md`, and
  `docs/ROADMAP.md` from the playbook. `docs/TECHNICAL-PLAN.md` is
  intentionally left empty — it's produced during planning (Prompt 3),
  before coding.

## Decisions / assumptions on record
- Stack: Next.js App Router, TypeScript, Tailwind CSS, Supabase Postgres +
  Auth with RLS, Supabase accessed directly (no Prisma), Vercel-compatible
  hosting. Agreed per the playbook; not yet re-confirmed against current
  official docs/versions.
- One business, one owner login, one service property per customer, owner
  operates the timer in V1.
- **Business timezone: America/Chicago. Currency: USD (cents).** Recorded
  2026-09-16.
- No Supabase project (dev or otherwise) has been created or selected yet —
  this is the one remaining blocker (see below).

## Outstanding setup needs (blockers before coding)
- [x] Initialize git in this folder and add an appropriate `.gitignore`.
- [x] Confirm/install a supported Node.js version and choose one package
      manager.
- [x] Plan a manually provisioned owner login + organization (no public
      signup) — see "Manual steps you still need to do" above; actual
      creation happens after the schema migration exists.
- [x] Collect and record business timezone and currency.
- [ ] **Blocker:** create the DEVELOPMENT Supabase project and populate
      `.env.local` (manual, browser-based — see steps above). Nothing that
      touches a live database can be verified until this is done.

## Next step
1. Try the new time-correction forms, the schedule guidance and the error
   screens on the phone.
2. Decide dev vs. a separate production Supabase project before real
   customer data goes in, then run a real workday (the Phase 1 exit gate in
   docs/ROADMAP.md).
