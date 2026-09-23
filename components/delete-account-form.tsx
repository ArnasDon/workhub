"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccount, type ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteAccount, { ok: false });
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Type your email to confirm</Label>
        <Input id="confirm" name="confirm" type="email" placeholder={email} autoComplete="off" required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="destructive" disabled={pending}>
        <Trash2 data-icon="inline-start" aria-hidden />
        {pending ? "Deleting…" : "Delete my account and all data"}
      </Button>
    </form>
  );
}
