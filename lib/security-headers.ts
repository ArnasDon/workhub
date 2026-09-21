/**
 * Security headers applied by the proxy to every HTML response.
 * CSP uses a per-request nonce; Next.js reads it from the request header
 * and stamps its own inline scripts with it.
 */
export function buildCsp(nonce: string, supabaseUrl: string | undefined, dev: boolean): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const directives = [
    `default-src 'self'`,
    // strict-dynamic lets nonce'd scripts load what they need; unsafe-eval only for dev HMR.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}${dev ? " ws: wss:" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(dev ? [] : [`upgrade-insecure-requests`]),
  ];
  return directives.join("; ");
}

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "X-Robots-Tag": "noindex, nofollow",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function applySecurityHeaders(headers: Headers, csp: string, https: boolean) {
  headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) headers.set(k, v);
  if (https) headers.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
}
