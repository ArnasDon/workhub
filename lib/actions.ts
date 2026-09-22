"use server";

import { eq, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { initiativeRelations, initiatives, logEntries, tasks, templates, PRIORITIES, RELATION_KINDS, STATUSES, USER_ENTRY_KINDS, type Link } from "@/db/schema";
import { applyTemplateTasks, getTemplate, parseLines } from "@/lib/templates";
import { applyBackup, parseBackup, type ImportReport } from "@/lib/import";
import { STATUS_LABEL } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-email";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export type ActionState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

const linkSchema = z.object({
  label: z.string().trim().max(120),
  url: z
    .string()
    .trim()
    .url("Link must be a full URL (https://…)")
    .refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed"),
});

const initiativeSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  description: z.string().trim().max(20000, "Keep the description under 20,000 characters").default(""),
  area: z.string().trim().max(60).default(""),
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
  targetDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  links: z.array(linkSchema).max(20),
  snoozedUntil: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  checkInDays: z
    .string()
    .trim()
    .transform((v) => (v === "" || v === "default" ? null : Number(v)))
    .pipe(z.number().int().min(1).max(365).nullable()),
});

function parseLinks(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as Link[];
    return parsed.filter((l) => l && (l.url?.trim() || l.label?.trim()))
      .map((l) => ({ label: l.label?.trim() || l.url.trim(), url: l.url?.trim() }));
  } catch {
    return [];
  }
}

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function readInitiativeForm(formData: FormData) {
  return initiativeSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    area: formData.get("area") ?? "",
    status: formData.get("status") ?? "idea",
    priority: formData.get("priority") ?? "medium",
    targetDate: formData.get("targetDate") ?? "",
    links: parseLinks(formData.get("links")),
    snoozedUntil: formData.get("snoozedUntil") ?? "",
    checkInDays: formData.get("checkInDays") ?? "",
  });
}

export async function createInitiative(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = readInitiativeForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const db = getDb();
  const creatingWaiting = parsed.data.status === "waiting";
  const [row] = await db
    .insert(initiatives)
    .values({
      ...parsed.data,
      links: parsed.data.links,
      waitingOn: creatingWaiting ? String(formData.get("waitingOn") ?? "").trim().slice(0, 80) : "",
      waitingSince: creatingWaiting ? new Date() : null,
    })
    .returning({ id: initiatives.id });
  const firstNote = String(formData.get("firstNote") ?? "").trim();
  if (firstNote) {
    await db.insert(logEntries).values({ initiativeId: row.id, body: firstNote });
  }
  const templateId = String(formData.get("templateId") ?? "");
  if (z.string().uuid().safeParse(templateId).success) {
    const template = await getTemplate(templateId);
    if (template) {
      const n = await applyTemplateTasks(db, template, row.id);
      await db.insert(logEntries).values({ initiativeId: row.id, kind: "status", body: `Created from template “${template.name}”${n ? ` with ${n} to-dos` : ""}` });
    }
  }
  revalidatePath("/");
  redirect(`/initiatives/${row.id}`);
}

// ── Templates ───────────────────────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().trim().min(1, "Give the template a name").max(120),
  description: z.string().trim().max(20000).default(""),
  area: z.string().trim().max(60).default(""),
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
  checkInDays: z
    .string()
    .trim()
    .transform((v) => (v === "" || v === "default" ? null : Number(v)))
    .pipe(z.number().int().min(1).max(365).nullable()),
  tasks: z.array(z.string().trim().min(1).max(300)).max(50),
  links: z.array(linkSchema).max(20),
});

function readTemplateForm(formData: FormData) {
  return templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    area: formData.get("area") ?? "",
    status: formData.get("status") ?? "idea",
    priority: formData.get("priority") ?? "medium",
    checkInDays: formData.get("checkInDays") ?? "",
    tasks: parseLines(formData.get("tasks")),
    links: parseLinks(formData.get("links")),
  });
}

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = readTemplateForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const db = getDb();
  const [row] = await db.insert(templates).values(parsed.data).returning({ id: templates.id });
  revalidatePath("/templates");
  redirect(`/templates/${row.id}`);
}

