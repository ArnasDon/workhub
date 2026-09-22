import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, DatabaseBackup } from "lucide-react";
import { ImportForm } from "@/components/import-form";

export const metadata: Metadata = { title: "Restore from backup" };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DatabaseBackup className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Restore from backup</h1>
            <p className="text-sm text-muted-foreground">Bring a JSON export back in. Records keep their ids; anything already present is skipped, so this merges rather than overwrites.</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <ImportForm />
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: export from the download icon in the header first. To move to a fresh database, run the migrations there, then restore the export here.
      </p>
    </div>
  );
}
