/**
 * Applies the real drizzle/ migrations to an in-memory WASM Postgres (PGlite)
 * and exercises the query + action layer. No Docker, no network, no secrets.
 *   npm run test:db
 */
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

const client = new PGlite();
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✓ migrations applied");

// Make lib/queries use this db instead of DATABASE_URL.
(globalThis as unknown as { __workhubDb: unknown }).__workhubDb = db;
const q = await import("../lib/queries");
const { initiatives, logEntries } = schema;

// RLS is enabled with no policies.
const rls = await client.query<{ relname: string; relrowsecurity: boolean }>(
  "select relname, relrowsecurity from pg_class where relname in ('initiatives','log_entries')",
);
assert.equal(rls.rows.length, 2);
assert.ok(rls.rows.every((r) => r.relrowsecurity), "RLS must be enabled on both tables");
console.log("✓ RLS enabled");

// Seed. Back-date updated_at so log entries, not row creation, define "last activity".
const OLD = new Date("2026-08-01T00:00:00Z");
const [a] = await db
  .insert(initiatives)
  .values({ title: "Node.js hosting launch", description: "## Why\nShip **fast**.", area: "Node.js Hosting", status: "in_progress", priority: "high", targetDate: "2026-11-30", links: [{ label: "Doc", url: "https://example.com/doc" }], createdAt: OLD, updatedAt: OLD })
  .returning();
const [b] = await db
  .insert(initiatives)
  .values({ title: "MCP server listing", area: "MCP Distribution", status: "blocked", pinned: true, createdAt: OLD, updatedAt: OLD })
  .returning();
const [c] = await db.insert(initiatives).values({ title: "Old idea", status: "archived" }).returning();
await db.insert(logEntries).values([
  { initiativeId: a.id, body: "Kickoff done. Decided to ship behind a flag.", createdAt: new Date("2026-09-01T10:00:00Z") },
  { initiativeId: a.id, body: "Delayed to Q4 due to eng capacity.", createdAt: new Date("2026-09-20T09:00:00Z") },
  { initiativeId: b.id, body: "Waiting on registry approval; pinged the maintainers.", createdAt: new Date("2026-09-10T09:00:00Z") },
]);
console.log("✓ seeded");

// listInitiatives: excludes archived, pinned first, activity computed from entries.
const list = await q.listInitiatives();
assert.deepEqual(list.map((i) => i.title), ["MCP server listing", "Node.js hosting launch"]);
const nodeRow = list.find((i) => i.id === a.id)!;
assert.equal(nodeRow.entryCount, 2);
assert.equal(nodeRow.latestEntry?.body, "Delayed to Q4 due to eng capacity.");
assert.equal(nodeRow.lastActivityAt.toISOString(), "2026-09-20T09:00:00.000Z");
assert.deepEqual(nodeRow.links, [{ label: "Doc", url: "https://example.com/doc" }]);
assert.equal(nodeRow.description, "## Why\nShip **fast**.");
assert.equal((await q.listInitiatives()).find((i) => i.id === b.id)?.description, "", "description defaults to empty");
const withArchived = await q.listInitiatives({ includeArchived: true });
assert.equal(withArchived.length, 3);
const filtered = await q.listInitiatives({ area: "MCP Distribution" });
assert.deepEqual(filtered.map((i) => i.id), [b.id]);
console.log("✓ listInitiatives");

// Sorting.
const byPriority = q.sortInitiatives(list.map((i) => ({ ...i, pinned: false })), "priority");
assert.equal(byPriority[0].id, a.id);
const byTarget = q.sortInitiatives(list.map((i) => ({ ...i, pinned: false })), "target");
assert.equal(byTarget[0].id, a.id, "items with a target date sort first");
console.log("✓ sortInitiatives");

// Areas + palette options.
assert.deepEqual(await q.listAreas(), ["MCP Distribution", "Node.js Hosting"]);
const options = await q.listInitiativeOptions();
assert.deepEqual(options.map((o) => o.id), [b.id, a.id], "pinned first, no archived");
console.log("✓ listAreas / listInitiativeOptions");

// Search: full text, partial word, exclusion, hits in both tables.
let res = await q.search("capacity");
assert.deepEqual(res.entries.map((e) => e.initiativeId), [a.id]);
assert.equal(res.initiatives.length, 0);
res = await q.search("MCP");
assert.deepEqual(res.initiatives.map((i) => i.id), [b.id]);
res = await q.search("host"); // partial → ilike fallback
assert.ok(res.initiatives.some((i) => i.id === a.id));
res = await q.search("registry -approval"); // websearch exclusion
assert.equal(res.entries.length, 0);
res = await q.search("");
assert.deepEqual(res, { initiatives: [], entries: [] });
console.log("✓ search");

