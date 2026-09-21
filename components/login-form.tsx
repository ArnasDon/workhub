"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { requestPasswordReset, signInWithPassword, signUpWithPassword, type ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup" | "reset";

const INITIAL: ActionState = { ok: false };

export function LoginForm({ error, showSignOut }: { error?: string; showSignOut?: boolean }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signIn, signInAction, signInPending] = useActionState(signInWithPassword, INITIAL);
  const [signUp, signUpAction, signUpPending] = useActionState(signUpWithPassword, INITIAL);
  const [reset, resetAction, resetPending] = useActionState(requestPasswordReset, INITIAL);

  const pending = signInPending || signUpPending || resetPending;
  const state = mode === "signin" ? signIn : mode === "signup" ? signUp : reset;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-6">
        {mode !== "reset" && (
          <div role="tablist" aria-label="Sign in or create account" className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  mode === m ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked">
            {error}
          </p>
        )}

        {mode === "reset" && reset.ok ? (
          <div className="text-center">
            <MailCheck className="mx-auto size-8 text-status-done" aria-hidden />
            <p className="mt-3 font-medium">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">
              If an account exists for that address, a reset link is on its way. Open it here to choose a new password.
            </p>
            <Button type="button" variant="ghost" className="mt-4" onClick={() => setMode("signin")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form
            key={mode}
            action={mode === "signin" ? signInAction : mode === "signup" ? signUpAction : resetAction}
            className="space-y-4"
          >
            {mode === "reset" && (
              <p className="text-sm text-muted-foreground">Enter your email and we&rsquo;ll send a link to set a new password.</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete={mode === "signup" ? "email" : "username"} required autoFocus placeholder="you@example.com" />
            </div>
            {mode !== "reset" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("reset")} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            )}
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
                <p className="text-xs text-muted-foreground">At least 8 characters. Your browser or password manager can save it.</p>
              </div>
            )}

            {state.error && (
              <p role="alert" className={cn("text-sm", state.ok ? "text-status-done" : "text-destructive")}>
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>

            {mode === "reset" && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("signin")}>
                Back to sign in
              </Button>
            )}
          </form>
        )}
      </div>

      {showSignOut && (
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" className="w-full">
            Sign out of the current account
          </Button>
        </form>
      )}
    </div>
  );
}
