import type { Metadata } from "next";
import { LogoTile } from "@/components/logo";
import { LoginForm } from "@/components/login-form";
import { isConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "This account is not allowed to use this WorkHub. Sign out and use the configured address.",
  link_invalid: "That link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;
  const error = errorKey ? ERRORS[errorKey] ?? "Something went wrong. Try again." : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <LogoTile size="lg" className="mx-auto" />
          <h1 className="text-2xl font-semibold tracking-tight">WorkHub</h1>
          <p className="text-sm text-muted-foreground">
            Your initiatives, with a running log.
          </p>
        </div>

        {isConfigured() ? (
          <LoginForm error={error} showSignOut={errorKey === "not_allowed"} />
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm leading-relaxed">
            <p className="font-medium">Not configured yet</p>
            <p className="mt-1 text-muted-foreground">
              Copy <code className="rounded bg-muted px-1">.env.example</code> to{" "}
              <code className="rounded bg-muted px-1">.env.local</code>, fill in your Supabase project
              values and <code className="rounded bg-muted px-1">ALLOWED_EMAIL</code>, then restart the
              dev server. See the README for the full setup.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
