import { and, asc, count, desc, eq, gte, ilike, inArray, max, ne, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { initiativeRelations, initiatives, logEntries, tasks, templates, type Initiative, type LogEntry, type RelationKind, type Task } from "@/db/schema";
import { rootCause } from "@/lib/db-error";
import { daysUntil, staleState } from "@/lib/format";
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

/** Subquery of initiative ids owned by `ownerId`; used to scope child tables. */
function ownedIds(ownerId: string) {
  return getDb().select({ id: initiatives.id }).from(initiatives).where(eq(initiatives.ownerId, ownerId));
}

export type ListOptions = {
  includeArchived?: boolean;
  area?: string;
  sort?: Sort;
};

export async function listInitiatives(ownerId: string, opts: ListOptions = {}): Promise<InitiativeWithActivity[]> {
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
    eq(initiatives.ownerId, ownerId),
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
    .where(inArray(logEntries.initiativeId, ownedIds(ownerId)))
    .orderBy(logEntries.initiativeId, desc(logEntries.createdAt));
  const latestById = new Map(latest.map((l) => [l.initiativeId, l]));
  const [blockers, progress] = await Promise.all([openBlockerCounts(ownerId), taskProgress(ownerId)]);

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

async function taskProgress(ownerId: string): Promise<Map<string, { total: number; done: number }>> {
  const db = getDb();
  return tolerateMissingTasks(async () => {
    const rows = await db
      .select({
        initiativeId: tasks.initiativeId,
        total: count(),
        done: sql<number>`count(*) filter (where ${tasks.done})`,
      })
      .from(tasks)
      .where(inArray(tasks.initiativeId, ownedIds(ownerId)))
      .groupBy(tasks.initiativeId);
    return new Map(rows.map((r) => [r.initiativeId, { total: Number(r.total), done: Number(r.done) }]));
  }, new Map());
}

// ── Tasks ────────────────────────────────────────────────────────────────────

/** Open tasks in position order, then completed ones most recent first. */
export async function listTasks(ownerId: string, initiativeId: string): Promise<Task[]> {
  const db = getDb();
  return tolerateMissingTasks(async () => {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.initiativeId, initiativeId), inArray(tasks.initiativeId, ownedIds(ownerId))));
    return rows.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0);
      return a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime();
    });
  }, []);
}

