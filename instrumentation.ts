/**
 * Runs once when the Next.js server starts. In local dev mode
 * (DATABASE_URL=pglite://…) it boots an embedded WASM Postgres, applies the
 * migrations, and hands the Drizzle instance to getDb() via globalThis.
 * Production never enters this branch.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL?.startsWith("pglite://")) return;
  const { bootPglite } = await import("./db/pglite");
  await bootPglite(process.env.DATABASE_URL, process.env.WORKHUB_SEED === "1");
}
