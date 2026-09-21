import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createInitiative } from "@/lib/actions";
import { listAreas } from "@/lib/queries";
import { InitiativeForm } from "@/components/initiative-form";

export const metadata: Metadata = { title: "New initiative" };

export default async function NewInitiativePage() {
  const areas = await listAreas();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New initiative</h1>
        <p className="text-sm text-muted-foreground">Keep it short. The log is where the detail goes.</p>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <InitiativeForm action={createInitiative} areas={areas} submitLabel="Create initiative" />
      </div>
    </div>
  );
}
