/**
 * Zero-setup local mode: embedded Postgres (PGlite) + mock Supabase Auth.
 *   npm run dev:local
 * Sign in as ALLOWED_EMAIL (default local@workhub.dev) with any password.
 * Data persists in .pglite-dev/ (gitignored). Delete that folder to reset.
 */
import { spawn } from "node:child_process";

const port = process.env.MOCK_AUTH_PORT ?? "54321";
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon-key",
  DATABASE_URL: "pglite://.pglite-dev",
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL ?? "local@workhub.dev",
  NEXT_PUBLIC_SITE_URL: "http://localhost:4700",
  WORKHUB_SEED: process.env.WORKHUB_SEED ?? "1",
  MOCK_AUTH_PORT: port,
};

const auth = spawn(process.execPath, ["scripts/mock-auth.mjs"], { env, stdio: "inherit" });
const next = spawn("npx", ["next", "dev", "-p", "4700"], { env, stdio: "inherit", shell: process.platform === "win32" });

const stop = () => { auth.kill(); next.kill(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", (code) => { auth.kill(); process.exit(code ?? 0); });
