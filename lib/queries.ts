import { and, asc, count, desc, eq, gte, ilike, max, ne, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { initiativeRelations, initiatives, logEntries, tasks, type Initiative, type LogEntry, type RelationKind, type Task } from "@/db/schema";
import { rootCause } from "@/lib/db-error";
import type { Sort } from "@/lib/constants";
import { PRIORITY_RANK } from "@/lib/constants";

export type InitiativeWithActivity = Initiative & {
  /** max(updated_at, latest log entry) */
  lastActivityAt: Date;
  entryCount: number;
  latestEntry: { body: string; createdAt: Date } | null;
  /** Number of blockers (blocked_by targets) that are not yet done/archived. */
  openBlockers: number;
  /** Checklist progress. */
  taskTotal: number;
  taskDone: number;
};

export type ListOptions = {
  includeArchived?: boolean;
  area?: string;
  sort?: Sort;
};

export async function listInitiatives(opts: ListOptions = {}): Promise<InitiativeWithActivity[]> {
  const db = getDb();

  const activity = db
    .select({
      initiativeId: logEntries.initiativeId,
      lastEntryAt: max(logEntries.createdAt).as("last_entry_at"),
      entryCount: count().as("entry_count"),
    })
    .from(logEntries)
    .groupBy(logEntries.initiativeId)
    .as("activity");

  const where = and(
    opts.includeArchived ? undefined : ne(initiatives.status, "archived"),
    opts.area ? eq(initiatives.area, opts.area) : undefined,
  );

  const rows = await db
    .select({
      initiative: initiatives,
      lastEntryAt: activity.lastEntryAt,
      entryCount: activity.entryCount,
    })
    .from(initiatives)
    .leftJoin(activity, eq(activity.initiativeId, initiatives.id))
    .where(where);

  // Latest entry body per initiative, for the "what's the current status" glance.
  const latest = await db
    .selectDistinctOn([logEntries.initiativeId], {
      initiativeId: logEntries.initiativeId,
      body: logEntries.body,
      createdAt: logEntries.createdAt,
    })
    .from(logEntries)
    .orderBy(logEntries.initiativeId, desc(logEntries.createdAt));
  const latestById = new Map(latest.map((l) => [l.initiativeId, l]));
  const [blockers, progress] = await Promise.all([openBlockerCounts(), taskProgress()]);

  const result: InitiativeWithActivity[] = rows.map((r) => {
    const lastEntryAt = r.lastEntryAt ? new Date(r.lastEntryAt) : null;
    const lastActivityAt =
      lastEntryAt && lastEntryAt > r.initiative.updatedAt ? lastEntryAt : r.initiative.updatedAt;
    const le = latestById.get(r.initiative.id);
    return {
      ...r.initiative,
      lastActivityAt,
      entryCount: Number(r.entryCount ?? 0),
      latestEntry: le ? { body: le.body, createdAt: le.createdAt } : null,
      openBlockers: blockers.get(r.initiative.id) ?? 0,
      taskTotal: progress.get(r.initiative.id)?.total ?? 0,
      taskDone: progress.get(r.initiative.id)?.done ?? 0,
    };
  });

  return sortInitiatives(result, opts.sort ?? "activity");
}

/** Tolerate a table that a not-yet-applied migration creates: behave as if it were empty. */
async function tolerateMissingTable<T>(migration: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (rootCause(err).code === "42P01") {
      console.warn(`[workhub] a table is missing; apply drizzle/${migration}`);
      return fallback;
    }
    throw err;
  }
}
const tolerateMissingRelations = <T,>(fn: () => Promise<T>, fallback: T) =>
  tolerateMissingTable("0002_initiative_relations.sql", fn, fallback);
const tolerateMissingTasks = <T,>(fn: () => Promise<T>, fallback: T) => tolerateMissingTable("0003_tasks.sql", fn, fallback);

async function taskProgress(): Promise<Map<string, { total: number; done: number }>> {
  const db = getDb();
  return tolerateMissingTasks(async () => {
    const rows = await db
      .select({
        initiativeId: tasks.initiativeId,
        total: count(),
        done: sql<number>`count(*) filter (where ${tasks.done})`,
      })
      .from(tasks)
      .groupBy(tasks.initiativeId);
    return new Map(rows.map((r) => [r.initiativeId, { total: Number(r.total), done: Number(r.done) }]));
  }, new Map());
}

// ── Tasks ────────────────────────────────────────────────────────────────────

/** Open tasks in position order, then completed ones most recent first. */
export async function listTasks(initiativeId: string): Promise<Task[]> {
  const db = getDb();
  return tolerateMissingTasks(async () => {
    const rows = await db.select().from(tasks).where(eq(tasks.initiativeId, initiativeId));
    return rows.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0);
      return a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime();
    });
  }, []);
}

