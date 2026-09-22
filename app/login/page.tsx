import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { isConfigured } from "@/lib/auth";
import { hasAllowlist } from "@/lib/allowed-email";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "This account is not allowed to use this WorkHub. Sign out and use an invited address.",
  link_invalid: "That link is invalid or has expired. Request a new one.",
};
const NOTICES: Record<string, string> = {
  "1": "Your account and all its data have been deleted.",
  data: "All your data has been deleted and you have been signed out. Ask the operator to remove the sign-in itself.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;
  const error = errorKey ? ERRORS[errorKey] ?? "Something went wrong. Try again." : undefined;
  const notice = typeof sp.deleted === "string" ? NOTICES[sp.deleted] : undefined;
  const inviteOnly = hasAllowlist();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">WorkHub</h1>
          <p className="text-sm text-muted-foreground">
            Your initiatives, with a running log.{inviteOnly ? " Invite-only." : ""}
          </p>
        </div>

        {notice && (
          <p role="status" className="rounded-lg bg-status-done/10 px-3 py-2 text-center text-sm text-status-done">
            {notice}
          </p>
        )}

        {isConfigured() ? (
          <LoginForm error={error} showSignOut={errorKey === "not_allowed"} />
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm leading-relaxed">
            <p className="font-medium">Not configured yet</p>
            <p className="mt-1 text-muted-foreground">
              Copy <code className="rounded bg-muted px-1">.env.example</code> to{" "}
              <code className="rounded bg-muted px-1">.env.local</code>, fill in your Supabase project
              values, then restart the dev server. See the README for the full setup.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy</Link>
        </p>
      </div>
    </main>
  );
}
