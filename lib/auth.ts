import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-email";

/**
 * Resolve the signed-in user or redirect to /login. Every server action and
 * data-loading page calls this first: the proxy is the fast path, this is the
 * guarantee.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login?error=not_allowed");
  return user;
}

export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.DATABASE_URL,
  );
}
