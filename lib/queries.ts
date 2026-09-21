import { and, asc, count, desc, eq, ilike, max, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { initiatives, logEntries, type Initiative, type LogEntry } from "@/db/schema";
import type { Sort } from "@/lib/constants";
import { PRIORITY_RANK } from "@/lib/constants";

export type InitiativeWithActivity = Initiative & {
  /** max(updated_at, latest log entry) */
  lastActivityAt: Date;
  entryCount: number;
  latestEntry: { body: string; createdAt: Date } | null;
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
    };
  });

  return sortInitiatives(result, opts.sort ?? "activity");
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
