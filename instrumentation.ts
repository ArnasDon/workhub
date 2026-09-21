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

/**
 * Called by Next.js for every uncaught server error. Drizzle wraps database
 * errors, and Next only prints the wrapper, so log the root cause too.
 */
export function onRequestError(err: unknown, request: { path: string }) {
  let cur = err as { cause?: unknown; code?: string; message?: string };
  for (let i = 0; i < 5 && cur?.cause; i++) cur = cur.cause as typeof cur;
  if (cur !== err) {
    console.error(`[workhub] root cause for ${request.path}:`, cur.code ?? "", cur.message ?? cur);
  }
}
