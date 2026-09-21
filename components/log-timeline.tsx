import { format } from "date-fns";
import { NotebookPen } from "lucide-react";
import type { LogEntry } from "@/db/schema";
import { dayHeading } from "@/lib/format";
import { Markdown } from "@/components/markdown";

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
              <li key={e.id} className="relative rounded-lg bg-card px-3 py-2.5 shadow-xs">
                <span className="absolute -left-[21px] top-3.5 size-2.5 rounded-full border-2 border-background bg-primary/70" aria-hidden />
                <time dateTime={e.createdAt.toISOString()} className="text-xs text-muted-foreground">
                  {format(e.createdAt, "HH:mm")}
                </time>
                <Markdown text={e.body} className="mt-0.5 break-words" />
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
