# Lawn Service App Build Playbook

Your first goal is to replace your brother’s iPhone Notes with a useful daily tool. **Create a few short project documents first, review the plan, then build Version 1.** You do not need a large documentation library before you begin.

Work through this file in order. Paste one prompt at a time into Claude Code and wait for that step to finish. The large prompt in Step 4 is the complete first-development-pass specification; the earlier prompts prepare Claude to implement it reliably.

**Version 1 workflow:** Customer → recurring schedule → generated job → start timer → complete or reschedule.

## 1 Start here

1. Create a folder called `lawn-service-app` and open it in VS Code with **File → Open Folder**. If you already have app code, open that project instead; do not create a competing app.
2. Copy this file into the project root as `lawn-service-build-playbook.md`.
3. Open the official Claude Code extension in VS Code and sign in. You can also run the Claude Code CLI in VS Code’s integrated terminal. These are two interfaces to Claude Code; use one conversation at a time.
4. In Claude’s input, type `/` to see available commands. In the CLI, run `/help`. The extension supports a subset of CLI commands; if a command below is missing, use the indicated UI option or plain-language prompt. Do not paste slash commands into a normal shell prompt.
5. Paste Prompt 1 below. You do not need to create the other documents yourself.

The [official VS Code guide](https://code.claude.com/docs/en/vs-code) covers installation and the extension’s differences from the CLI.

### Documents to create first

| File | Purpose | When |
| --- | --- | --- |
| `CLAUDE.md` | Short project instructions and links Claude can reload | Prompt 1 |
| `docs/MVP.md` | Goal, included features, exclusions, acceptance checklist | Prompt 1 |
| `docs/ROADMAP.md` | Future phases and parked ideas | Prompt 1 |
| `docs/BUILD-STATUS.md` | Completed work, decisions, blockers, next step | Prompt 1; update each session |
| `docs/TECHNICAL-PLAN.md` | Tables, scheduling rules, timer rules, build order | Prompt 3, before coding |
| `README.md` | Exact setup, environment, run and test instructions | During implementation |

**These can wait:** separate vision and PRD files, elaborate architecture diagrams, an API integration catalog, a mockup collection, a business plan, a prompt library, and detailed crew or SaaS designs. The files above cover the immediate need. Add `AGENTS.md` later if you bring in other coding agents; keep shared instructions consistent with `CLAUDE.md`.

### Prompt 1 Create the starting documents

**Before this prompt:** use `/help` if available. Do not use `/clear` in a fresh conversation. Use the normal mode that permits file edits, not Plan mode.

```text
Read lawn-service-build-playbook.md and inspect this folder before changing it.
We are preparing a lawn-service MVP for one owner to replace iPhone Notes.
Do not write application code yet. Preserve any existing work.

Create or update only these short documents:
1. CLAUDE.md: project goal, agreed stack, document links, MVP boundaries,
   test expectations, and the rule to update BUILD-STATUS after each milestone.
2. docs/MVP.md: extract the complete Version 1 requirements and acceptance
   criteria from Step 4 of this playbook. Keep every important behavior.
3. docs/ROADMAP.md: copy the future phases from this playbook.
4. docs/BUILD-STATUS.md: record existing work, assumptions, outstanding
   setup needs, and the next step, which is environment preparation.

Use Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL and
Auth with RLS, and Vercel hosting. Use Supabase directly, without Prisma.
Do not introduce advanced services from later phases.
Explain what you found and what I should read first. Stop after the docs.
```

**Done when:** the four files exist, the MVP includes a durable timer, and future features are clearly deferred. Skim them; fix any misunderstanding before moving on.

## 2 Prepare the development environment

You need a development Supabase project before testing real login and saved data. Vercel deployment can wait until the app works locally. Use fictional customers during development.

### Prompt 2 Check setup and guide me through missing pieces

**Before this prompt:** no command needed. Stay in the same conversation.

```text
Read CLAUDE.md, docs/MVP.md, and docs/BUILD-STATUS.md.
Inspect the existing project and local development tools. Do not scaffold
application code yet. Tell me what is installed and what is missing.

Help me prepare Git, a supported Node.js version, and one package manager.
If this is not already a Git repository, initialize it and add an appropriate
.gitignore. Preserve existing files. Do not commit secrets.

Guide me through creating or selecting a DEVELOPMENT Supabase project.
Give me the exact environment variable names and explain where I enter
their values locally. Do not ask me to paste passwords or secret keys into
chat. Keep real values out of documentation, logs, and Git.
Plan a manually provisioned owner login and organization; no public signup.
Ask me for the business timezone and currency, and record the answers.

Use current official setup documentation. Give me only the manual steps
that you cannot perform. Do not create paid resources or deploy yet.
Update BUILD-STATUS with the setup outcome and remaining blockers.
```

**Done when:** Claude has checked the tools, identified the development database, documented environment setup, and recorded timezone and currency. Finish any necessary sign-in or account steps it gives you before requesting live database tests.

## 3 Review a short technical plan

### Prompt 3 Plan the first pass

**Before this prompt:** optionally use `/plan` in the CLI or choose **Plan** in the extension’s mode selector. Planning can stay read-only.

```text
Read CLAUDE.md, docs/MVP.md, docs/BUILD-STATUS.md, and Step 4 of the playbook.
Propose the smallest complete implementation of Version 1. Do not code yet.

Explain in plain language:
- The pages and the owner’s daily workflow.
- The tables, relationships, organization access rules, and safe owner setup.
- How recurring jobs are generated without duplicates.
- How a rescheduled or skipped visit avoids being generated again.
- How timestamps preserve timers after refresh, phone lock, or browser close.
- How two tabs or repeated taps cannot start or complete a job twice.
- The implementation milestones and the tests for each.

Use the explicit defaults in Step 4. Ask only about decisions that block
implementation. Present the proposed docs/TECHNICAL-PLAN.md contents for
review. Keep future phases out of the implementation plan.
```

**Done when:** the plan covers customers, scheduling, generated jobs, timer, completion/rescheduling, dashboard, history, and database access tests. It should describe the actual working app, not just attractive screens.

Read it once. If something is wrong, tell Claude what to change. When it matches the playbook, return to normal editing mode and paste Prompt 4. There is no need to `/clear` between planning and building.

## 4 Build Version 1

### Prompt 4 Full first development pass

**Before this prompt:** leave Plan mode and use the normal mode that permits edits. No slash command is otherwise needed. Paste the entire block.

```text
Implement the first working version of our lawn-service app. The goal is
to replace one owner’s iPhone Notes with a reliable, mobile-first daily tool.

Read CLAUDE.md and the project docs first. Inspect existing code and preserve
useful work. Save the agreed plan to docs/TECHNICAL-PLAN.md. If the planning
session is unavailable, reconstruct the plan from these requirements.

STACK AND SCOPE
Use Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL,
Supabase Auth, Row Level Security, and Vercel-compatible hosting.
Use Supabase directly; no Prisma. Check current official documentation
for installed versions. Commit a lockfile and keep the setup reproducible.
One business, one owner login, one service property per customer for now.
Keep organization_id throughout business data for future expansion.
The owner operates the timer in V1; separate crew accounts come later.

Do not build weather, SMS, email automation, routing, payments, invoices,
crew management, advanced analytics, AI, customer portal, public signup,
photos, realtime subscriptions, or offline synchronization in this pass.

CORE WORKFLOW
Customer -> recurring schedule -> generated job -> Start Job ->
Complete Job OR stop and reschedule unfinished work.

1 AUTHENTICATION AND DATA ACCESS
Implement owner login/logout and protected pages and server operations.
Document how to provision the owner and their organization safely.
Use organizations, organization membership, customers, service schedules,
jobs, time entries, and a small job-change history, or equivalent tables.
Use migrations, foreign keys, useful indexes, and organization-consistent
relationships. Do not trust organization_id supplied by the browser.
Enable RLS on exposed tables and restrict reads/writes by membership.
Test signed-out access and another organization’s access, including writes.
Keep secret/service-role keys server-only; never in NEXT_PUBLIC variables.

2 CUSTOMERS
List, search, add, edit, view, and deactivate customers.
Fields: first and last name, phone, optional email, service address,
city/state/postal code, default visit price, general notes, property notes,
gate code, and pet/access notes. Validate required fields and prices.
Keep historical jobs when a customer is deactivated. Deactivation disables
their schedules and cancels future unstarted jobs after a clear confirmation.
Require any active job to be resolved first. Reactivation must not silently
restart old schedules. Keep price values in integer minor currency units.

3 SERVICE SCHEDULES AND AUTOMATIC JOB GENERATION
Each schedule belongs to a customer and contains a service description,
price, optional estimated minutes, start date, recurrence, and active flag.
Support one-time, weekly, every two weeks, and monthly.
Weekly/biweekly use the start date as the weekday anchor.
Monthly uses the same day of month, clamped to the last day in short months,
then returns to the original day in later months. Monthly is not every 4 weeks.
Use the business timezone for service dates and dashboard date boundaries;
store event timestamps in UTC. Confirm timezone/currency if not documented.

Automatically generate a rolling 8-week window when a schedule is saved
and when the authenticated owner opens the dashboard. Provide a safe retry.
This V1 mechanism runs on use, not as an unattended background scheduler.
After a long absence, catch up missed occurrences since the last generation
cursor and show past pending work as overdue. Never silently mark it done.
Make generation transactional and safe under retries/concurrent requests.
Uniquely identify an occurrence by schedule_id and its ORIGINAL service date.
Store that date separately from its current scheduled date. Database uniqueness
must prevent duplicate occurrences even after a move, skip, or cancellation.
Snapshot service description and price on each job so history stays stable.
In V1, allow disabling schedules; do not add complex series editing. To change
cadence, disable the old schedule, resolve its future pending visits, and create
a new schedule. Explain this in the UI so visits are not accidentally duplicated.

4 JOBS AND RESCHEDULING
Provide Today and an upcoming date-based job list with an overdue section.
Statuses: scheduled, in_progress, completed, rescheduled, cancelled.
Rescheduled means pending work on a changed date, so it remains startable.
Allow Tomorrow, Custom Date, and Skip This Visit. Use the label Skip This Visit
for all cadences; for weekly work it has the effect of skipping that week.
Move the same job, retaining its original occurrence identity and move history.
A move must not shift the recurring schedule or duplicate the visit.
Skip marks that occurrence cancelled with a skip reason; preserve it so the
generator cannot recreate it. The next regular occurrence is unchanged.
Do not silently merge visits if a moved job lands on another scheduled visit.
Show a conflict message and let the owner choose another date or explicitly
keep both. Record original/new dates, reason, and change timestamp.
Completed jobs are not startable or reschedulable.

5 DURABLE JOB TIMER AND COMPLETION
Large Start Job and Complete Job controls must be usable on an iPhone.
Starting creates a persisted time entry with an authoritative server/database
started_at timestamp and sets the job in_progress in one atomic operation.
Display elapsed time from persisted timestamps, not a browser counter alone.
After refresh, navigation, phone lock, browser closure, or sign-in again,
reconstruct the timer from saved data. Use server time to limit clock drift.
Allow only one running job for this owner at a time, enforced in the database.
Repeated taps, retries, and two tabs must not create duplicate active entries.

Complete Job closes the active entry using a server/database ended_at,
calculates nonnegative duration seconds, stores completed_at and optional
completion notes, and marks the job completed atomically. Completion is
idempotent: repeated requests must not add time or duplicate history.

If unfinished work must move, offer Stop and Reschedule. Close the current
entry, retain its duration, and move the same job. A later Start Job opens a
new entry; total service time is the sum of closed entries plus any live entry.
Never leave a timer running on a rescheduled or cancelled job. General
pause/resume controls are out of scope for V1.
Permit owner corrections for forgotten timers with a required reason and
preserved original values. Reject negative or overlapping time intervals.
Completion requires a started timer or an explicit reasoned manual duration;
do not invent a zero duration when time was never recorded.

V1 requires internet for saving actions. Clearly report failed saves, keep
the entered information available to retry, and never show a successful
start/complete until the database confirms it. A previously saved timer
continues measuring elapsed time while the phone is disconnected; this
does not mean the app supports offline job updates.

6 DASHBOARD AND CUSTOMER HISTORY
Show today’s jobs, completed count, remaining count, and a visible active job.
Keep overdue pending jobs visible separately. Exclude cancelled visits.
Show scheduled service value for today’s noncancelled visits and completed
service value for jobs completed today. Label both as service value, not
payments collected; payment tracking is a later phase.
Customer history shows dates, statuses, job notes, prices, actual durations,
and average duration for completed jobs with valid recorded time. Show the
sample count and an empty state when there is no valid timing history.
Service duration excludes travel and is elapsed work time, not crew labor-hours.

7 MOBILE EXPERIENCE
Use simple navigation: Today, Customers, Schedule. Large labeled buttons,
readable text, accessible forms, clear loading/error/empty states, and no
horizontal scrolling. Keep the daily workflow to very few taps. Start with
lists; a complex calendar or drag-and-drop interface is unnecessary.

BUILD ORDER AND VERIFICATION
Work in milestones: foundation/auth/schema -> customers -> schedules/jobs
-> timer/complete/reschedule -> dashboard/history -> verification.
Continue through all milestones when possible. Give a short progress update
at each; stop only for a real blocker or a decision you cannot safely infer.
Do not stop after producing scaffolding, a mockup, or a plan.

Include fictional seed data, environment examples with placeholders, and
README instructions for setup, migrations, owner provisioning, running,
testing, and later Vercel deployment. Do not deploy in this step.
Run type checking, lint if configured, a production build, and meaningful tests
for recurrence/month-end/timezone behavior, duplicate generation, moved/skipped
occurrences, timer persistence/concurrency, completion, and organization access.
Check the real customer-to-completion flow at mobile width. Distinguish checks
actually run from checks blocked by credentials or unavailable browser tools.
Update BUILD-STATUS with results, limitations, and the next exact action.
Finish by telling me how to open the app and perform the owner walkthrough.
```

**Done when:** the complete workflow uses saved database records, tests have results, and you can open the running app. If credentials block testing, the milestone is still incomplete; resolve the blocker before calling V1 ready.

## 5 Verify it yourself and fix failures

### Prompt 5 Run the acceptance pass

**Before this prompt:** stay in the conversation. If it is long, first use `/compact` with the focus example in Section 7. Do not clear unresolved debugging context.

```text
Verify Version 1 against docs/MVP.md and the checklist in this playbook.
Run available automated checks, then exercise the real app with fictional data.
Check mobile layout, database persistence, timer recovery, recurrence,
reschedule/skip behavior, and denied access by another organization.
Fix defects within MVP scope and rerun the affected checks.
Report pass/fail/not run with evidence. Do not describe unrun checks as passed.
Update BUILD-STATUS, and give me a short walkthrough I can repeat on my phone.
```

Use this manual test in order:

- [ ] Log in and add a fictional customer named Test Lawn at a fictional address.
- [ ] Create a weekly service priced at 50 currency units, starting today.
- [ ] Confirm today’s job and future weekly jobs appear. Refresh twice: no duplicates.
- [ ] Start today’s job. Refresh and reopen the browser: elapsed time continues.
- [ ] Try to start a second job: the app directs you to the existing active job.
- [ ] Complete the job with a note. Confirm saved duration and customer history.
- [ ] Move the next visit to tomorrow. Confirm it appears once and the series keeps its original cadence.
- [ ] Start that visit, then Stop and Reschedule. Restart later and complete; both time segments count.
- [ ] Skip another visit. Refresh: it stays skipped and the following visit remains.
- [ ] Confirm dashboard counts and service values match these records.
- [ ] Log out: customer information and gate codes must no longer be accessible.
- [ ] Have Claude demonstrate the automated month-end, two-tab, and cross-organization tests.

For a failure, paste:

```text
Fix this MVP bug before adding anything else.
Steps I took: [describe]
Expected result: [describe]
Actual result or exact error: [paste, removing secrets]
Find the cause, make the smallest appropriate fix, verify it, and update
BUILD-STATUS. Preserve existing customer, schedule, job, and timing data.
```

## 6 Deploy only after the walkthrough passes

### Prompt 6 Prepare the owner pilot

**Before this prompt:** no command required. Use a fresh session only if the previous work has been recorded in the documents.

```text
Read CLAUDE.md and the project docs. Prepare a Vercel pilot deployment of
the verified MVP. Check the production build and list unresolved blockers.
Give me the exact environment settings, Supabase authentication URL settings,
migration steps, and owner provisioning steps for the selected environment.
Explain how test data stays separate from real customer data, how to back up
the database, and how to recover if deployment or a migration fails.
Do not assume reverting app code reverses a database migration.
Show the concrete deployment plan and any costs before publishing.
After I authorize deployment, deploy if your tools allow it or guide me through
the exact manual steps. Then verify login and the full workflow at the live URL.
Update README and BUILD-STATUS with the outcome and anything not yet verified.
```

**V1 is ready for the pilot when:** your brother can use the deployed app on his phone for the entire workflow. Start with a few customers for a workday, keep his Notes available during the trial, and fix practical friction before adding Phase 2.

## 7 Claude Code command guide

Commands are tools to use when needed, not a ritual before every prompt. Availability differs by version and interface; check `/help` in the CLI or the extension’s `/` menu.

| Command | When to use it |
| --- | --- |
| `/help` | First session or when unsure what your installation supports. |
| `/plan` | Before Step 3 or another substantial change. In the extension, select Plan mode. Return to editing mode to build. |
| `/compact` | When context grows long and you are continuing the same task. No fixed 20–30-minute schedule is necessary. |
| `/clear` | Starting a different task after saving a handoff. Clears conversation context; it does not undo files. |
| `/context` | Inspect context usage before deciding to compact. |
| `/usage` | Inspect usage; current docs list `/cost` as an alias. Older versions may behave differently. |
| `/resume` | Return to an earlier conversation when available. |
| `/init` | Optional starter `CLAUDE.md` generation. Skip here because Prompt 1 creates it intentionally. |

Reference: [official Claude Code commands](https://code.claude.com/docs/en/commands). Command details checked September 15, 2026; your installed menu takes precedence.

Example for a long build session:

```text
/compact Preserve the MVP scope, database and timer decisions, modified files, test results, current blocker, and exact next step.
```

Before ending a session or running `/clear`, paste:

```text
Update docs/BUILD-STATUS.md with completed work, decisions, changed files,
checks run and results, outstanding bugs, and the exact next step.
Keep README setup instructions current. Summarize the changes for a Git
checkpoint, checking that secrets and real customer data are excluded.
```

After `/clear` or in a new conversation, paste:

```text
Read CLAUDE.md, docs/MVP.md, docs/TECHNICAL-PLAN.md if present, and
docs/BUILD-STATUS.md. Inspect the actual code and Git status. Tell me the next
unfinished MVP step, then continue it. Do not rebuild completed features
or add roadmap features.
```

Save working milestones in Git. Chat history and compaction are not source-code backups.

## 8 Future phases to keep

This is a suggested order, not a commitment to build everything. Choose the next phase from actual pilot feedback.

| Phase | Add after the core workflow works | Ready to move on when |
| --- | --- | --- |
| 1 Daily operations | Customers, recurrence, jobs, durable timer, rescheduling, dashboard, history | Owner can run a real workday on a phone |
| 2 Weather and notifications | Weather forecasts, rain alerts, bulk moves, owner-reviewed suggestions, SMS/email with consent and delivery tracking | Moves are reliable and notifications are not duplicated |
| 3 Routing | Daily map, drive time, mileage, estimated finish time, then route optimization | Estimates combine service history with travel time |
| 4 Payments | Invoices, payment links, payment status, receipts, webhook reconciliation | Paid/unpaid records reconcile correctly |
| 5 Crews | Individual accounts, roles, job assignments, crew timers, workload | Crews see only permitted work; elapsed time and labor-hours are distinct |
| 6 Analytics | Estimated versus actual time, service value per hour, costs, profitability and capacity | Enough clean timing and cost data exists to make comparisons useful |
| 7 AI assistance | Duration estimates, scheduling suggestions, anomaly flags and draft messages | Suggestions can be reviewed and measured against a simple baseline |
| 8 Customer portal | Secure customer access, upcoming service, requests, invoices and payments | Customers can see only their own records |

Keep additional ideas in `docs/ROADMAP.md`. Multi-business self-service signup, subscription billing for the SaaS itself, offline synchronization, photos, and complex service catalogs also belong there until demand justifies them.

## 9 Your line by line checklist

- [ ] Open the correct app folder in VS Code.
- [ ] Save this playbook in the project root.
- [ ] Open Claude Code and check the command menu.
- [ ] Paste Prompt 1 and review the four starting documents.
- [ ] Paste Prompt 2 and finish the tool/account setup it identifies.
- [ ] Confirm development Supabase, owner setup approach, timezone, and currency.
- [ ] Paste Prompt 3 and review the proposed technical plan.
- [ ] Return to editing mode and paste all of Prompt 4.
- [ ] Resolve any genuine setup blocker; let Claude finish all build milestones.
- [ ] Paste Prompt 5; check the reported test results.
- [ ] Complete the manual walkthrough in Section 5.
- [ ] Fix failures before requesting new features.
- [ ] Save a verified Git checkpoint without secrets.
- [ ] Paste Prompt 6 and review the deployment details.
- [ ] Authorize and complete deployment; verify the live phone workflow.
- [ ] Pilot with your brother for one workday and record feedback.
- [ ] Update BUILD-STATUS and choose the next improvement from evidence.

**Your next action right now:** open the project folder, save this file there, and paste Prompt 1.

## Technical references

The workflow and recurrence rules above are proposed product defaults for this app. The earlier conversation established the stack and MVP direction. Claude should check current implementation APIs when building.

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) explains database policies and access tests.
- [Supabase Next.js authentication setup](https://supabase.com/docs/guides/auth/server-side/nextjs) provides the current server-side integration guide.
- [Claude Code in VS Code](https://code.claude.com/docs/en/vs-code) covers the extension and CLI differences.
- [Claude Code commands](https://code.claude.com/docs/en/commands) is the reference for available built-in commands.
