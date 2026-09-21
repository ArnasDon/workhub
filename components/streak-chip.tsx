import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Streak } from "@/lib/queries";
import { relativeDays } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Are you actually logging? A quiet nudge next to the dashboard title. */
export function StreakChip({ streak, now }: { streak: Streak; now: Date }) {
  const active = streak.days > 0;
  const label = active
    ? `${streak.days}-day streak`
    : streak.lastEntryAt
      ? `Last logged ${relativeDays(streak.lastEntryAt, now)}`
      : "No entries yet";
  const detail = `${streak.thisWeek} ${streak.thisWeek === 1 ? "update" : "updates"} in the last 7 days${
    streak.loggedToday ? " · logged today" : active ? " · nothing logged today yet" : ""
  }`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-ring",
            active ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground",
          )}
        >
          <Flame className={cn("size-3.5", active && streak.loggedToday && "fill-current")} aria-hidden />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
