import type { Metadata } from "next";
import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { listTemplates } from "@/lib/templates";
import { requireUser } from "@/lib/auth";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { plainText } from "@/lib/plain-text";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireUser();
  const list = await listTemplates(user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">Starting points for initiatives you create often: description skeleton, defaults, and a to-do list.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/templates/new">
            <Plus data-icon="inline-start" aria-hidden />
            New template
          </Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          description="Create one here, or open any initiative and choose “Save as template” to reuse its shape."
          action={
            <Button asChild variant="outline">
              <Link href="/templates/new">Create a template</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          {list.map((t) => (
            <li key={t.id} className="group relative flex items-start gap-3 px-4 py-3 hover:bg-muted/40">
              <Link href={`/templates/${t.id}`} aria-label={`Edit ${t.name}`} tabIndex={-1} className="absolute inset-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/templates/${t.id}`} className="relative z-10 font-medium group-hover:underline underline-offset-4">
                    {t.name}
                  </Link>
                  {t.area && <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">{t.area}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABEL[t.status]} · {PRIORITY_LABEL[t.priority]} · {t.tasks.length} {t.tasks.length === 1 ? "to-do" : "to-dos"}
                  </span>
                </div>
                {t.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{plainText(t.description, 160)}</p>}
              </div>
              <Button asChild size="xs" variant="outline" className="relative z-10 shrink-0">
                <Link href={`/initiatives/new?template=${t.id}`}>Use</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
