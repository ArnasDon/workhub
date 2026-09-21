"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { updatePassword, type ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(updatePassword, { ok: false });

  if (state.ok) {
    return (
      <div className="flex items-start gap-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-5 text-status-done" aria-hidden />
        <div>
          <p className="font-medium">Password updated</p>
          <p className="text-muted-foreground">Use it next time you sign in. You&rsquo;re still signed in on this device.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
