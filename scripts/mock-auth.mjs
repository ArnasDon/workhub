/**
 * Minimal stand-in for Supabase Auth (GoTrue) so the whole app runs locally
 * without a Supabase project. Accepts ALLOWED_EMAIL with ANY password.
 * Dev only — started by scripts/dev-local.mjs, never deployed.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_AUTH_PORT ?? 54321);
const EMAIL = (process.env.ALLOWED_EMAIL ?? "local@workhub.dev").split(",")[0].trim().toLowerCase();
const USER_ID = "00000000-0000-4000-8000-000000000001";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function session() {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, email: EMAIL, role: "authenticated", aud: "authenticated", iat: now, exp, iss: `http://127.0.0.1:${PORT}/auth/v1`, session_id: "local" })}.mock`;
  return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "mock-refresh", user: user() };
}
function user() {
  const ts = "2026-01-01T00:00:00Z";
  return { id: USER_ID, aud: "authenticated", role: "authenticated", email: EMAIL, email_confirmed_at: ts, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [{ id: USER_ID, user_id: USER_ID, identity_id: USER_ID, provider: "email", identity_data: { email: EMAIL }, created_at: ts, updated_at: ts }], created_at: ts, updated_at: ts };
}
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } }); });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (req.method === "OPTIONS") return json(res, 204);
  if (path === "/health") return json(res, 200, { ok: true });
  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") return json(res, 200, session());
    const body = await readBody(req);
    if (String(body.email ?? "").toLowerCase() !== EMAIL) return json(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", code: "invalid_credentials" });
    return json(res, 200, session());
  }
  if (path === "/signup" && req.method === "POST") {
    const body = await readBody(req);
    if (String(body.email ?? "").toLowerCase() !== EMAIL) return json(res, 422, { code: 422, msg: "Signups not allowed for this address" });
    return json(res, 200, session());
  }
  if (path === "/user" && req.method === "GET") return json(res, 200, user());
  if (path === "/user" && req.method === "PUT") return json(res, 200, user());
  if (path === "/logout") return json(res, 204);
  if (path === "/recover") return json(res, 200, {});
  json(res, 404, { msg: `mock-auth: no route for ${req.method} ${path}` });
}).listen(PORT, "127.0.0.1", () => console.log(`[mock-auth] listening on http://127.0.0.1:${PORT} — sign in as ${EMAIL} with any password`));
