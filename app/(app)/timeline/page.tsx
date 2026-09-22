import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { listInitiatives, type InitiativeWithActivity } from "@/lib/queries";
import { PRIORITY_DOT, PRIORITY_LABEL } from "@/lib/constants";
import { daysUntil, dueLabel } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { plainText } from "@/lib/plain-text";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

type Dated = InitiativeWithActivity & { targetDate: string; days: number };

export default async function TimelinePage() {
  const now = new Date();
  const items = await listInitiatives({ includeArchived: false, sort: "target" });
  const dated: Dated[] = items
    .filter((i): i is InitiativeWithActivity & { targetDate: string } => Boolean(i.targetDate))
    .map((i) => ({ ...i, days: daysUntil(i.targetDate, now) }))
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const undated = items.filter((i) => !i.targetDate && i.status !== "done");

  const overdue = dated.filter((i) => i.days < 0 && i.status !== "done");
  const upcoming = dated.filter((i) => !(i.days < 0 && i.status !== "done"));

  const months = new Map<string, Dated[]>();
  for (const i of upcoming) {
    const key = i.targetDate.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), i]);
  }

  if (dated.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No target dates yet"
        description="Give initiatives a target date and they line up here by month, with overdue ones on top."
        action={
          <Button asChild variant="outline">
            <Link href="/">Back to the list</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-sm text-muted-foreground">
          {dated.length} {dated.length === 1 ? "initiative has" : "initiatives have"} a target date
          {overdue.length > 0 && (
            <>
              {" · "}
              <span className="font-medium text-status-blocked">{overdue.length} overdue</span>
            </>
          )}
        </p>
      </div>

      {overdue.length > 0 && (
        <Section title="Overdue" tone="text-status-blocked">
          {overdue.map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </Section>
      )}

      {[...months.entries()].map(([key, list]) => (
        <Section key={key} title={format(new Date(`${key}-01T00:00:00`), "MMMM yyyy")}>
          {list.map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </Section>
      ))}

      {undated.length > 0 && (
        <details className="group rounded-2xl border border-dashed bg-card/60 p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground marker:content-none">
            <CalendarOff className="size-4" aria-hidden />
            {undated.length} in flight without a target date
            <span className="ml-auto text-xs group-open:hidden">Show</span>
            <span className="ml-auto hidden text-xs group-open:inline">Hide</span>
          </summary>
          <ul className="mt-3 space-y-1.5 text-sm">
            {undated.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", PRIORITY_DOT[i.priority])} aria-hidden />
                <Link href={`/initiatives/${i.id}`} className="hover:underline underline-offset-4">
                  {i.title}
                </Link>
                <StatusBadge status={i.status} className="h-5 px-1.5 text-[11px]" />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", tone)}>{title}</h2>
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">{children}</ol>
    </section>
  );
}

function Row({ item }: { item: Dated }) {
  const date = new Date(`${item.targetDate}T00:00:00`);
  const late = item.days < 0 && item.status !== "done";
  const soon = !late && item.days >= 0 && item.days <= 7 && item.status !== "done";
  return (
    <li data-kb-card={item.id} className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <Link href={`/initiatives/${item.id}`} aria-label={`Open ${item.title}`} tabIndex={-1} className="absolute inset-0" />
      <time
        dateTime={item.targetDate}
        className={cn(
          "flex w-12 shrink-0 flex-col items-center rounded-lg border py-1 leading-tight",
          late ? "border-status-blocked/40 bg-status-blocked/10 text-status-blocked" : "bg-muted/60",
        )}
      >
        <span className="text-[10px] font-medium uppercase">{format(date, "EEE")}</span>
        <span className="text-lg font-semibold">{format(date, "d")}</span>
      </time>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/initiatives/${item.id}`} className="relative z-10 inline-flex items-baseline gap-2 font-medium group-hover:underline underline-offset-4">
            <span className={cn("size-2 shrink-0 self-center rounded-full", PRIORITY_DOT[item.priority])} aria-label={`${PRIORITY_LABEL[item.priority]} priority`} />
            {item.title}
          </Link>
          <StatusBadge status={item.status} className="h-5 px-1.5 text-[11px]" />
          {item.area && <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">{item.area}</Badge>}
        </div>
        {item.latestEntry && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{plainText(item.latestEntry.body, 160)}</p>}
      </div>
      <span className={cn("shrink-0 text-xs", late ? "font-medium text-status-blocked" : soon ? "font-medium text-status-progress" : "text-muted-foreground")}>
        {item.status === "done" ? "Done" : dueLabel(item.days)}
      </span>
    </li>
  );
}
