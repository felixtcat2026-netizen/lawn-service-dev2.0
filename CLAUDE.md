# Lawn Service App

## Goal
Replace one owner's iPhone Notes with a reliable, mobile-first daily tool for
running a one-person lawn service business. Version 1 core workflow:

Customer -> recurring schedule -> generated job -> Start Job ->
Complete Job OR stop and reschedule unfinished work.

## Stack (agreed)
- Next.js App Router, TypeScript
- Tailwind CSS
- Supabase PostgreSQL + Supabase Auth, Row Level Security enforced on all
  exposed tables
- Supabase accessed directly (no Prisma)
- Vercel-compatible hosting (deploy later, not during initial build)

One business, one owner login, one service property per customer for now.
Keep `organization_id` on business data throughout for future multi-business
expansion. The owner operates the timer in V1; crew accounts come later.

## Documents
- [docs/MVP.md](docs/MVP.md) — Version 1 requirements and acceptance criteria
- [docs/ROADMAP.md](docs/ROADMAP.md) — future phases and parked ideas
- [docs/BUILD-STATUS.md](docs/BUILD-STATUS.md) — current progress, decisions,
  blockers, and next step (update after every milestone)
- [docs/TECHNICAL-PLAN.md](docs/TECHNICAL-PLAN.md) — tables, scheduling
  rules, timer rules, build order (created during planning, before coding)
- [lawn-service-build-playbook.md](lawn-service-build-playbook.md) — the
  full build playbook and prompt sequence this project follows

## MVP boundaries
Build only what's in docs/MVP.md. Do not build weather, SMS/email
automation, routing, payments, invoices, crew management, advanced
analytics, AI, customer portal, public signup, photos, realtime
subscriptions, or offline synchronization in this pass. Parked ideas and
future phases belong in docs/ROADMAP.md, not in this build.

## Test expectations
Run type checking, lint (if configured), and a production build before
calling a milestone done. Write meaningful tests for: recurrence and
month-end date math, timezone handling, duplicate job generation,
moved/skipped occurrences, timer persistence and concurrency (no duplicate
active timers, idempotent completion), and organization-scoped access
(signed-out and cross-organization reads/writes must be denied). Distinguish
checks actually run from checks blocked by credentials or unavailable
browser tools — never report an unrun check as passed.

## Process rule
Update docs/BUILD-STATUS.md after each milestone: what's done, decisions
made, files changed, checks run and results, outstanding issues, and the
exact next step. Do not rebuild completed features or add roadmap features
without being asked.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
