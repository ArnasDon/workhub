import type { CookieOptions } from "@supabase/ssr";

/**
 * The app never uses a browser Supabase client, so the session cookies can be
 * HttpOnly: JavaScript in the page cannot read the tokens. Secure in
 * production; Lax is enough because every mutation is a same-site server action.
 */
export const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