async function openBlockerCounts(ownerId: string): Promise<Map<string, number>> {
  const db = getDb();
  return tolerateMissingRelations(async () => {
    const blocker = alias(initiatives, "blocker");
    const rows = await db
      .select({ fromId: initiativeRelations.fromId, n: count() })
      .from(initiativeRelations)
      .innerJoin(blocker, eq(blocker.id, initiativeRelations.toId))
      .where(and(eq(blocker.ownerId, ownerId), eq(initiativeRelations.kind, "blocked_by"), notInArray(blocker.status, ["done", "archived"])))
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
export async function listRelations(ownerId: string, id: string): Promise<RelationView[]> {
  const db = getDb();
  return tolerateMissingRelations(async () => {
    const other = alias(initiatives, "other");
    const outgoing = await db
      .select({ id: initiativeRelations.id, kind: initiativeRelations.kind, otherId: other.id, title: other.title, status: other.status, area: other.area })
      .from(initiativeRelations)
      .innerJoin(other, eq(other.id, initiativeRelations.toId))
      .where(and(eq(initiativeRelations.fromId, id), eq(other.ownerId, ownerId)));
    const incoming = await db
      .select({ id: initiativeRelations.id, kind: initiativeRelations.kind, otherId: other.id, title: other.title, status: other.status, area: other.area })
      .from(initiativeRelations)
      .innerJoin(other, eq(other.id, initiativeRelations.fromId))
      .where(and(eq(initiativeRelations.toId, id), eq(other.ownerId, ownerId)));
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

export async function getInitiative(ownerId: string, id: string): Promise<Initiative | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(initiatives)
    .where(and(eq(initiatives.id, id), eq(initiatives.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function listEntries(ownerId: string, initiativeId: string): Promise<LogEntry[]> {
  const db = getDb();
  return db
    .select()
    .from(logEntries)
    .where(and(eq(logEntries.initiativeId, initiativeId), inArray(logEntries.initiativeId, ownedIds(ownerId))))
    .orderBy(desc(logEntries.createdAt));
}

export async function listAreas(ownerId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ area: initiatives.area })
    .from(initiatives)
    .where(and(eq(initiatives.ownerId, ownerId), ne(initiatives.area, "")))
    .orderBy(asc(initiatives.area));
  return rows.map((r) => r.area);
}

/** Minimal list for the command palette. */
export async function listInitiativeOptions(ownerId: string) {
  const db = getDb();
  return db
    .select({
      id: initiatives.id,
      title: initiatives.title,
      area: initiatives.area,
      status: initiatives.status,
    })
    .from(initiatives)
    .where(and(eq(initiatives.ownerId, ownerId), ne(initiatives.status, "archived")))
    .orderBy(desc(initiatives.pinned), desc(initiatives.updatedAt));
}

export type SearchResult = {
  initiatives: InitiativeWithActivity[];
  entries: (LogEntry & { initiativeTitle: string; initiativeStatus: Initiative["status"] })[];
  tasks: (Task & { initiativeTitle: string; initiativeStatus: Initiative["status"] })[];
};

/**
 * Full-text search (websearch syntax: quotes, -exclusions, OR) with an ilike
 * fallback so partial words still hit. Covers initiative titles, areas and
 * descriptions, log entries, and to-do items.
 */
export async function search(ownerId: string, q: string): Promise<SearchResult> {
  const db = getDb();
  const term = q.trim();
  if (!term) return { initiatives: [], entries: [], tasks: [] };
  const like = `%${term.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const tsq = sql`websearch_to_tsquery('english', ${term})`;

  const matchedInitiatives = await db
    .select({ id: initiatives.id })
    .from(initiatives)
    .where(
      and(
        eq(initiatives.ownerId, ownerId),
        or(
          sql`to_tsvector('english', ${initiatives.title} || ' ' || ${initiatives.area} || ' ' || ${initiatives.description}) @@ ${tsq}`,
          ilike(initiatives.title, like),
          ilike(initiatives.area, like),
          ilike(initiatives.description, like),
        ),
      ),
    );
  const ids = new Set(matchedInitiatives.map((r) => r.id));

  const all = await listInitiatives(ownerId, { includeArchived: true });
  const hits = all.filter((i) => ids.has(i.id));

  const entries = await db
    .select({
      id: logEntries.id,
      initiativeId: logEntries.initiativeId,
      kind: logEntries.kind,
      body: logEntries.body,
      createdAt: logEntries.createdAt,
      initiativeTitle: initiatives.title,
      initiativeStatus: initiatives.status,
    })
    .from(logEntries)
    .innerJoin(initiatives, eq(initiatives.id, logEntries.initiativeId))
    .where(
      and(
        eq(initiatives.ownerId, ownerId),
        or(sql`to_tsvector('english', ${logEntries.body}) @@ ${tsq}`, ilike(logEntries.body, like)),
      ),
    )
    .orderBy(desc(logEntries.createdAt))
    .limit(100);

  const taskHits = await tolerateMissingTasks(
    () =>
      db
        .select({
          id: tasks.id,
          initiativeId: tasks.initiativeId,
          title: tasks.title,
          done: tasks.done,
          doneAt: tasks.doneAt,
          position: tasks.position,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          initiativeTitle: initiatives.title,
          initiativeStatus: initiatives.status,
        })
        .from(tasks)
        .innerJoin(initiatives, eq(initiatives.id, tasks.initiativeId))
        .where(and(eq(initiatives.ownerId, ownerId), or(sql`to_tsvector('english', ${tasks.title}) @@ ${tsq}`, ilike(tasks.title, like))))
        .orderBy(asc(tasks.done), desc(tasks.updatedAt))
        .limit(100),
    [],
  );

  return { initiatives: hits, entries, tasks: taskHits };
}

export async function exportAll(ownerId: string) {
  const db = getDb();
  const mine = ownedIds(ownerId);
  const [inits, entries, taskRows, relationRows, templateRows] = await Promise.all([
    db.select().from(initiatives).where(eq(initiatives.ownerId, ownerId)).orderBy(asc(initiatives.createdAt)),
    db.select().from(logEntries).where(inArray(logEntries.initiativeId, mine)).orderBy(asc(logEntries.createdAt)),
    tolerateMissingTasks(() => db.select().from(tasks).where(inArray(tasks.initiativeId, mine)).orderBy(asc(tasks.createdAt)), []),
    tolerateMissingRelations(() => db.select().from(initiativeRelations).where(inArray(initiativeRelations.fromId, mine)).orderBy(asc(initiativeRelations.createdAt)), []),
    tolerateMissingTable("0009_templates.sql", () => db.select().from(templates).where(eq(templates.ownerId, ownerId)).orderBy(asc(templates.createdAt)), []),
  ]);
  return {
    format: "workhub-export" as const,
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    initiatives: inits,
    logEntries: entries,
    tasks: taskRows,
    relations: relationRows,
    templates: templateRows,
  };
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
  /** Everything currently in "waiting", longest wait first. */
  waiting: InitiativeWithActivity[];
};

/** Everything that happened in the last `days` days, shaped for a status update. */
export async function getDigest(ownerId: string, days = 7, now = new Date()): Promise<Digest> {
  const db = getDb();
  const since = new Date(now.getTime() - days * 86_400_000);

  const rows = await db
    .select({ entry: logEntries, initiative: initiatives })
    .from(logEntries)
    .innerJoin(initiatives, eq(initiatives.id, logEntries.initiativeId))
    .where(and(eq(initiatives.ownerId, ownerId), gte(logEntries.createdAt, since)))
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

  const all = await listInitiatives(ownerId, { includeArchived: true });
  const active = new Set<Initiative["status"]>(["in_progress", "blocked", "waiting"]);
  return {
    days,
    since,
    until: now,
    entryCount: rows.length,
    groups,
    completed: all.filter((i) => i.status === "done" && i.lastActivityAt >= since),
    created: all.filter((i) => i.createdAt >= since),
    // Quiet = past its own cadence (default 7d) with no entry in the window, and not snoozed.
    quiet: all.filter((i) => active.has(i.status) && i.lastActivityAt < since && staleState(i, now).stale),
    waiting: all
      .filter((i) => i.status === "waiting")
      .sort((x, y) => (x.waitingSince?.getTime() ?? 0) - (y.waitingSince?.getTime() ?? 0)),
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

export async function getStreak(ownerId: string, now = new Date()): Promise<Streak> {
  const db = getDb();
  const since = new Date(now.getTime() - 120 * 86_400_000);
  const rows = await db
    .select({ createdAt: logEntries.createdAt })
    .from(logEntries)
    .where(and(gte(logEntries.createdAt, since), inArray(logEntries.initiativeId, ownedIds(ownerId))));
  return computeStreak(rows.map((r) => r.createdAt), now);
}

// ── Decisions ───────────────────────────────────────────────────────────────

export type DecisionEntry = LogEntry & { initiativeTitle: string; initiativeStatus: Initiative["status"]; initiativeArea: string };

/** Every entry marked as a decision, newest first. */
export async function listDecisions(ownerId: string, limit = 200): Promise<DecisionEntry[]> {
  const db = getDb();
  return db
    .select({
      id: logEntries.id,
      initiativeId: logEntries.initiativeId,
      kind: logEntries.kind,
      body: logEntries.body,
      createdAt: logEntries.createdAt,
      initiativeTitle: initiatives.title,
      initiativeStatus: initiatives.status,
      initiativeArea: initiatives.area,
    })
    .from(logEntries)
    .innerJoin(initiatives, eq(initiatives.id, logEntries.initiativeId))
    .where(and(eq(initiatives.ownerId, ownerId), eq(logEntries.kind, "decision")))
    .orderBy(desc(logEntries.createdAt))
    .limit(limit);
}

// ── Today ───────────────────────────────────────────────────────────────────

export type AttentionItem = {
  initiative: InitiativeWithActivity;
  /** Human reasons, worst first: overdue, blocked, stale. */
  reasons: { kind: "overdue" | "blocked" | "stale"; text: string }[];
};

export type TodayView = {
  now: Date;
  /** One row per initiative that is overdue, blocked and/or stale. */
  attention: AttentionItem[];
  overdue: InitiativeWithActivity[];
  dueSoon: InitiativeWithActivity[];
  stale: (InitiativeWithActivity & { idleDays: number; threshold: number })[];
  waiting: InitiativeWithActivity[];
  blocked: InitiativeWithActivity[];
  focus: { initiative: InitiativeWithActivity; tasks: Task[] }[];
  loggedToday: (LogEntry & { initiativeTitle: string })[];
  streak: Streak;
};

/** The one screen to open in the morning: what needs a nudge, who to chase, what's due, and what's on the pinned list. */
export async function getToday(ownerId: string, now = new Date()): Promise<TodayView> {
  const db = getDb();
  const all = await listInitiatives(ownerId, { includeArchived: false });
  const active = all.filter((i) => i.status !== "done");

  const overdue = active.filter((i) => i.targetDate && daysUntil(i.targetDate, now) < 0);
  const dueSoon = active
    .filter((i) => i.targetDate && daysUntil(i.targetDate, now) >= 0 && daysUntil(i.targetDate, now) <= 7)
    .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!));
  const stale = active
    .map((i) => ({ ...i, ...staleState(i, now) }))
    .filter((i) => i.stale)
    .sort((a, b) => b.idleDays - a.idleDays)
    .map(({ idleDays, threshold, ...rest }) => ({ ...(rest as InitiativeWithActivity), idleDays, threshold }));
  const waiting = active
    .filter((i) => i.status === "waiting")
    .sort((a, b) => (a.waitingSince?.getTime() ?? 0) - (b.waitingSince?.getTime() ?? 0));
  const blocked = active.filter((i) => i.status === "blocked" || i.openBlockers > 0);

  const pinned = active.filter((i) => i.pinned).slice(0, 6);
  const focus = await Promise.all(
    pinned.map(async (initiative) => ({ initiative, tasks: (await listTasks(ownerId, initiative.id)).filter((t) => !t.done).slice(0, 4) })),
  );

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const loggedToday = await db
    .select({
      id: logEntries.id,
      initiativeId: logEntries.initiativeId,
      kind: logEntries.kind,
      body: logEntries.body,
      createdAt: logEntries.createdAt,
      initiativeTitle: initiatives.title,
    })
    .from(logEntries)
    .innerJoin(initiatives, eq(initiatives.id, logEntries.initiativeId))
    .where(and(eq(initiatives.ownerId, ownerId), gte(logEntries.createdAt, startOfDay)))
    .orderBy(desc(logEntries.createdAt));

  const attentionById = new Map<string, AttentionItem>();
  const add = (i: InitiativeWithActivity, reason: AttentionItem["reasons"][number]) => {
    const item = attentionById.get(i.id) ?? { initiative: i, reasons: [] };
    item.reasons.push(reason);
    attentionById.set(i.id, item);
  };
  for (const i of overdue) add(i, { kind: "overdue", text: `${-daysUntil(i.targetDate!, now)} ${-daysUntil(i.targetDate!, now) === 1 ? "day" : "days"} overdue` });
  for (const i of blocked) add(i, { kind: "blocked", text: i.openBlockers > 0 ? `Blocked by ${i.openBlockers}` : "Blocked" });
  for (const i of stale) add(i, { kind: "stale", text: `No update in ${i.idleDays}d (expects every ${i.threshold}d)` });
  const rank = { overdue: 0, blocked: 1, stale: 2 };
  const attention = [...attentionById.values()].sort(
    (x, y) => rank[x.reasons[0].kind] - rank[y.reasons[0].kind] || y.reasons.length - x.reasons.length,
  );

  return { now, attention, overdue, dueSoon, stale, waiting, blocked, focus, loggedToday, streak: await getStreak(ownerId, now) };
}

// ── Area rollups ────────────────────────────────────────────────────────────

export type AreaRollup = {
  area: string;
  initiatives: InitiativeWithActivity[];
  byStatus: Record<Initiative["status"], number>;
  taskDone: number;
  taskTotal: number;
  stale: number;
  waiting: number;
  overdue: number;
  lastActivityAt: Date | null;
};

/** One row per area (plus "No area"): status mix, to-do completion, stale/waiting/overdue counts, last activity. */
export async function getAreaRollups(ownerId: string, now = new Date()): Promise<AreaRollup[]> {
  const all = await listInitiatives(ownerId, { includeArchived: false });
  const groups = new Map<string, InitiativeWithActivity[]>();
  for (const i of all) groups.set(i.area, [...(groups.get(i.area) ?? []), i]);
  const empty = (): Record<Initiative["status"], number> => ({ idea: 0, in_progress: 0, blocked: 0, waiting: 0, done: 0, archived: 0 });
  return [...groups.entries()]
    .map(([area, list]) => {
      const byStatus = empty();
      for (const i of list) byStatus[i.status] += 1;
      return {
        area,
        initiatives: list,
        byStatus,
        taskDone: list.reduce((n, i) => n + i.taskDone, 0),
        taskTotal: list.reduce((n, i) => n + i.taskTotal, 0),
        stale: list.filter((i) => staleState(i, now).stale).length,
        waiting: list.filter((i) => i.status === "waiting").length,
        overdue: list.filter((i) => i.status !== "done" && i.targetDate && daysUntil(i.targetDate, now) < 0).length,
        lastActivityAt: list.reduce<Date | null>((m, i) => (!m || i.lastActivityAt > m ? i.lastActivityAt : m), null),
      };
    })
    .sort((a, b) => (a.area === "" ? 1 : b.area === "" ? -1 : b.initiatives.length - a.initiatives.length || a.area.localeCompare(b.area)));
}
