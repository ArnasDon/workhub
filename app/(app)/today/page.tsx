import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Ban, CalendarClock, ListChecks, MoonStar, NotebookPen, Pin, Sunrise, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToday, type InitiativeWithActivity } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { dueLabel, daysUntil, relativeDays, waitingLabel } from "@/lib/format";
import { plainText } from "@/lib/plain-text";
import { StatusBadge } from "@/components/status-badge";
import { StreakChip } from "@/components/streak-chip";
import { LogUpdateButton } from "@/components/log-update-button";
import { EntryKindBadge } from "@/components/entry-kind-badge";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const t = await getToday(user.id);
  const attention = t.attention.length;
  const quiet = attention === 0 && t.waiting.length === 0 && t.dueSoon.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Sunrise className="size-4" aria-hidden />
            {format(t.now, "EEEE, d MMMM")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">
            {quiet
              ? "Nothing is overdue, stale or blocked. Pick something from the focus list."
              : `${attention} ${attention === 1 ? "item needs" : "items need"} attention · ${t.waiting.length} to chase · ${t.dueSoon.length} due this week`}
          </p>
        </div>
        <StreakChip streak={t.streak} now={t.now} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={AlertTriangle} title="Needs attention" tone="text-status-blocked" count={attention} empty="Nothing overdue, stale or blocked.">
          {t.attention.map(({ initiative, reasons }) => (
            <Row
              key={initiative.id}
              item={initiative}
              note={reasons.map((r) => r.text).join(" · ")}
              noteTone="text-status-blocked"
              icon={reasons.some((r) => r.kind === "blocked") ? Ban : undefined}
            />
          ))}
        </Section>

        <Section icon={UserRound} title="Chase" tone="text-status-waiting" count={t.waiting.length} empty="You're not waiting on anyone.">
          {t.waiting.map((i) => (
            <Row key={i.id} item={i} note={waitingLabel(i.waitingOn, i.waitingSince, t.now)} noteTone="text-status-waiting" />
          ))}
        </Section>

        <Section icon={CalendarClock} title="Due this week" count={t.dueSoon.length} empty="No target dates in the next 7 days.">
          {t.dueSoon.map((i) => (
            <Row key={i.id} item={i} note={`${dueLabel(daysUntil(i.targetDate!, t.now))} · ${format(new Date(`${i.targetDate}T00:00:00`), "EEE d MMM")}`} />
          ))}
        </Section>

        <Section icon={Pin} title="Focus" tone="text-primary" count={t.focus.length} empty="Pin an initiative and its open to-dos show up here.">
          {t.focus.map(({ initiative, tasks }) => (
            <li key={initiative.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Link href={`/initiatives/${initiative.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline underline-offset-4">
                  {initiative.title}
                </Link>
                <StatusBadge status={initiative.status} className="h-5 px-1.5 text-[11px]" />
                <LogUpdateButton initiativeId={initiative.id} size="xs" variant="ghost" label="Log" />
              </div>
              {tasks.length > 0 ? (
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2">
                      <ListChecks className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{task.title}</span>
                    </li>
                  ))}
                  {initiative.taskTotal - initiative.taskDone > tasks.length && (
                    <li className="text-xs">+{initiative.taskTotal - initiative.taskDone - tasks.length} more</li>
                  )}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No open to-dos.</p>
              )}
            </li>
          ))}
        </Section>
      </div>

      <section aria-labelledby="logged-today" className="space-y-3">
        <h2 id="logged-today" className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <NotebookPen className="size-4" aria-hidden />
          Logged today
          <span className="ml-1 text-xs font-normal text-muted-foreground/70">{t.loggedToday.length}</span>
        </h2>
        {t.loggedToday.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Nothing yet. Press <kbd className="rounded border bg-muted px-1 font-mono text-xs">⌘K</kbd> to log the first update of the day.
          </p>
        ) : (
          <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
            {t.loggedToday.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <time dateTime={e.createdAt.toISOString()} className="w-12 shrink-0 text-xs text-muted-foreground">
                  {format(e.createdAt, "HH:mm")}
                </time>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Link href={`/initiatives/${e.initiativeId}`} className="font-medium text-foreground hover:underline underline-offset-4">
                      {e.initiativeTitle}
                    </Link>
                    <EntryKindBadge kind={e.kind} />
                  </div>
                  <p className="line-clamp-2 break-words">{plainText(e.body, 240)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {quiet && t.focus.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MoonStar className="size-4" aria-hidden />
          Quiet day. Last activity {relativeDays(t.streak.lastEntryAt ?? t.now, t.now)}.
        </p>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, tone, count, empty, children }: { icon: LucideIcon; title: string; tone?: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col rounded-2xl border bg-card shadow-xs">
      <h2 className={cn("flex items-center gap-1.5 border-b px-4 py-2.5 text-sm font-semibold", tone)}>
        <Icon className="size-4" aria-hidden />
        {title}
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{count}</span>
      </h2>
      {count === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y">{children}</ul>}
    </section>
  );
}

function Row({ item, note, noteTone, icon: Icon }: { item: InitiativeWithActivity; note: string; noteTone?: string; icon?: LucideIcon }) {
  return (
    <li className="group relative flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
      <Link href={`/initiatives/${item.id}`} aria-label={`Open ${item.title}`} tabIndex={-1} className="absolute inset-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/initiatives/${item.id}`} className="relative z-10 truncate font-medium group-hover:underline underline-offset-4">
            {item.title}
          </Link>
          <StatusBadge status={item.status} className="h-5 px-1.5 text-[11px]" />
          {item.area && <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">{item.area}</Badge>}
        </div>
        <p className={cn("mt-0.5 flex items-center gap-1 text-xs text-muted-foreground", noteTone)}>
          {Icon && <Icon className="size-3.5" aria-hidden />}
          {note}
        </p>
      </div>
      <div className="relative z-10 shrink-0">
        <LogUpdateButton initiativeId={item.id} size="xs" variant="ghost" label="Log" />
      </div>
    </li>
  );
}
