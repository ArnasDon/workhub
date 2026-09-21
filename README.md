# WorkHub

A personal work tracker shaped around **initiatives with a running log**, not tickets. One dashboard shows everything in flight and how stale it is; every initiative keeps an append-only trail of what happened, what you decided, and what's next.

Single-user. Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui (Radix) · Drizzle · Supabase Postgres + Auth.

## What's in v1

- Initiatives: title, **description** (Markdown, with a formatting toolbar and preview), area/tag, status, priority, target date, links, pin.
- **To-do list** per initiative: add, edit inline, check off, delete. Cards on the dashboard and board show a progress bar with done/total and a percentage. Checking an item off is written to the log.
- **Related work**: link initiatives as "blocked by" or "related". Cards show "Blocked by N" while any blocker is still open; links and unlinks are written to the log.
- Status flow `Idea → In progress → Blocked → Waiting on someone → Done → Archived`, changeable inline from the dashboard card or the detail page. Every change is written to the log.
- Append-only log per initiative, grouped by day. Entries are GitHub-flavoured Markdown: lists, bold, code, tables, task lists; bare URLs become links. Raw HTML is never rendered.
- Dashboard grouped by status or area, sortable, area filter chips, "updated Xd ago", stale flag after 7 days, pinned items first.
- **Board view** (`/board`): one column per status, drag cards between columns (mouse, touch, or keyboard), or use the card menu's "Move to". Every move is written to the log.
- Quick capture: `⌘K` → pick an initiative → type → `⌘Enter`. Every card also has a "Log update" button that opens the same dialog pre-targeted.
- **Timeline** (`/timeline`): initiatives with a target date, overdue first, then by month, with "in N days" labels. In-flight items without a date are listed so you can give them one.
- **Digest** (`/digest`): everything logged in the last 7, 14 or 30 days grouped by initiative, plus completed, new, and gone-quiet lists. **Copy as Markdown** for a status post or 1:1 notes.
- Full-text search over titles, areas, and log entries (`websearch` syntax: quotes, `-word`, `OR`).
- Export everything as JSON (backup), Markdown (readable), or CSV (log entries joined with their initiative, or one row per initiative) from the header.
- Activity streak chip on the dashboard: consecutive days with at least one entry, plus this week's count on hover.
- Warm cream/terracotta theme, light and dark, responsive down to phone width.
- Email + password sign-in restricted to one email address, with password reset. Sessions persist in cookies and are refreshed automatically, so you stay signed in across visits.

