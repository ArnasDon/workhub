import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createTemplate } from "@/lib/actions";
import { listAreas } from "@/lib/queries";
import { TemplateForm } from "@/components/template-form";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  const areas = await listAreas();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Templates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New template</h1>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <TemplateForm action={createTemplate} areas={areas} submitLabel="Create template" />
      </div>
    </div>
  );
}
