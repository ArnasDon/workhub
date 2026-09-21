import Link from "next/link";
import { CalendarDays, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InitiativeWithActivity } from "@/lib/queries";
import { PRIORITY_DOT, PRIORITY_LABEL } from "@/lib/constants";
import { isStale, relativeDays, targetLabel } from "@/lib/format";
import { StatusSelect } from "@/components/status-select";
import { PinButton } from "@/components/pin-button";
import { LogUpdateButton } from "@/components/log-update-button";
import { Badge } from "@/components/ui/badge";
import { plainText } from "@/lib/plain-text";

export function InitiativeCard({ item, now }: { item: InitiativeWithActivity; now: Date }) {
  const stale = item.status !== "done" && item.status !== "archived" && isStale(item.lastActivityAt, now);
  const target = targetLabel(item.targetDate, now);
  const href = `/initiatives/${item.id}`;

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40",
        item.pinned && "border-primary/30",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-2 size-2 shrink-0 rounded-full", PRIORITY_DOT[item.priority])}
          title={`${PRIORITY_LABEL[item.priority]} priority`}
          aria-label={`${PRIORITY_LABEL[item.priority]} priority`}
        />
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
          <Link href={href} className="hover:underline underline-offset-4 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        <PinButton id={item.id} pinned={item.pinned} className="-mr-1.5 -mt-1.5 opacity-60 group-hover:opacity-100 data-[state]:opacity-100 aria-pressed:opacity-100" />
      </div>

      {item.latestEntry ? (
        <p className="line-clamp-3 text-sm text-muted-foreground">{plainText(item.latestEntry.body)}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground/70">No updates yet.</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {item.area && (
          <Link href={`/?area=${encodeURIComponent(item.area)}`} className="hover:text-foreground">
            <Badge variant="secondary" className="font-normal">{item.area}</Badge>
          </Link>
        )}
        <span className={cn("inline-flex items-center gap-1", stale && "font-medium text-status-blocked")}>
          <Clock className="size-3.5" aria-hidden />
          {stale ? `Stale · ${relativeDays(item.lastActivityAt, now)}` : `Updated ${relativeDays(item.lastActivityAt, now)}`}
        </span>
        {target && (
          <span className={cn("inline-flex items-center gap-1", target.overdue && item.status !== "done" && "font-medium text-status-blocked")}>
            <CalendarDays className="size-3.5" aria-hidden />
            {target.overdue && item.status !== "done" ? `Was due ${target.text}` : `Due ${target.text}`}
          </span>
        )}
        {item.links.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="size-3.5" aria-hidden />
            {item.links.length}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <StatusSelect id={item.id} status={item.status} />
        <LogUpdateButton initiativeId={item.id} size="xs" variant="ghost" />
      </div>
    </article>
  );
}