// Digest: entries in window grouped per initiative, quiet detection, markdown output.
{
  const { digestToMarkdown } = await import("../lib/digest");
  const now = new Date("2026-09-21T12:00:00Z");
  const d = await q.getDigest(7, now);
  assert.equal(d.entryCount, 1, "only the 2026-09-20 entry is within 7 days");
  assert.deepEqual(d.groups.map((g) => g.initiative.id), [a.id]);
  assert.ok(d.quiet.some((i) => i.id === b.id), "blocked initiative with a 11-day-old entry is quiet");
  const md = digestToMarkdown(d);
  assert.match(md, /^# WorkHub digest/);
  assert.match(md, /## Node.js hosting launch \(In progress · Node.js Hosting\)/);
  assert.match(md, /Delayed to Q4/);
  assert.match(md, /## Gone quiet/);
  const wide = await q.getDigest(30, now);
  assert.equal(wide.entryCount, 3);
  console.log("✓ getDigest / digestToMarkdown");
}

// Relations: both directions, open-blocker counts, uniqueness, self-link check, cascade.
{
  const { initiativeRelations } = schema;
  await db.insert(initiativeRelations).values({ fromId: a.id, toId: b.id, kind: "blocked_by" });
  await db.insert(initiativeRelations).values({ fromId: a.id, toId: c.id, kind: "related" });
  const fromA = await q.listRelations(a.id);
  assert.deepEqual(fromA.map((r) => [r.direction, r.other.id]), [["blocked_by", b.id], ["related", c.id]]);
  const fromB = await q.listRelations(b.id);
  assert.deepEqual(fromB.map((r) => [r.direction, r.other.id]), [["blocks", a.id]]);
  const withBlockers = await q.listInitiatives();
  assert.equal(withBlockers.find((i) => i.id === a.id)?.openBlockers, 1, "b is blocked and counts as an open blocker");
  assert.equal(withBlockers.find((i) => i.id === b.id)?.openBlockers, 0);
  const causeMatches = (re: RegExp) => (err: unknown) => {
    const cause = (err as { cause?: { message?: string } }).cause;
    assert.match(cause?.message ?? String(err), re);
    return true;
  };
  await assert.rejects(db.insert(initiativeRelations).values({ fromId: a.id, toId: b.id, kind: "blocked_by" }), causeMatches(/unique|duplicate/i));
  await assert.rejects(db.insert(initiativeRelations).values({ fromId: a.id, toId: a.id, kind: "related" }), causeMatches(/check|no_self/i));
  await db.update(initiatives).set({ status: "done" }).where(eq(initiatives.id, b.id));
  assert.equal((await q.listInitiatives()).find((i) => i.id === a.id)?.openBlockers, 0, "done blockers no longer count");
  await db.update(initiatives).set({ status: "blocked" }).where(eq(initiatives.id, b.id));
  console.log("✓ relations");
}

// Streak rule + CSV escaping (pure), and getStreak against the seeded rows.
{
  const day = (s: string) => new Date(`${s}T10:00:00Z`);
  const now = new Date("2026-09-21T12:00:00Z");
  let st = q.computeStreak([day("2026-09-21"), day("2026-09-20"), day("2026-09-19"), day("2026-09-10")], now);
  assert.equal(st.days, 3);
  assert.equal(st.loggedToday, true);
  assert.equal(st.thisWeek, 3);
  st = q.computeStreak([day("2026-09-20"), day("2026-09-19")], now);
  assert.equal(st.days, 2, "an empty today does not break yesterday's streak");
  assert.equal(st.loggedToday, false);
  st = q.computeStreak([day("2026-09-18")], now);
  assert.equal(st.days, 0, "a gap of a day ends the streak");
  assert.equal(q.computeStreak([], now).lastEntryAt, null);
  const live = await q.getStreak(now);
  assert.equal(live.thisWeek, 1);
  assert.equal(live.days, 1, "seeded entry on 2026-09-20 is yesterday → streak of 1");
  console.log("✓ computeStreak / getStreak");
  const { toCsv } = await import("../lib/csv");
  const csv = toCsv(["a", "b"], [["plain", 'say "hi", ok\nnext'], [null, 3]]);
  assert.equal(csv, '﻿a,b\r\nplain,"say ""hi"", ok\nnext"\r\n,3\r\n');
  console.log("✓ toCsv");
}

// Tasks: ordering, progress aggregate, cascade.
{
  const { tasks } = schema;
  await db.insert(tasks).values([
    { initiativeId: a.id, title: "first", position: 0 },
    { initiativeId: a.id, title: "second", position: 1, done: true, doneAt: new Date("2026-09-20T10:00:00Z") },
    { initiativeId: a.id, title: "third", position: 2, done: true, doneAt: new Date("2026-09-21T10:00:00Z") },
  ]);
  const list = await q.listTasks(a.id);
  assert.deepEqual(list.map((t) => t.title), ["first", "third", "second"], "open first, then completed newest first");
  const withTasks = await q.listInitiatives();
  const row = withTasks.find((i) => i.id === a.id)!;
  assert.equal(row.taskTotal, 3);
  assert.equal(row.taskDone, 2);
  assert.equal(withTasks.find((i) => i.id === b.id)?.taskTotal, 0);
  console.log("✓ tasks");
}

// Detail + entries newest first.
const entries = await q.listEntries(a.id);
assert.equal(entries[0].body, "Delayed to Q4 due to eng capacity.");
assert.equal((await q.getInitiative(c.id))?.status, "archived");
assert.equal(await q.getInitiative("00000000-0000-0000-0000-000000000000"), null);
console.log("✓ getInitiative / listEntries");

// updated_at trigger fires on UPDATE.
const before = (await q.getInitiative(a.id))!.updatedAt;
await new Promise((r) => setTimeout(r, 20));
await db.update(initiatives).set({ title: "Node.js hosting launch v2" }).where(eq(initiatives.id, a.id));
const after = (await q.getInitiative(a.id))!.updatedAt;
assert.ok(after > before, "updated_at trigger must bump the timestamp");
console.log("✓ updated_at trigger");

// Cascade delete removes entries and relations.
await db.delete(initiatives).where(eq(initiatives.id, a.id));
assert.equal((await q.listEntries(a.id)).length, 0);
assert.equal((await q.listRelations(b.id)).length, 0, "relations pointing at a deleted initiative are gone");
assert.equal((await q.listTasks(a.id)).length, 0, "tasks of a deleted initiative are gone");
console.log("✓ cascade delete");

// Export shape.
const dump = await q.exportAll();
assert.equal(dump.initiatives.length, 2);
assert.equal(dump.logEntries.length, 1);
assert.ok(dump.exportedAt);
console.log("✓ exportAll");

await client.close();
console.log("\nAll database smoke checks passed.");
