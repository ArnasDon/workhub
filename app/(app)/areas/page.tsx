import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAreaRollups } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { STATUSES, STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import { relativeDays } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { TaskProgress } from "@/components/task-progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const metadata: Metadata = { title: "Areas" };
export const dynamic = "force-dynamic";

export default async function AreasPage() {
  const now = new Date();
  const user = await requireUser();
  const rollups = await getAreaRollups(user.id, now);

  if (rollups.length === 0) {
    return <EmptyState icon={Layers} title="No areas yet" description="Give initiatives an area (e.g. “Ads Integrations”) and this page shows how each area is doing." />;
  }

  const active = STATUSES.filter((s) => s !== "archived");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Areas</h1>
        <p className="text-sm text-muted-foreground">How each area is doing: status mix, to-do completion, and what needs a nudge. Click an area to see its initiatives.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rollups.map((r) => {
          const total = r.initiatives.length;
          const label = r.area || "No area";
          const href = r.area ? `/?area=${encodeURIComponent(r.area)}` : "/";
          return (
            <section key={label} aria-label={label} className="group relative flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40">
              <Link href={href} aria-label={`Open ${label}`} tabIndex={-1} className="absolute inset-0 rounded-2xl" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    <Link href={href} className="relative z-10 group-hover:underline underline-offset-4">
                      {label}
                    </Link>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {total} {total === 1 ? "initiative" : "initiatives"}
                    {r.lastActivityAt && <> · last activity {relativeDays(r.lastActivityAt, now)}</>}
                  </p>
                </div>
                <Button asChild size="xs" variant="ghost" className="relative z-10">
                  <Link href={r.area ? `/board?area=${encodeURIComponent(r.area)}` : "/board"} aria-label={`Board for ${label}`}>
                    <Columns3 data-icon="inline-start" aria-hidden />
                    Board
                  </Link>
                </Button>
              </div>

              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={active.filter((s) => r.byStatus[s]).map((s) => `${STATUS_LABEL[s]} ${r.byStatus[s]}`).join(", ")}>
                {active.map((s) =>
                  r.byStatus[s] ? (
                    <Tooltip key={s}>
                      <TooltipTrigger asChild>
                        <span className={cn("relative z-10 h-full", STATUS_STYLE[s].dot)} style={{ width: `${(r.byStatus[s] / total) * 100}%` }} />
                      </TooltipTrigger>
                      <TooltipContent>{STATUS_LABEL[s]} · {r.byStatus[s]}</TooltipContent>
                    </Tooltip>
                  ) : null,
                )}
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {active.filter((s) => r.byStatus[s]).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className={cn("size-1.5 rounded-full", STATUS_STYLE[s].dot)} aria-hidden />
                    {STATUS_LABEL[s]} {r.byStatus[s]}
                  </span>
                ))}
              </p>

              {r.taskTotal > 0 && <TaskProgress done={r.taskDone} total={r.taskTotal} />}

              <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <Stat label="stale" n={r.stale} tone="text-status-blocked" />
                <Stat label="overdue" n={r.overdue} tone="text-status-blocked" />
                <Stat label="waiting" n={r.waiting} tone="text-status-waiting" />
                {r.stale + r.overdue + r.waiting === 0 && <span className="text-status-done">All quiet</span>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, n, tone }: { label: string; n: number; tone: string }) {
  if (n === 0) return null;
  return (
    <span className={cn("font-medium", tone)}>
      {n} {label}
    </span>
  );
}
