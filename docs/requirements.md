# Personal Work Tracker — Requirements & Roadmap

**Working name:** WorkHub
**Owner/user:** Single user — no multi-tenant needs
**Purpose:** Track many concurrent work initiatives (status, notes, decisions, next steps) in one place, with a shape that matches how a PM juggling parallel projects actually works — not a generic task list.

## 1. Problem Statement

Several initiatives run at once (product OKRs, integrations, distribution/listing work, side projects) and time is lost re-establishing context: "what's the current status," "what did I decide last time," "what's the next step." Generic tools force the workflow into their schema. This app is shaped around **initiatives with a running log**, not tickets or generic notes.

## 2. Goals / Non-Goals

**Goals**
- One home screen that shows the state of everything in progress, at a glance.
- Fast capture — logging an update should take under 10 seconds.
- Full history per initiative — never lose the "why" behind a decision.
- Data durably saved and exportable — this is not disposable.

**Non-goals (v1)**
- No team collaboration, permissions, or multi-user accounts.
- No time tracking / billing.
- No native mobile app (responsive web is enough).

## 3. Core Requirements (v1)

| # | Requirement | Detail | Status |
|---|---|---|---|
| 1 | Initiative CRUD | title, area/tag, status, priority, target date, links | ✅ |
| 2 | Status enum | `Idea → In Progress → Blocked → Waiting on someone → Done → Archived`, editable from list view | ✅ |
| 3 | Update log per initiative | Append-only timestamped entries | ✅ |
| 4 | Dashboard | Grouped by status or area; sortable; "last updated X days ago" | ✅ |
| 5 | Quick capture | Global shortcut to log against an initiative without a full form | ✅ ⌘K |
| 6 | Search | Full-text across titles and log entries | ✅ |
| 7 | Tags / areas | Free-form, filterable | ✅ |
| 8 | Persistence | Real database (Supabase Postgres), exportable | ✅ |
| 9 | Responsive layout | Laptop + phone browser | ✅ |

## 4. Nice-to-Have (v2+)

**High value, low effort**
- Kanban board view — ✅ shipped (`/board`, dnd-kit).
- Stale nudges (7+ days) — ✅ shipped early, trivial.
- Markdown support in log entries — ✅ shipped (react-markdown + remark-gfm, prose theme tokens).
- CSV / JSON / Markdown export — ✅ all three shipped.
- Command palette (⌘K) — ✅ shipped as the quick-capture surface.
- Pin/star initiatives — ✅ shipped (schema already had the column).

**Medium value**
- Cross-linking between initiatives ("blocked by X") — ✅ shipped (`initiative_relations`, migration 0002).
- Calendar/timeline view for target dates.
- Weekly digest view — ✅ shipped (`/digest`, 7/14/30 days, copy as Markdown).
- File/image attachments on log entries.
- Light/dark warm theme toggle — ✅ shipped.
- Activity streak indicator.

**Stretch / AI-assisted**
- "Summarize this" via the Claude API → clean log entry + suggested status.
- Auto-drafted weekly summary text.
- Related-initiative detection on create.

- To-do checklist per initiative with progress bar on cards — ✅ shipped 2026-09-21 (owner request, not in the original doc).
- Description per initiative with a Markdown toolbar editor — ✅ shipped 2026-09-21 (owner request).
- Entry types (update / decision / blocker / meeting; status + task automatic) and a `/decisions` log — ✅ shipped 2026-09-21 (migration 0006).
- Waiting-on tracker (who + since when, on cards and in the digest) — ✅ shipped 2026-09-22 (migration 0007).
- Snooze + per-initiative check-in cadence (one stale rule everywhere) — ✅ shipped 2026-09-22 (migration 0008).

**Out of scope unless asked:** notifications/email digests, Slack/Jira API integrations, multi-user sharing.

## 5. Data & Persistence

- Postgres via Supabase; Drizzle ORM over `DATABASE_URL`.
- Free tier has no automated backups → manual JSON export is a v1 requirement (shipped).
- Auth: Supabase email + password (registration limited to `ALLOWED_EMAIL`), persistent cookie session, password reset by email. Magic link was dropped 2026-09-21 at the owner's request.
- Data ownership: plain JSON/Markdown export, no lock-in.

## 6. Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 24 (Active LTS) |
| Framework | Next.js 16, App Router |
| Language | TypeScript |
| Database | Supabase (Postgres) |
| ORM | Drizzle |
| UI | shadcn/ui (Radix + Tailwind 4) |
| Icons | lucide-react |
| Hosting | Vercel (or Hostinger Node.js hosting) |

## 7. UI Requirements

- Warm palette: cream neutrals, terracotta primary, muted status colors (dusty green for done, soft ochre for blocked).
- One sans-serif (Geist), generous line-height, ≤2 body sizes per screen.
- Every core action ≤2 clicks from the dashboard.
- Friendly, instructive empty states.
- Keyboard navigable, visible focus, sufficient contrast (checked against the cream background).
- No modals-within-modals; one primary action per screen.

## 8. Roadmap

- **Phase 0 — Setup** ✅ scaffold, shadcn, warm tokens, Drizzle schema + migrations, Supabase Auth wiring, CI.
- **Phase 1 — Core loop** ✅ initiative CRUD, log model, dashboard, detail page, status control everywhere.
- **Phase 2 — Usability** ✅ quick capture, search, tags/areas filter, theme, responsive, JSON export.
- **Phase 3 — Nice-to-haves** ✅ stale flag, ⌘K, pin, Kanban, Markdown rendering.
- **Phase 4 — AI layer** ⏸ parked by the owner (2026-09-21); the non-AI digest shipped instead.
- **Phase 5 — Hardening** ☐ verify export/restore, auth edge cases, custom domain.

Remaining human steps before first real use: create the Supabase project, fill `.env.local`, run `npm run db:migrate`, deploy.

## 9. Data Schema

```
initiatives
- id (uuid, pk)
- title (text)
- description (text, Markdown, default '')   -- added 2026-09-21 (migration 0004), owner request
- area (text, default '')
- status (enum initiative_status)
- priority (enum initiative_priority: low/medium/high)
- target_date (date, nullable)
- links (jsonb: [{label, url}])
- pinned (boolean, default false)
- waiting_on (text, default ''), waiting_since (timestamptz, nullable)   -- migration 0007
- snoozed_until (date, nullable), check_in_days (int, nullable)          -- migration 0008
- created_at, updated_at (timestamptz)

log_entries
- id (uuid, pk)
- initiative_id (fk → initiatives.id, cascade)
- kind (enum entry_kind: update|decision|blocker|meeting|status|task, default update)  -- migration 0006
- body (text)
- created_at (timestamptz)

tasks                           -- added 2026-09-21 (migration 0003), owner request
- id (uuid, pk)
- initiative_id (fk → initiatives.id, cascade)
- title (text), done (bool), done_at (timestamptz, nullable)
- position (int), created_at, updated_at

initiative_relations            -- added 2026-09-21 (migration 0002)
- id (uuid, pk)
- from_id, to_id (fk → initiatives.id, cascade; from ≠ to)
- kind (enum relation_kind: blocked_by | related)
- created_at (timestamptz)
- unique (from_id, to_id, kind)
```

Intentionally minimal. Resist adding fields until the update-log workflow proves a need.