export async function updateTemplate(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = readTemplateForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const db = getDb();
  await db.update(templates).set({ ...parsed.data, updatedAt: new Date() }).where(eq(templates.id, id));
  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<never> {
  await requireUser();
  const db = getDb();
  await db.delete(templates).where(eq(templates.id, id));
  revalidatePath("/templates");
  redirect("/templates");
}

/** Snapshot an initiative's shape (not its log) as a reusable template. */
export async function createTemplateFromInitiative(initiativeId: string): Promise<never> {
  await requireUser();
  const db = getDb();
  const [i] = await db.select().from(initiatives).where(eq(initiatives.id, initiativeId));
  if (!i) redirect("/");
  const todo = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.initiativeId, initiativeId)).orderBy(tasks.position);
  const [row] = await db
    .insert(templates)
    .values({
      name: i.title,
      description: i.description,
      area: i.area,
      status: "idea",
      priority: i.priority,
      checkInDays: i.checkInDays,
      tasks: todo.map((t) => t.title),
      links: i.links,
    })
    .returning({ id: templates.id });
  revalidatePath("/templates");
  redirect(`/templates/${row.id}`);
}

export async function updateInitiative(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = readInitiativeForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const db = getDb();
  const [before] = await db.select({ status: initiatives.status }).from(initiatives).where(eq(initiatives.id, id));
  if (!before) return { ok: false, error: "Initiative not found" };
  const waiting = parsed.data.status === "waiting";
  const waitingOn = waiting ? String(formData.get("waitingOn") ?? "").trim().slice(0, 80) : "";
  const [prev] = await db.select({ waitingSince: initiatives.waitingSince }).from(initiatives).where(eq(initiatives.id, id));
  await db
    .update(initiatives)
    .set({
      ...parsed.data,
      links: parsed.data.links,
      waitingOn,
      waitingSince: waiting ? (before.status === "waiting" ? prev?.waitingSince ?? new Date() : new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(initiatives.id, id));
  if (before.status !== parsed.data.status) {
    await db.insert(logEntries).values({
      initiativeId: id,
      kind: "status",
      body: `Status: ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[parsed.data.status]}${waiting && waitingOn ? ` (${waitingOn})` : ""}`,
    });
  }
  revalidatePath("/");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
  note: z.string().trim().max(5000).optional(),
  /** Who we are waiting on; only meaningful with status "waiting". */
  waitingOn: z.string().trim().max(80).optional(),
});

/** Change status from anywhere; records the transition as a log entry so the trail stays complete. */
export async function setStatus(input: { id: string; status: string; note?: string; waitingOn?: string }): Promise<ActionState> {
  await requireUser();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  const { id, status, note, waitingOn } = parsed.data;
  const db = getDb();
  const [before] = await db
    .select({ status: initiatives.status, waitingOn: initiatives.waitingOn, waitingSince: initiatives.waitingSince })
    .from(initiatives)
    .where(eq(initiatives.id, id));
  if (!before) return { ok: false, error: "Initiative not found" };
  if (before.status === status && !note && waitingOn === undefined) return { ok: true };
  const now = new Date();
  const waiting = status === "waiting";
  const nextWaitingOn = waiting ? (waitingOn ?? before.waitingOn) : "";
  const nextWaitingSince = waiting ? (before.status === "waiting" ? before.waitingSince ?? now : now) : null;
  await db
    .update(initiatives)
    .set({ status, waitingOn: nextWaitingOn, waitingSince: nextWaitingSince, updatedAt: now })
    .where(eq(initiatives.id, id));
  const who = waiting && nextWaitingOn ? ` (${nextWaitingOn})` : "";
  const transition =
    before.status === status ? "" : `Status: ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[status]}${who}`;
  const body = [transition, note].filter(Boolean).join("\n");
  if (body) await db.insert(logEntries).values({ initiativeId: id, kind: transition ? "status" : "update", body });
  revalidatePath("/");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true };
}

export async function togglePinned(id: string): Promise<ActionState> {
  await requireUser();
  const db = getDb();
  await db
    .update(initiatives)
    .set({ pinned: sql`not ${initiatives.pinned}` })
    .where(eq(initiatives.id, id));
  revalidatePath("/");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true };
}

/** Hard delete. Only offered in the UI for archived initiatives, behind a confirmation. */
export async function deleteInitiative(id: string): Promise<never> {
  await requireUser();
  const db = getDb();
  await db.delete(initiatives).where(eq(initiatives.id, id));
  revalidatePath("/");
  redirect("/");
}

const entrySchema = z.object({
  initiativeId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first").max(20000),
  kind: z.enum(USER_ENTRY_KINDS).default("update"),
});