async function openBlockerCounts(): Promise<Map<string, number>> {
  const db = getDb();
  return tolerateMissingRelations(async () => {
    const blocker = alias(initiatives, "blocker");
    const rows = await db
      .select({ fromId: initiativeRelations.fromId, n: count() })
      .from(initiativeRelations)
      .innerJoin(blocker, eq(blocker.id, initiativeRelations.toId))
      .where(and(eq(initiativeRelations.kind, "blocked_by"), notInArray(blocker.status, ["done", "archived"])))
      .groupBy(initiativeRelations.fromId);
    return new Map(rows.map((r) => [r.fromId, Number(r.n)]));
  }, new Map());
}

// ── Relations ────────────────────────────────────────────────────────────────

export type RelationView = {
  id: string;
  kind: RelationKind;
  /** How this relation reads from the current initiative's point of view. */
  direction: "blocked_by" | "blocks" | "related";
  other: Pick<Initiative, "id" | "title" | "status" | "area">;
};

/** All relations touching `id`, phrased from its point of view. */
export async function listRelations(id: string): Promise<RelationView[]> {
  const db = getDb();
  return tolerateMissingRelations(async () => {
    const other = alias(initiatives, "other");
    const outgoing = await db
      .select({ id: initiativeRelations.id, kind: initiativeRelations.kind, otherId: other.id, title: other.title, status: other.status, area: other.area })
      .from(initiativeRelations)
      .innerJoin(other, eq(other.id, initiativeRelations.toId))
      .where(eq(initiativeRelations.fromId, id));
    const incoming = await db
      .select({ id: initiativeRelations.id, kind: initiativeRelations.kind, otherId: other.id, title: other.title, status: other.status, area: other.area })
      .from(initiativeRelations)
      .innerJoin(other, eq(other.id, initiativeRelations.fromId))
      .where(eq(initiativeRelations.toId, id));
    const view = (r: (typeof outgoing)[number], direction: RelationView["direction"]): RelationView => ({
      id: r.id,
      kind: r.kind,
      direction,
      other: { id: r.otherId, title: r.title, status: r.status, area: r.area },
    });
    const all = [
      ...outgoing.map((r) => view(r, r.kind === "blocked_by" ? "blocked_by" : "related")),
      ...incoming.map((r) => view(r, r.kind === "blocked_by" ? "blocks" : "related")),
    ];
    const order: Record<RelationView["direction"], number> = { blocked_by: 0, blocks: 1, related: 2 };
    return all.sort((a, b) => order[a.direction] - order[b.direction] || a.other.title.localeCompare(b.other.title));
  }, []);
}

export function sortInitiatives<T extends InitiativeWithActivity>(items: T[], sort: Sort): T[] {
  const by: Record<Sort, (a: T, b: T) => number> = {
    activity: (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
    priority: (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
    target: (a, b) => {
      if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
      return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
    },
    title: (a, b) => a.title.localeCompare(b.title),
  };
  // Pinned first, always.
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || by[sort](a, b));
}

export async function getInitiative(id: string): Promise<Initiative | null> {
  const db = getDb();
  const [row] = await db.select().from(initiatives).where(eq(initiatives.id, id)).limit(1);
  return row ?? null;
}

export async function listEntries(initiativeId: string): Promise<LogEntry[]> {
  const db = getDb();
  return db
    .select()
    .from(logEntries)
    .where(eq(logEntries.initiativeId, initiativeId))
    .orderBy(desc(logEntries.createdAt));
}

export async function listAreas(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ area: initiatives.area })
    .from(initiatives)
    .where(ne(initiatives.area, ""))
    .orderBy(asc(initiatives.area));
  return rows.map((r) => r.area);
}

/** Minimal list for the command palette. */
export async function listInitiativeOptions() {
  const db = getDb();
  return db
    .select({
      id: initiatives.id,
      title: initiatives.title,
      area: initiatives.area,
      status: initiatives.status,
    })
    .from(initiatives)
    .where(ne(initiatives.status, "archived"))
    .orderBy(desc(initiatives.pinned), desc(initiatives.updatedAt));
}

export type SearchResult = {
  initiatives: InitiativeWithActivity[];
  entries: (LogEntry & { initiativeTitle: string; initiativeStatus: Initiative["status"] })[];
};

/**
 * Full-text search (websearch syntax: quotes, -exclusions, OR) with an ilike
 * fallback so partial words still hit.
 */
