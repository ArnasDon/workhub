import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import { daysByStatus, type StatusSegment } from "@/lib/status-history";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Proportional strip of the time spent in each status, with a per-status total below. */
export function StatusHistory({ segments }: { segments: StatusSegment[] }) {
  const total = Math.max(1, segments.reduce((n, s) => n + Math.max(s.days, 0.5), 0));
  const totals = daysByStatus(segments);
  if (segments.length <= 1 && segments[0]?.days < 1) return null;

  return (
    <div className="space-y-1.5" aria-label="Status history">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={totals.map((t) => `${STATUS_LABEL[t.status]} ${t.days} days`).join(", ")}>
        {segments.map((s, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <span
                className={cn("h-full min-w-[3px] transition-opacity hover:opacity-80", STATUS_STYLE[s.status].dot)}
                style={{ width: `${(Math.max(s.days, 0.5) / total) * 100}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {STATUS_LABEL[s.status]} · {s.days} {s.days === 1 ? "day" : "days"} · {format(s.from, "d MMM")} → {i === segments.length - 1 ? "now" : format(s.to, "d MMM")}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {totals.map((t) => (
          <span key={t.status} className="inline-flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", STATUS_STYLE[t.status].dot)} aria-hidden />
            {STATUS_LABEL[t.status]} {t.days}d
          </span>
        ))}
      </p>
    </div>
  );
}