export async function addLogEntry(input: { initiativeId: string; body: string; kind?: string }): Promise<ActionState> {
  await requireUser();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry" };
  const db = getDb();
  const [exists] = await db.select({ id: initiatives.id }).from(initiatives).where(eq(initiatives.id, parsed.data.initiativeId));
  if (!exists) return { ok: false, error: "Initiative not found" };
  await db.insert(logEntries).values(parsed.data);
  await db.update(initiatives).set({ updatedAt: new Date() }).where(eq(initiatives.id, parsed.data.initiativeId));
  revalidatePath("/");
  revalidatePath(`/initiatives/${parsed.data.initiativeId}`);
  return { ok: true };
}

// ── Snooze ──────────────────────────────────────────────────────────────────

/** Hide from stale nudges until a date (YYYY-MM-DD), or clear with null. Logged so the trail explains the quiet period. */
export async function setSnooze(input: { id: string; until: string | null }): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({ id: z.string().uuid(), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid snooze date" };
  const db = getDb();
  const [row] = await db
    .update(initiatives)
    .set({ snoozedUntil: parsed.data.until })
    .where(eq(initiatives.id, parsed.data.id))
    .returning({ id: initiatives.id });
  if (!row) return { ok: false, error: "Initiative not found" };
  if (parsed.data.until) {
    await db.insert(logEntries).values({ initiativeId: parsed.data.id, kind: "status", body: `Snoozed until ${parsed.data.until}` });
  }
  revalidatePath("/");
  revalidatePath(`/initiatives/${parsed.data.id}`);
  return { ok: true };
}

// ── Relations ───────────────────────────────────────────────────────────────

const relationSchema = z
  .object({ fromId: z.string().uuid(), toId: z.string().uuid(), kind: z.enum(RELATION_KINDS) })
  .refine((v) => v.fromId !== v.toId, { message: "An initiative cannot relate to itself" });

/** Link two initiatives. Logged on the initiative the link was added from. */
export async function addRelation(input: { fromId: string; toId: string; kind: string }): Promise<ActionState> {
  await requireUser();
  const parsed = relationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid relation" };
  const { fromId, toId, kind } = parsed.data;
  const db = getDb();
  const [target] = await db.select({ title: initiatives.title }).from(initiatives).where(eq(initiatives.id, toId));
  if (!target) return { ok: false, error: "Initiative not found" };
  const inserted = await db
    .insert(initiativeRelations)
    .values({ fromId, toId, kind })
    .onConflictDoNothing()
    .returning({ id: initiativeRelations.id });
  if (inserted.length === 0) return { ok: false, error: "That link already exists" };
  await db.insert(logEntries).values({
    initiativeId: fromId,
    body: kind === "blocked_by" ? `Blocked by “${target.title}”` : `Related to “${target.title}”`,
  });
  await db.update(initiatives).set({ updatedAt: new Date() }).where(eq(initiatives.id, fromId));
  revalidatePath("/");
  revalidatePath(`/initiatives/${fromId}`);
  revalidatePath(`/initiatives/${toId}`);
  return { ok: true };
}

export async function removeRelation(id: string): Promise<ActionState> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid relation" };
  const db = getDb();
  const [rel] = await db.delete(initiativeRelations).where(eq(initiativeRelations.id, id)).returning();
  if (!rel) return { ok: false, error: "Link not found" };
  const [target] = await db.select({ title: initiatives.title }).from(initiatives).where(eq(initiatives.id, rel.toId));
  await db.insert(logEntries).values({
    initiativeId: rel.fromId,
    body: rel.kind === "blocked_by" ? `No longer blocked by “${target?.title ?? "an initiative"}”` : `Unlinked from “${target?.title ?? "an initiative"}”`,
  });
  revalidatePath("/");
  revalidatePath(`/initiatives/${rel.fromId}`);
  revalidatePath(`/initiatives/${rel.toId}`);
  return { ok: true };
}

// ── Tasks ───────────────────────────────────────────────────────────────────

const taskTitle = z.string().trim().min(1, "Write the to-do first").max(300);