## Setup (about 15 minutes)

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **Project Settings → API**: copy the Project URL and the `anon` public key.
3. Click **Connect** in the dashboard top bar → **Connection String** → Type **URI** → Method **Transaction pooler** (port `6543`). Replace `[YOUR-PASSWORD]` with the database password (reset it under Project Settings → Database if you don't have it). This is `DATABASE_URL`.
4. **Authentication → URL Configuration**: set *Site URL* to your deployed URL (or `http://localhost:4700` for now) and add `http://localhost:4700/auth/callback` and `https://<your-domain>/auth/callback` to *Redirect URLs*.
5. **Authentication → Providers → Email**: keep Email enabled. Recommended: turn **off** "Confirm email" so creating your account signs you straight in (the app only ever admits `ALLOWED_EMAIL`, so confirmation adds nothing). If you leave it on, you'll get a confirmation mail after registering and must click it before signing in.

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

This applies `drizzle/*.sql`: the tables, enums, indexes, full-text indexes, an `updated_at` trigger, and enables RLS so the public Supabase REST API exposes nothing (the app talks to Postgres directly through `DATABASE_URL`). Apply new files in order whenever `drizzle/` gains one; the app tolerates missing `initiative_relations` and `tasks` tables; the `description` column (0004) is required once deployed (they just appear empty) so deploying before migrating is safe.

### 4. Run

```bash
npm run dev
```

No Supabase yet? Run the whole app with an embedded database and a mock sign-in instead:

```bash
npm run dev:local
```

That starts PGlite (WASM Postgres, real migrations, sample data) plus a tiny mock of Supabase Auth. Sign in as `local@workhub.dev` with any password. Data persists in `.pglite-dev/`; delete the folder to reset. Nothing from this mode ships to production: it only activates when `DATABASE_URL` starts with `pglite://`.

Open <http://localhost:4700>, switch to **Create account**, register with the `ALLOWED_EMAIL` address and a password (8+ characters). Afterwards use **Sign in**. "Forgot password?" emails a reset link that lands on `/account/password`, which is also where you change the password later (key icon in the header).

### 5. Deploy (Hostinger Node.js hosting)

The live instance runs on Hostinger, recorded in `.hostinger/site.json`. It is a Node.js website with `app_type: next`, Node 24, build script `build`; the platform runs `npm install`, `npm run build` and `npm start` (which honours `PORT`).

1. Set all five environment variables in hPanel → Websites → the site → Node.js → **Environment variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (Transaction pooler string), `ALLOWED_EMAIL`, `NEXT_PUBLIC_SITE_URL` (the site's https origin, used for confirmation and password-reset email links). Saving is a full replace, so always send the complete set.
2. **Rebuild after changing any `NEXT_PUBLIC_*` variable.** They are compiled into the bundle; a restart alone keeps the old values.
3. Add `https://<domain>/auth/callback` to Supabase → Authentication → URL Configuration → Redirect URLs, and set Site URL to the domain.
4. Deploy a new version by uploading a source-only archive (no `node_modules`, `.next`, or `.env*`):

```bash
git archive --format=zip -o /tmp/workhub_$(date +%Y%m%d_%H%M%S).zip HEAD
```

then hand that file to the Hostinger deploy tool (or hPanel's Node.js upload). Build status and logs are under Node.js → Deployments. Migrations are never run by the platform; run `npm run db:migrate` locally against the same `DATABASE_URL` whenever `drizzle/` changes.

Vercel works too with the first three variables plus `ALLOWED_EMAIL`; no config changes needed.

## Security model

- **One user.** Sign-in and registration refuse any address not in `ALLOWED_EMAIL`, checked in the request proxy *and* in every server action (`requireUser()`).
- **Database access** goes through `DATABASE_URL` server-side only. Every table has RLS enabled with no policies, so Supabase's public REST API exposes nothing even with the anon key.
- **Session cookies are HttpOnly**, `SameSite=Lax`, `Secure` in production. The app has no browser-side Supabase client, so page JavaScript never touches tokens.
- **Content Security Policy** with a per-request nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'`), plus `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS on https, and `X-Robots-Tag: noindex` (also `robots.txt` disallow). Set in `lib/security-headers.ts`, applied by the proxy.
- **Auth actions are rate-limited** per IP (10 sign-in attempts / 15 min; 5 sign-ups and 5 reset requests / hour) in addition to Supabase's own limits.
- **Input validation** with zod on every action; external links must be http(s); Markdown never renders raw HTML and strips unsafe URL schemes; the auth callback only follows same-origin `next` paths.
- Dependencies are audited in CI (`npm audit --audit-level=high`).

## Backups

Supabase's free tier has no automated backups. Use **Export → JSON** in the header now and then; the file contains every initiative and log entry with ids and timestamps, so it can be re-imported by hand or with a short script. The Markdown export is the human-readable version of the same data.

## Development

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # next build (works without a database)
npm run dev:local   # full app on embedded Postgres + mock auth, no Supabase needed
npm run test:db     # PGlite smoke test of migrations + queries
npm run db:generate # after editing db/schema.ts: writes a new SQL migration
npm run db:studio   # Drizzle Studio against DATABASE_URL
```

CI runs lint, typecheck, build and `npm audit --audit-level=high` on every push and PR.

## Layout

```
app/
  (app)/                 authenticated shell: header + ⌘K palette
    page.tsx             dashboard (grouping, sort, filters, search results)
    board/               Kanban board (dnd-kit), one column per status
    timeline/            target dates by month, overdue on top
    digest/              weekly digest with copy-as-Markdown
    initiatives/new      create form
    initiatives/[id]     detail: metadata, status, log form, timeline
  login/                 sign in / create account / reset password
  account/password       set a new password (reset landing + change)
  auth/callback          exchanges email links (confirm, reset) for a session
  auth/signout           POST → sign out
  api/export             GET ?format=json|md|csv[&table=initiatives]
components/              app components; components/ui is shadcn (owned code)
db/schema.ts             Drizzle schema (source of truth)
drizzle/                 generated SQL migrations
lib/actions.ts           server actions (all call requireUser first)
lib/queries.ts           read queries
lib/supabase/            SSR clients; proxy.ts refreshes sessions and gates routes
proxy.ts                 Next 16 request proxy (formerly middleware)
```

## Roadmap

See the phased plan in `docs/requirements.md`. AI-assisted features are parked for now. Everything in the requirements document has shipped except attachments on log entries; to-do lists with progress were added on request.
