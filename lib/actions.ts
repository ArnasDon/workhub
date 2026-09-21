"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { initiatives, logEntries, PRIORITIES, STATUSES, type Link } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-email";

export type ActionState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

const linkSchema = z.object({
  label: z.string().trim().max(120),
  url: z.string().trim().url("Link must be a full URL (https://…)"),
});

const initiativeSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
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
    area: formData.get("area") ?? "",
    status: formData.get("status") ?? "idea",
    priority: formData.get("priority") ?? "medium",
    targetDate: formData.get("targetDate") ?? "",
    links: parseLinks(formData.get("links")),
  });
}

export async function createInitiative(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = readInitiativeForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const db = getDb();
  const [row] = await db
    .insert(initiatives)
    .values({ ...parsed.data, links: parsed.data.links })
    .returning({ id: initiatives.id });
  const firstNote = String(formData.get("firstNote") ?? "").trim();
  if (firstNote) {
    await db.insert(logEntries).values({ initiativeId: row.id, body: firstNote });
  }
  revalidatePath("/");
  redirect(`/initiatives/${row.id}`);
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
  await db
    .update(initiatives)
    .set({ ...parsed.data, links: parsed.data.links, updatedAt: new Date() })
    .where(eq(initiatives.id, id));
  if (before.status !== parsed.data.status) {
    await db.insert(logEntries).values({
      initiativeId: id,
      body: `Status: ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[parsed.data.status]}`,
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
});

/** Change status from anywhere; records the transition as a log entry so the trail stays complete. */
export async function setStatus(input: { id: string; status: string; note?: string }): Promise<ActionState> {
  await requireUser();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  const { id, status, note } = parsed.data;
  const db = getDb();
  const [before] = await db.select({ status: initiatives.status }).from(initiatives).where(eq(initiatives.id, id));
  if (!before) return { ok: false, error: "Initiative not found" };
  if (before.status === status && !note) return { ok: true };
  await db.update(initiatives).set({ status, updatedAt: new Date() }).where(eq(initiatives.id, id));
  const transition =
    before.status === status ? "" : `Status: ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[status]}`;
  const body = [transition, note].filter(Boolean).join("\n");
  if (body) await db.insert(logEntries).values({ initiativeId: id, body });
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
});

export async function addLogEntry(input: { initiativeId: string; body: string }): Promise<ActionState> {
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

/** Email + password sign-in. Sessions persist in cookies and are refreshed by the proxy, so you stay signed in. */
export async function signInWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