export async function addTask(input: { initiativeId: string; title: string }): Promise<ActionState & { id?: string }> {
  await requireUser();
  const parsed = z.object({ initiativeId: z.string().uuid(), title: taskTitle }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid to-do" };
  const db = getDb();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(${max(tasks.position)}, -1) + 1` })
    .from(tasks)
    .where(eq(tasks.initiativeId, parsed.data.initiativeId));
  const [row] = await db
    .insert(tasks)
    .values({ initiativeId: parsed.data.initiativeId, title: parsed.data.title, position: Number(next) })
    .returning({ id: tasks.id });
  revalidatePath("/");
  revalidatePath(`/initiatives/${parsed.data.initiativeId}`);
  return { ok: true, id: row.id };
}

export async function updateTask(input: { id: string; title: string }): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ id: z.string().uuid(), title: taskTitle }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid to-do" };
  const db = getDb();
  const [row] = await db
    .update(tasks)
    .set({ title: parsed.data.title, updatedAt: new Date() })
    .where(eq(tasks.id, parsed.data.id))
    .returning({ initiativeId: tasks.initiativeId });
  if (!row) return { ok: false, error: "To-do not found" };
  revalidatePath(`/initiatives/${row.initiativeId}`);
  return { ok: true };
}

/** Check or uncheck. Completing a to-do is logged; unchecking is not. */
export async function toggleTask(input: { id: string; done: boolean }): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ id: z.string().uuid(), done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid to-do" };
  const db = getDb();
  const [row] = await db
    .update(tasks)
    .set({ done: parsed.data.done, doneAt: parsed.data.done ? new Date() : null, updatedAt: new Date() })
    .where(eq(tasks.id, parsed.data.id))
    .returning({ initiativeId: tasks.initiativeId, title: tasks.title });
  if (!row) return { ok: false, error: "To-do not found" };
  if (parsed.data.done) {
    await db.insert(logEntries).values({ initiativeId: row.initiativeId, kind: "task", body: `Done: ${row.title}` });
    await db.update(initiatives).set({ updatedAt: new Date() }).where(eq(initiatives.id, row.initiativeId));
  }
  revalidatePath("/");
  revalidatePath(`/initiatives/${row.initiativeId}`);
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionState> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid to-do" };
  const db = getDb();
  const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning({ initiativeId: tasks.initiativeId });
  if (!row) return { ok: false, error: "To-do not found" };
  revalidatePath("/");
  revalidatePath(`/initiatives/${row.initiativeId}`);
  return { ok: true };
}

// ── Import ──────────────────────────────────────────────────────────────────

export type ImportState = ActionState & { report?: ImportReport; summary?: { initiatives: number; logEntries: number; tasks: number; relations: number; templates: number } };

/** Restore a JSON export. Existing ids are skipped, so this merges rather than overwrites. */
export async function importBackup(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose the JSON file exported from WorkHub." };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: "That file is larger than 25 MB." };
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const b = parsed.backup;
  const summary = { initiatives: b.initiatives.length, logEntries: b.logEntries.length, tasks: b.tasks.length, relations: b.relations.length, templates: b.templates.length };
  if (formData.get("mode") === "preview") return { ok: true, summary };
  const report = await applyBackup(getDb(), b);
  revalidatePath("/");
  return { ok: true, report, summary };
}

// ── Auth ────────────────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

async function limited(bucket: string, limit: number, windowMs: number): Promise<string | null> {
  const res = rateLimit(clientKey(await headers(), bucket), limit, windowMs);
  return res.ok ? null : `Too many attempts. Try again in ${Math.max(1, Math.ceil(res.retryAfterSec / 60))} min.`;
}

/** Email + password sign-in. Sessions persist in cookies and are refreshed by the proxy, so you stay signed in. */
export async function signInWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const wait = await limited("signin", 10, 15 * 60_000);
  if (wait) return { ok: false, error: wait };
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  if (!isAllowedEmail(parsed.data.email)) return { ok: false, error: "That address is not allowed to sign in to this WorkHub." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: /confirm/i.test(error.message) ? "Confirm your email first (check your inbox), then sign in." : "Wrong email or password." };
  }
  redirect("/");
}

/** One-time registration for the allowed address. Refuses everyone else before touching Supabase. */
export async function signUpWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const wait = await limited("signup", 5, 60 * 60_000);
  if (wait) return { ok: false, error: wait };
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  if (String(formData.get("confirm") ?? "") !== parsed.data.password) return { ok: false, error: "Passwords don't match." };
  if (!isAllowedEmail(parsed.data.email)) return { ok: false, error: "Only the configured address can create an account here." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  // With email confirmation enabled Supabase returns a user with no identities for an existing address.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, error: "An account already exists for this address. Sign in instead, or reset the password." };
  }
  if (data.session) redirect("/");
  return { ok: true, error: "Account created. Confirm the email we just sent, then sign in." };
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const wait = await limited("reset", 5, 60 * 60_000);
  if (wait) return { ok: false, error: wait };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { ok: false, error: "Enter a valid email" };
  // Same message for allowed and unknown addresses: no account enumeration.
  if (isAllowedEmail(email)) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteOrigin()}/auth/callback?next=/account/password` });
  }
  return { ok: true };
}

const newPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] });

/** Set a new password for the signed-in user (after a reset link, or from the account page). */
export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
