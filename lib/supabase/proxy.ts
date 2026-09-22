import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/allowed-email";
import { applySecurityHeaders, buildCsp } from "@/lib/security-headers";
import { COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

const PUBLIC_PATHS = ["/login", "/privacy", "/auth/"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}

/**
 * Refreshes the Supabase session cookie on every request and gates the app:
 * - no session            → /login
 * - session, wrong email  → /login?error=not_allowed (login page offers sign-out)
 * - session, right email  → through (and /login bounces to /)
 */
export async function updateSession(request: NextRequest) {
  // Per-request CSP nonce. Next.js picks it up from the forwarded request header.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL, dev);
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const withHeaders = (res: NextResponse) => {
    applySecurityHeaders(res.headers, csp, https);
    return res;
  };

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Unconfigured: let pages render their "not configured" notice.
    return withHeaders(response);
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not put logic between createServerClient and getUser(): the session refresh happens here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicPath = isPublic(pathname);

  if (!user) {
    if (publicPath) return withHeaders(response);
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return withHeaders(NextResponse.redirect(login));
  }

  const allowed = isAllowedEmail(user.email);

  if (!allowed) {
    if (publicPath) return withHeaders(response);
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "?error=not_allowed";
    return withHeaders(NextResponse.redirect(login));
  }

  if (pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return withHeaders(NextResponse.redirect(home));
  }

  return withHeaders(response);
}
