# WorkHub — notes for coding agents

- Next 16 App Router. Read `node_modules/next/dist/docs/` before assuming an API; `middleware.ts` is now `proxy.ts`.
- shadcn/ui v4 with the Radix base: components live in `components/ui` and are owned code. Add more with `npx shadcn@latest add <name>`; don't hand-roll primitives.
- `cn` comes from the `cn` npm package via `lib/utils.ts`. Keep that dependency.
- Theme tokens live only in `app/globals.css` (oklch). Status colors are `--status-*` and exposed as `bg-status-*`/`text-status-*`. Don't add hex colors in components.
- Schema source of truth is `db/schema.ts`. After changing it run `npm run db:generate`; commit the new file under `drizzle/`. Never edit an existing migration that has been applied.
- Every server action and data-loading page calls `requireUser()` first. The proxy is a fast path, not the security boundary.
- Log entries are append-only by design. Do not add edit/delete for them without an explicit ask.
- Dev server port is 4700. Build must pass with no `.env.local` (`getDb()` is lazy for that reason).
- Checks before pushing: `npm run lint && npm run typecheck && npm run build`.
- Auth is email + password (not magic link). Registration and sign-in both refuse any address not in `ALLOWED_EMAIL`; the proxy and `requireUser()` enforce the same check on every request.
- To verify UI end to end without Supabase: `npm run dev:local` (PGlite + mock auth at scripts/mock-auth.mjs; sign in as local@workhub.dev, any password). Use it before opening a PR that touches authenticated pages.
- Schema changes: never touch the live database. Generate a new file under `drizzle/` and call it out in the PR; the owner applies it by hand.
