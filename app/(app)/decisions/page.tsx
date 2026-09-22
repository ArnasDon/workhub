import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Gavel } from "lucide-react";
import { listDecisions, type DecisionEntry } from "@/lib/queries";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Decisions" };
export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const decisions = await listDecisions();

  if (decisions.length === 0) {
    return (
      <EmptyState
        icon={Gavel}
        title="No decisions logged yet"
        description="When you write a log entry, mark it as a Decision. Every decision across all initiatives collects here, so the “why” is never lost."
      />
    );
  }

  const months = new Map<string, DecisionEntry[]>();
  for (const d of decisions) {
    const key = format(d.createdAt, "yyyy-MM");
    months.set(key, [...(months.get(key) ?? []), d]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="text-sm text-muted-foreground">
          {decisions.length} {decisions.length === 1 ? "decision" : "decisions"} across all initiatives, newest first.
        </p>
      </div>

      {[...months.entries()].map(([key, list]) => (
        <section key={key} aria-label={format(new Date(`${key}-01T00:00:00`), "MMMM yyyy")}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {format(new Date(`${key}-01T00:00:00`), "MMMM yyyy")}
          </h2>
          <ol className="space-y-2">
            {list.map((d) => (
              <li key={d.id} className="rounded-xl border border-l-2 border-l-primary/60 bg-card p-4 shadow-xs">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <time dateTime={d.createdAt.toISOString()}>{format(d.createdAt, "EEE d MMM, HH:mm")}</time>
                  <span aria-hidden>·</span>
                  <Link href={`/initiatives/${d.initiativeId}`} className="font-medium text-foreground hover:underline underline-offset-4">
                    {d.initiativeTitle}
                  </Link>
                  <StatusBadge status={d.initiativeStatus} className="h-5 px-1.5 text-[11px]" />
                  {d.initiativeArea && <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">{d.initiativeArea}</Badge>}
                </div>
                <Markdown text={d.body} className="break-words" />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
