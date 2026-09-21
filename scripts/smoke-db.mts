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
  .values({ title: "Node.js hosting launch", area: "Node.js Hosting", status: "in_progress", priority: "high", targetDate: "2026-11-30", links: [{ label: "Doc", url: "https://example.com/doc" }], createdAt: OLD, updatedAt: OLD })
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

// Cascade delete removes entries.
await db.delete(initiatives).where(eq(initiatives.id, a.id));
assert.equal((await q.listEntries(a.id)).length, 0);
console.log("✓ cascade delete");

// Export shape.
const dump = await q.exportAll();
assert.equal(dump.initiatives.length, 2);
assert.equal(dump.logEntries.length, 1);
assert.ok(dump.exportedAt);
console.log("✓ exportAll");

await client.close();
console.log("\nAll database smoke checks passed.");
