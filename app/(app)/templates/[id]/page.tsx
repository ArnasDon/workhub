import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { deleteTemplate, updateTemplate } from "@/lib/actions";
import { listAreas } from "@/lib/queries";
import { getTemplate } from "@/lib/templates";
import { TemplateForm } from "@/components/template-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit template" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditTemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [template, areas] = await Promise.all([getTemplate(id), listAreas()]);
  if (!template) notFound();
  const update = updateTemplate.bind(null, template.id);
  const remove = deleteTemplate.bind(null, template.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            Templates
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{template.name}</h1>
        </div>
        <Button asChild>
          <Link href={`/initiatives/new?template=${template.id}`}>New initiative from this</Link>
        </Button>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <TemplateForm action={update} template={template} areas={areas} submitLabel="Save template" />
      </div>
      <form action={remove} className="flex justify-end">
        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          Delete template
        </Button>
      </form>
    </div>
  );
}
