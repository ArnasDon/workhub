import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarRange, CheckCircle2, MoonStar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDigest } from "@/lib/queries";
import { digestRangeLabel, digestToMarkdown } from "@/lib/digest";
import { relativeDays } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Digest" };
export const dynamic = "force-dynamic";

const RANGES = [7, 14, 30] as const;

export default async function DigestPage({ searchParams }: PageProps<"/digest">) {
  const sp = await searchParams;
  const requested = Number(sp.days);
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 7;
  const digest = await getDigest(days);
  const markdown = digestToMarkdown(digest);
  const empty = digest.groups.length === 0 && digest.completed.length === 0 && digest.created.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Digest</h1>
          <p className="text-sm text-muted-foreground">
            {digestRangeLabel(digest)} · {digest.entryCount} {digest.entryCount === 1 ? "update" : "updates"} across{" "}
            {digest.groups.length} {digest.groups.length === 1 ? "initiative" : "initiatives"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Period" className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={r === 7 ? "/digest" : `/digest?days=${r}`}
                aria-current={days === r ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  days === r ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}d
              </Link>
            ))}
          </div>
          <CopyButton text={markdown} />
        </div>
      </div>

      {empty ? (
        <EmptyState
          icon={CalendarRange}
          title={`Nothing logged in the last ${days} days`}
          description="Updates you log against initiatives show up here, grouped and ready to paste into a status post or 1:1 notes."
        />
      ) : (
        <div className="space-y-6">
          {digest.groups.map((g) => (
            <section key={g.initiative.id} aria-labelledby={`digest-${g.initiative.id}`} className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 id={`digest-${g.initiative.id}`} className="text-base font-semibold">
                  <Link href={`/initiatives/${g.initiative.id}`} className="hover:underline underline-offset-4">
                    {g.initiative.title}
                  </Link>
                </h2>
                <StatusBadge status={g.initiative.status} className="h-5 px-1.5 text-[11px]" />
                {g.initiative.area && <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">{g.initiative.area}</Badge>}
              </div>
              <ol className="space-y-2 border-l-2 border-border pl-4">
                {g.entries.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-2 size-2.5 rounded-full border-2 border-background bg-primary/70" aria-hidden />
                    <time dateTime={e.createdAt.toISOString()} className="text-xs text-muted-foreground">
                      {format(e.createdAt, "EEE d MMM, HH:mm")}
                    </time>
                    <Markdown text={e.body} className="mt-0.5 break-words" />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {(digest.completed.length > 0 || digest.created.length > 0 || digest.quiet.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SideList icon={CheckCircle2} title="Completed" items={digest.completed.map((i) => ({ id: i.id, title: i.title, note: i.area }))} tone="text-status-done" />
          <SideList icon={Sparkles} title="New this period" items={digest.created.map((i) => ({ id: i.id, title: i.title, note: i.area }))} tone="text-primary" />
          <SideList
            icon={MoonStar}
            title={`Gone quiet`}
            items={digest.quiet.map((i) => ({ id: i.id, title: i.title, note: `last update ${relativeDays(i.lastActivityAt, digest.until)}` }))}
            tone="text-status-blocked"
          />
        </div>
      )}
    </div>
  );
}

function SideList({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof CheckCircle2;
  title: string;
  items: { id: string; title: string; note?: string }[];
  tone: string;
}) {
  return (
    <section aria-label={title} className="rounded-2xl border bg-card/60 p-4">
      <h2 className={cn("mb-2 flex items-center gap-1.5 text-sm font-semibold", tone)}>
        <Icon className="size-4" aria-hidden />
        {title}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/initiatives/${i.id}`} className="hover:underline underline-offset-4">
                {i.title}
              </Link>
              {i.note && <span className="text-muted-foreground"> · {i.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
