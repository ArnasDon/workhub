import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const canRemoveAuthUser = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Security</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/account/password">
              <KeyRound data-icon="inline-start" aria-hidden />
              Change password
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/export?format=json" download>
              <Download data-icon="inline-start" aria-hidden />
              Download all my data (JSON)
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
          Your data is only ever shown to you: every query is scoped to your account, and the database enforces per-user row policies as a second layer. See the{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy note
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-status-blocked/30 bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-status-blocked">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting your account removes every initiative, log entry, to-do, link and template you own. There is no undo. Export first if you might want it back.
          {!canRemoveAuthUser && " The sign-in itself stays registered until the operator removes it; ask them to."}
        </p>
        <DeleteAccountForm email={user.email ?? ""} />
      </section>
    </div>
  );
}
