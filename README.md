# WorkHub

A personal work tracker shaped around **initiatives with a running log**, not tickets. One dashboard shows everything in flight and how stale it is; every initiative keeps an append-only trail of what happened, what you decided, and what's next.

Single-user. Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui (Radix) · Drizzle · Supabase Postgres + Auth.

## What's in v1

- Initiatives: title, area/tag, status, priority, target date, links, pin.
- Status flow `Idea → In progress → Blocked → Waiting on someone → Done → Archived`, changeable inline from the dashboard card or the detail page. Every change is written to the log.
- Append-only log per initiative, grouped by day, links clickable.
- Dashboard grouped by status or area, sortable, area filter chips, "updated Xd ago", stale flag after 7 days, pinned items first.
- Quick capture: `⌘K` → pick an initiative → type → `⌘Enter`. Every card also has a "Log update" button that opens the same dialog pre-targeted.
- Full-text search over titles, areas, and log entries (`websearch` syntax: quotes, `-word`, `OR`).
- Export everything as JSON (backup) or Markdown (readable) from the header.
- Warm cream/terracotta theme, light and dark, responsive down to phone width.
- Magic-link sign-in restricted to one email address.

## Setup (about 15 minutes)

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **Project Settings → API**: copy the Project URL and the `anon` public key.
3. **Project Settings → Database → Connection string → URI**: copy it. For Vercel use the **Transaction pooler** (port `6543`). Locally the direct connection (`5432`) also works.
4. **Authentication → URL Configuration**: set *Site URL* to your deployed URL (or `http://localhost:4700` for now) and add `http://localhost:4700/auth/callback` and `https://<your-domain>/auth/callback` to *Redirect URLs*.
5. **Authentication → Providers → Email**: keep Email enabled. Magic links are on by default. Optionally turn off "Confirm email" since the app only ever admits one address anyway.

### 2. Local environment

```bash
cp .env.example .env.local
```

Fill in the four values. `ALLOWED_EMAIL` is the only address that can sign in; a comma-separated list works if you have two.

### 3. Database schema

```bash
npm install
npm run db:migrate
```

This applies `drizzle/*.sql`: the two tables, enums, indexes, full-text indexes, an `updated_at` trigger, and enables RLS so the public Supabase REST API exposes nothing (the app talks to Postgres directly through `DATABASE_URL`).

### 4. Run

```bash
npm run dev
```

Open <http://localhost:4700>, enter your email, click the link in the mail.

### 5. Deploy (Vercel)

1. Import the repo in Vercel. Framework preset: Next.js. No build overrides needed.
2. Add the same four environment variables (use the pooler `DATABASE_URL`).
3. Add your Vercel URL to the Supabase redirect list from step 1.4.
4. Deploy. Migrations are not run by Vercel; run `npm run db:migrate` locally against the same `DATABASE_URL` whenever `drizzle/` changes.

Hostinger's Node.js hosting works too: it just needs the same env vars and `npm run build` / `npm start`.

## Backups

Supabase's free tier has no automated backups. Use **Export → JSON** in the header now and then; the file contains every initiative and log entry with ids and timestamps, so it can be re-imported by hand or with a short script. The Markdown export is the human-readable version of the same data.

## Development

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # next build (works without a database)
npm run db:generate # after editing db/schema.ts: writes a new SQL migration
npm run db:studio   # Drizzle Studio against DATABASE_URL
```

CI runs lint, typecheck, build and `npm audit --audit-level=high` on every push and PR.

## Layout

```
app/
  (app)/                 authenticated shell: header + ⌘K palette
    page.tsx             dashboard (grouping, sort, filters, search results)
    initiatives/new      create form
    initiatives/[id]     detail: metadata, status, log form, timeline
  login/                 magic-link form
  auth/callback          exchanges the link for a session
  auth/signout           POST → sign out
  api/export             GET ?format=json|md
components/              app components; components/ui is shadcn (owned code)
db/schema.ts             Drizzle schema (source of truth)
drizzle/                 generated SQL migrations
lib/actions.ts           server actions (all call requireUser first)
lib/queries.ts           read queries
lib/supabase/            SSR clients; proxy.ts refreshes sessions and gates routes
proxy.ts                 Next 16 request proxy (formerly middleware)
```

## Roadmap

See the phased plan in `docs/requirements.md`. Next up: Kanban view, Markdown rendering in entries, weekly digest, and the Claude-assisted "summarise this into a log entry" button.
