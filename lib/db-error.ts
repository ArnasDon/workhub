/**
 * Turn an opaque "Failed query" into something a human can act on.
 * Never includes the connection string or any secret.
 */
export type DbProblem = {
  kind: "missing_tables" | "unreachable" | "auth" | "no_database" | "unknown";
  title: string;
  detail: string;
  fix: string;
  code?: string;
};

type PgLike = { code?: string; message?: string; errno?: string | number; cause?: unknown };

export function rootCause(err: unknown): PgLike {
  let cur = err as PgLike;
  for (let i = 0; i < 5 && cur && typeof cur === "object" && cur.cause; i++) cur = cur.cause as PgLike;
  return cur ?? {};
}

export function classifyDbError(err: unknown): DbProblem {
  const cause = rootCause(err);
  const code = String(cause.code ?? cause.errno ?? "");
  const msg = String(cause.message ?? (err as Error)?.message ?? "");

  if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return {
      kind: "missing_tables",
      code,
      title: "The database has no tables yet",
      detail: "The connection works, but the schema has not been created.",
      fix: "Run the SQL in drizzle/0000_init.sql and then drizzle/0001_rls_and_search.sql in the Supabase SQL editor (or `npm run db:migrate` locally), then reload.",
    };
  }
  if (/ENETUNREACH|EHOSTUNREACH|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|CONNECT_TIMEOUT|CONNECTION_CLOSED|ECONNRESET/i.test(code + " " + msg)) {
    return {
      kind: "unreachable",
      code,
      title: "Cannot reach the database host",
      detail: `Network error while connecting (${code || msg.slice(0, 80)}).`,
      fix: "Use the Supabase Transaction pooler connection string (…pooler.supabase.com:6543). The direct db.<ref>.supabase.co host is IPv6-only and most shared hosts cannot reach it.",
    };
  }
  if (code === "28P01" || code === "28000" || /password authentication failed|SASL/i.test(msg)) {
    return {
      kind: "auth",
      code,
      title: "Database rejected the credentials",
      detail: "The host was reached, but the user or password in DATABASE_URL is wrong.",
      fix: "Reset the database password in Supabase (Project Settings → Database) and paste the new pooler string, URL-encoding any special characters.",
    };
  }
  if (code === "3D000") {
    return {
      kind: "no_database",
      code,
      title: "Database name not found",
      detail: "The connection string points at a database that does not exist.",
      fix: "The Supabase database is named `postgres`; make sure DATABASE_URL ends with /postgres.",
    };
  }
  return {
    kind: "unknown",
    code,
    title: "Database query failed",
    detail: msg.slice(0, 200) || "No further detail was available.",
    fix: "Check DATABASE_URL and the server runtime logs (the root cause is logged there).",
  };
}
