import { asc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { tasks, templates, type Template } from "@/db/schema";
import { rootCause } from "@/lib/db-error";

async function tolerate<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (rootCause(err).code === "42P01") {
      console.warn("[workhub] templates table is missing; apply drizzle/0009_templates.sql");
      return fallback;
    }
    throw err;
  }
}

export async function listTemplates(): Promise<Template[]> {
  const db = getDb();
  return tolerate(() => db.select().from(templates).orderBy(asc(templates.name)), []);
}

export async function getTemplate(id: string): Promise<Template | null> {
  const db = getDb();
  return tolerate(async () => {
    const [row] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
    return row ?? null;
  }, null);
}

/** Copy a template's to-do titles onto a freshly created initiative. */
export async function applyTemplateTasks(db: Db, template: Pick<Template, "tasks">, initiativeId: string) {
  const titles = template.tasks.map((t) => t.trim()).filter(Boolean);
  if (titles.length === 0) return 0;
  await db.insert(tasks).values(titles.map((title, position) => ({ initiativeId, title, position })));
  return titles.length;
}

/** "one per line" textarea → clean list. */
export function parseLines(raw: FormDataEntryValue | null, max = 50): string[] {
  return String(raw ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}
