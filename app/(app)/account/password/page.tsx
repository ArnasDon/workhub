import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "@/components/password-form";

export const metadata: Metadata = { title: "Password" };

export default async function PasswordPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
            <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <PasswordForm />
      </div>
    </div>
  );
}
