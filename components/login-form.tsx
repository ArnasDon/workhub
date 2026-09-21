"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { sendMagicLink, type ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ error, showSignOut }: { error?: string; showSignOut?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sendMagicLink, { ok: false });

  if (state.ok) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto size-8 text-status-done" aria-hidden />
        <p className="mt-3 font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent you a sign-in link. It expires in an hour; open it on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
    <form action={action} className="space-y-4 rounded-xl border bg-card p-6">
      {error && (
        <p role="alert" className="rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@example.com" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send magic link"}
      </Button>
    </form>
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
