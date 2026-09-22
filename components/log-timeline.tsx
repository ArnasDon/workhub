import { format } from "date-fns";
import { NotebookPen } from "lucide-react";
import type { LogEntry } from "@/db/schema";
import { dayHeading } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { EntryKindBadge } from "@/components/entry-kind-badge";
import { cn } from "@/lib/utils";

export function LogTimeline({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
        <NotebookPen className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">No entries yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Log where things stand. Future you will want the &ldquo;why&rdquo;, not just the status.
        </p>
      </div>
    );
  }

  const groups: { heading: string; items: LogEntry[] }[] = [];
  for (const e of entries) {
    const heading = dayHeading(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(e);
    else groups.push({ heading, items: [e] });
  }

  return (
    <ol className="space-y-6">
      {groups.map((g) => (
        <li key={g.heading}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.heading}</h3>
          <ol className="space-y-2 border-l-2 border-border pl-4">
            {g.items.map((e) => (
              <li key={e.id} className={cn("relative rounded-lg bg-card px-3 py-2.5 shadow-xs", e.kind === "decision" && "border-l-2 border-primary/60", e.kind === "blocker" && "border-l-2 border-status-blocked/60")}>
                <span className={cn("absolute -left-[21px] top-3.5 size-2.5 rounded-full border-2 border-background", e.kind === "decision" ? "bg-primary" : e.kind === "blocker" ? "bg-status-blocked" : e.kind === "status" || e.kind === "task" ? "bg-muted-foreground/40" : "bg-primary/70")} aria-hidden />
                <div className="flex items-center gap-2">
                  <time dateTime={e.createdAt.toISOString()} className="text-xs text-muted-foreground">
                    {format(e.createdAt, "HH:mm")}
                  </time>
                  <EntryKindBadge kind={e.kind} />
                </div>
                <Markdown text={e.body} className="mt-0.5 break-words" />
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
