import { z } from "zod";
import type { Db } from "@/db";
import { initiativeRelations, initiatives, logEntries, tasks, templates, ENTRY_KINDS, PRIORITIES, RELATION_KINDS, STATUSES } from "@/db/schema";

/**
 * Restore from a WorkHub JSON export (v1 exports lack kinds/descriptions/tasks;
 * v2 has everything). Rows keep their ids; anything whose id already exists is
 * skipped, so importing the same file twice is harmless and importing into a
 * populated database merges.
 */

const date = z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v)));
const link = z.object({ label: z.string().default(""), url: z.string() });

const initiativeRow = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().default(""),
  area: z.string().default(""),
  status: z.enum(STATUSES).default("idea"),
  priority: z.enum(PRIORITIES).default("medium"),
  targetDate: z.string().nullable().default(null),
  links: z.array(link).default([]),
  pinned: z.boolean().default(false),
  waitingOn: z.string().default(""),
  waitingSince: date.nullable().default(null),
  snoozedUntil: z.string().nullable().default(null),
  checkInDays: z.number().int().nullable().default(null),
  createdAt: date,
  updatedAt: date,
});
const entryRow = z.object({
  id: z.string().uuid(),
  initiativeId: z.string().uuid(),
  kind: z.enum(ENTRY_KINDS).default("update"),
  body: z.string(),
  createdAt: date,
});
const taskRow = z.object({
  id: z.string().uuid(),
  initiativeId: z.string().uuid(),
  title: z.string().min(1),
  done: z.boolean().default(false),
  doneAt: date.nullable().default(null),
  position: z.number().int().default(0),
  createdAt: date,
  updatedAt: date,
});
const relationRow = z.object({
  id: z.string().uuid(),
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  kind: z.enum(RELATION_KINDS).default("blocked_by"),
  createdAt: date,
});
const templateRow = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(""),
  area: z.string().default(""),
  status: z.enum(STATUSES).default("idea"),
  priority: z.enum(PRIORITIES).default("medium"),
  checkInDays: z.number().int().nullable().default(null),
  tasks: z.array(z.string()).default([]),
  links: z.array(link).default([]),
  createdAt: date,
  updatedAt: date,
});

export const backupSchema = z.object({
  exportedAt: z.string().optional(),
  initiatives: z.array(initiativeRow),
  logEntries: z.array(entryRow).default([]),
  tasks: z.array(taskRow).default([]),
  relations: z.array(relationRow).default([]),
  templates: z.array(templateRow).default([]),
});

export type Backup = z.infer<typeof backupSchema>;

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Not a WorkHub export: ${issue.path.join(".") || "root"} ${issue.message}` };
  }
  return { ok: true, backup: parsed.data };
}

export type ImportReport = Record<"initiatives" | "logEntries" | "tasks" | "relations" | "templates", { inserted: number; skipped: number }>;

/** Insert everything, skipping ids that already exist. Children whose parent is missing are skipped too. */
export async function applyBackup(db: Db, b: Backup): Promise<ImportReport> {
  const report: ImportReport = {
    initiatives: { inserted: 0, skipped: 0 },
    logEntries: { inserted: 0, skipped: 0 },
    tasks: { inserted: 0, skipped: 0 },
    relations: { inserted: 0, skipped: 0 },
    templates: { inserted: 0, skipped: 0 },
  };
  const chunk = <T,>(rows: T[], n = 200) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n));

  for (const rows of chunk(b.initiatives)) {
    const r = await db.insert(initiatives).values(rows).onConflictDoNothing().returning({ id: initiatives.id });
    report.initiatives.inserted += r.length;
    report.initiatives.skipped += rows.length - r.length;
  }
  const known = new Set((await db.select({ id: initiatives.id }).from(initiatives)).map((x) => x.id));

  const entries = b.logEntries.filter((e) => known.has(e.initiativeId));
  report.logEntries.skipped += b.logEntries.length - entries.length;
  for (const rows of chunk(entries)) {
    const r = await db.insert(logEntries).values(rows).onConflictDoNothing().returning({ id: logEntries.id });
    report.logEntries.inserted += r.length;
    report.logEntries.skipped += rows.length - r.length;
  }

  const taskRows = b.tasks.filter((t) => known.has(t.initiativeId));
  report.tasks.skipped += b.tasks.length - taskRows.length;
  for (const rows of chunk(taskRows)) {
    const r = await db.insert(tasks).values(rows).onConflictDoNothing().returning({ id: tasks.id });
    report.tasks.inserted += r.length;
    report.tasks.skipped += rows.length - r.length;
  }

  const rels = b.relations.filter((x) => known.has(x.fromId) && known.has(x.toId) && x.fromId !== x.toId);
  report.relations.skipped += b.relations.length - rels.length;
  for (const rows of chunk(rels)) {
    const r = await db.insert(initiativeRelations).values(rows).onConflictDoNothing().returning({ id: initiativeRelations.id });
    report.relations.inserted += r.length;
    report.relations.skipped += rows.length - r.length;
  }

  for (const rows of chunk(b.templates)) {
    const r = await db.insert(templates).values(rows).onConflictDoNothing().returning({ id: templates.id });
    report.templates.inserted += r.length;
    report.templates.skipped += rows.length - r.length;
  }
  return report;
}
