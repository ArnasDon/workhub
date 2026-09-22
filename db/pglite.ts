import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { count } from "drizzle-orm";
import * as schema from "./schema";
import type { Db } from "./index";

/**
 * Local-only database for `npm run dev:local`: embedded Postgres, real
 * migrations, optional sample data. Persists to the directory named in the
 * URL (pglite://.pglite-dev) so restarts keep your test data.
 */
export async function bootPglite(url: string, seed: boolean) {
  const g = globalThis as unknown as { __workhubDb?: Db };
  if (g.__workhubDb) return;
  const dataDir = url.replace(/^pglite:\/\//, "");
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  if (seed) await seedIfEmpty(db);
  g.__workhubDb = db as unknown as Db;
  console.log(`[workhub] local PGlite database ready${dataDir ? ` at ${dataDir}` : " (in memory)"}`);
}

const day = 86_400_000;
const ago = (days: number, hours = 9) => new Date(Date.now() - days * day - (24 - hours) * 3_600_000);

async function seedIfEmpty(db: ReturnType<typeof drizzle<typeof schema>>) {
  const [{ n }] = await db.select({ n: count() }).from(schema.initiatives);
  if (Number(n) > 0) return;
  const rows = await db
    .insert(schema.initiatives)
    .values([
      { title: "Node.js hosting: template gallery launch", description: "Launch a **gallery of starter templates** for Node.js hosting.\n\n- Why: cuts time-to-first-deploy for new users\n- Done when: gallery live for 100% of users and tracked in analytics", area: "Node.js Hosting", status: "in_progress", priority: "high", targetDate: iso(21), pinned: true, links: [{ label: "PRD", url: "https://example.com/prd" }], createdAt: ago(40), updatedAt: ago(40) },
      { title: "Publish MCP server to registries", area: "MCP Distribution", status: "blocked", priority: "high", createdAt: ago(30), updatedAt: ago(30) },
      { title: "Google Ads conversion import", area: "Ads Integrations", status: "waiting", priority: "medium", targetDate: iso(45), waitingOn: "Ads API partner team", waitingSince: ago(15), createdAt: ago(25), updatedAt: ago(25) },
      { title: "Weekly digest for 1:1s", description: "A page that compiles the week's log into a status update I can paste into Slack.", area: "Side project", status: "idea", priority: "low", createdAt: ago(3), updatedAt: ago(3) },
      { title: "Headless landing page a11y pass", area: "Node.js Hosting", status: "done", priority: "medium", createdAt: ago(60), updatedAt: ago(12) },
      { title: "Onboarding email sequence", area: "Ads Integrations", status: "in_progress", priority: "low", checkInDays: 30, createdAt: ago(20), updatedAt: ago(20) },
      { title: "Partner listing copy refresh", area: "MCP Distribution", status: "in_progress", priority: "medium", targetDate: iso(-4), createdAt: ago(18), updatedAt: ago(18) },
    ])
    .returning({ id: schema.initiatives.id, title: schema.initiatives.title });
  const id = (t: string) => rows.find((r) => r.title.startsWith(t))!.id;
  await db.insert(schema.logEntries).values([
    { initiativeId: id("Node.js"), kind: "decision", body: "Ship behind a **feature flag** and iterate on the gallery copy after the first week of data.", createdAt: ago(38) },
    { initiativeId: id("Publish"), kind: "blocker", body: "Registry review blocked on the manifest schema question.", createdAt: ago(10) },
    { initiativeId: id("Node.js"), body: "Delayed to Q4 due to eng capacity. Design is final: https://example.com/figma", createdAt: ago(1) },
    { initiativeId: id("Publish"), body: "Registry review is stuck on the manifest schema. Pinged maintainers; waiting on an answer.", createdAt: ago(9) },
    { initiativeId: id("Google"), body: "Waiting on the Ads API partner approval. Ticket filed.", createdAt: ago(15) },
    { initiativeId: id("Headless"), body: "All 13 findings fixed, Lighthouse a11y 100. Closing.", createdAt: ago(12) },
  ]);
  await db.insert(schema.initiativeRelations).values([
    { fromId: id("Node.js"), toId: id("Publish"), kind: "blocked_by" },
    { fromId: id("Weekly"), toId: id("Node.js"), kind: "related" },
  ]);
  await db.insert(schema.tasks).values([
    { initiativeId: id("Node.js"), title: "Finalise gallery copy with marketing", position: 0, done: true, doneAt: ago(2) },
    { initiativeId: id("Node.js"), title: "Ship behind feature flag", position: 1, done: true, doneAt: ago(1) },
    { initiativeId: id("Node.js"), title: "Enable for 10% of users", position: 2 },
    { initiativeId: id("Node.js"), title: "Review first week of metrics", position: 3 },
    { initiativeId: id("Publish"), title: "Fix manifest schema", position: 0 },
    { initiativeId: id("Publish"), title: "Resubmit to registry", position: 1 },
  ]);
  console.log("[workhub] seeded sample initiatives");
}

function iso(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * day).toISOString().slice(0, 10);
}
