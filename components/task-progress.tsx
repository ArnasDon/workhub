import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export function percent(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Thin progress bar with "done/total · NN%". Render only when total > 0. */
export function TaskProgress({
  done,
  total,
  size = "sm",
  className,
}: {
  done: number;
  total: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = percent(done, total);
  const complete = total > 0 && done === total;
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={`${done} of ${total} to-dos done, ${pct}%`}>
      <Progress
        value={pct}
        className={cn("flex-1", size === "sm" ? "h-1.5" : "h-2", complete && "[&>[data-slot=progress-indicator]]:bg-status-done")}
      />
      <span className={cn("shrink-0 tabular-nums text-muted-foreground", size === "sm" ? "text-[11px]" : "text-xs", complete && "text-status-done")}>
        {done}/{total} · {pct}%
      </span>
    </div>
  );
}