export async function search(q: string): Promise<SearchResult> {
  const db = getDb();
  const term = q.trim();
  if (!term) return { initiatives: [], entries: [] };
  const like = `%${term.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const tsq = sql`websearch_to_tsquery('english', ${term})`;

  const matchedInitiatives = await db
    .select({ id: initiatives.id })
    .from(initiatives)
    .where(
      or(
        sql`to_tsvector('english', ${initiatives.title} || ' ' || ${initiatives.area}) @@ ${tsq}`,
        ilike(initiatives.title, like),
        ilike(initiatives.area, like),
      ),
    );
  const ids = new Set(matchedInitiatives.map((r) => r.id));

  const all = await listInitiatives({ includeArchived: true });
  const hits = all.filter((i) => ids.has(i.id));

  const entries = await db
    .select({
      id: logEntries.id,
      initiativeId: logEntries.initiativeId,
      body: logEntries.body,
      createdAt: logEntries.createdAt,
      initiativeTitle: initiatives.title,
      initiativeStatus: initiatives.status,
    })
    .from(logEntries)
    .innerJoin(initiatives, eq(initiatives.id, logEntries.initiativeId))
    .where(
      or(
        sql`to_tsvector('english', ${logEntries.body}) @@ ${tsq}`,
        ilike(logEntries.body, like),
      ),
    )
    .orderBy(desc(logEntries.createdAt))
    .limit(100);

  return { initiatives: hits, entries };
}

export async function exportAll() {
  const db = getDb();
  const [inits, entries] = await Promise.all([
    db.select().from(initiatives).orderBy(asc(initiatives.createdAt)),
    db.select().from(logEntries).orderBy(asc(logEntries.createdAt)),
  ]);
  return { exportedAt: new Date().toISOString(), initiatives: inits, logEntries: entries };
}

// ── Digest ──────────────────────────────────────────────────────────────────

export type DigestGroup = {
  initiative: Initiative;
  entries: LogEntry[];
};

export type Digest = {
  days: number;
  since: Date;
  until: Date;
  entryCount: number;
  /** Initiatives with at least one entry in the window, most recently active first. */
  groups: DigestGroup[];
  completed: InitiativeWithActivity[];
  created: InitiativeWithActivity[];
  /** Active initiatives with no entry in the window. */
  quiet: InitiativeWithActivity[];
};

/** Everything that happened in the last `days` days, shaped for a status update. */
export async function getDigest(days = 7, now = new Date()): Promise<Digest> {
  const db = getDb();
  const since = new Date(now.getTime() - days * 86_400_000);

  const rows = await db
    .select({ entry: logEntries, initiative: initiatives })
    .from(logEntries)
    .innerJoin(initiatives, eq(initiatives.id, logEntries.initiativeId))
    .where(gte(logEntries.createdAt, since))
    .orderBy(asc(logEntries.createdAt));

  const byId = new Map<string, DigestGroup>();
  for (const r of rows) {
    const g = byId.get(r.initiative.id) ?? { initiative: r.initiative, entries: [] };
    g.entries.push(r.entry);
    byId.set(r.initiative.id, g);
  }
  const groups = [...byId.values()].sort(
    (a, b) => b.entries[b.entries.length - 1].createdAt.getTime() - a.entries[a.entries.length - 1].createdAt.getTime(),
  );

  const all = await listInitiatives({ includeArchived: true });
  const active = new Set<Initiative["status"]>(["in_progress", "blocked", "waiting"]);
  return {
    days,
    since,
    until: now,
    entryCount: rows.length,
    groups,
    completed: all.filter((i) => i.status === "done" && i.lastActivityAt >= since),
    created: all.filter((i) => i.createdAt >= since),
    quiet: all.filter((i) => active.has(i.status) && i.lastActivityAt < since),
  };
}

// ── Activity streak ─────────────────────────────────────────────────────────

export type Streak = {
  /** Consecutive days with at least one entry, counting back from today (or yesterday if today is empty). */
  days: number;
  loggedToday: boolean;
  /** Entries in the last 7 days. */
  thisWeek: number;
  lastEntryAt: Date | null;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Pure helper so the streak rule is testable without a database. */
export function computeStreak(entryDates: Date[], now = new Date()): Streak {
  const days = new Set(entryDates.map(dayKey));
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const thisWeek = entryDates.filter((d) => d.getTime() >= weekAgo).length;
  const lastEntryAt = entryDates.reduce<Date | null>((m, d) => (!m || d > m ? d : m), null);
  const loggedToday = days.has(dayKey(now));
  // Start from today if logged, otherwise from yesterday (today isn't over yet).
  const cursor = new Date(now);
  if (!loggedToday) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return { days: streak, loggedToday, thisWeek, lastEntryAt };
}

export async function getStreak(now = new Date()): Promise<Streak> {
  const db = getDb();
  const since = new Date(now.getTime() - 120 * 86_400_000);
  const rows = await db
    .select({ createdAt: logEntries.createdAt })
    .from(logEntries)
    .where(gte(logEntries.createdAt, since));
  return computeStreak(rows.map((r) => r.createdAt), now);
}
