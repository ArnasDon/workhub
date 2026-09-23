import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import { createInitiative } from "@/lib/actions";
import { listAreas } from "@/lib/queries";
import { getTemplate, listTemplates } from "@/lib/templates";
import { requireUser } from "@/lib/auth";
import { InitiativeForm } from "@/components/initiative-form";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "New initiative" };
export const dynamic = "force-dynamic";

export default async function NewInitiativePage({ searchParams }: PageProps<"/initiatives/new">) {
  const sp = await searchParams;
  const templateId = typeof sp.template === "string" ? sp.template : undefined;
  const user = await requireUser();
  const [areas, templates, template] = await Promise.all([
    listAreas(user.id),
    listTemplates(user.id),
    templateId && /^[0-9a-f-]{36}$/i.test(templateId) ? getTemplate(user.id, templateId) : Promise.resolve(null),
  ]);

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

      {templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Start from a template">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <LayoutTemplate className="size-3.5" aria-hidden />
            Template:
          </span>
          <Link href="/initiatives/new" className="rounded-full">
            <Badge variant={template ? "secondary" : "default"} className="font-normal">Blank</Badge>
          </Link>
          {templates.map((t) => (
            <Link key={t.id} href={`/initiatives/new?template=${t.id}`} className="rounded-full">
              <Badge variant={template?.id === t.id ? "default" : "secondary"} className={cn("font-normal", template?.id !== t.id && "hover:bg-accent")}>
                {t.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        {template && (
          <p className="mb-4 text-xs text-muted-foreground">
            Prefilled from <span className="font-medium text-foreground">{template.name}</span>
            {template.tasks.length > 0 && <> · {template.tasks.length} to-dos will be added</>}
          </p>
        )}
        <InitiativeForm
          key={template?.id ?? "blank"}
          action={createInitiative}
          areas={areas}
          submitLabel="Create initiative"
          templateId={template?.id}
          defaults={
            template
              ? { description: template.description, area: template.area, status: template.status, priority: template.priority, checkInDays: template.checkInDays, links: template.links }
              : undefined
          }
        />
      </div>
    </div>
  );
}
