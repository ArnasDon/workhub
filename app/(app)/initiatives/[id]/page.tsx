import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, ExternalLink, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitiative, listAreas, listEntries, listInitiativeOptions, listRelations, listTasks } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { PRIORITY_DOT, PRIORITY_LABEL } from "@/lib/constants";
import { relativeDays, targetLabel, waitingLabel } from "@/lib/format";
import { StatusSelect } from "@/components/status-select";
import { PinButton } from "@/components/pin-button";
import { EditInitiativeSheet } from "@/components/edit-initiative-sheet";
import { SnoozeMenu } from "@/components/snooze-menu";
import { SaveAsTemplateButton } from "@/components/save-as-template-button";
import { StatusHistory } from "@/components/status-history";
import { statusHistory } from "@/lib/status-history";
import { DeleteInitiativeButton } from "@/components/delete-initiative-button";
import { LogEntryForm } from "@/components/log-entry-form";
import { LogTimeline } from "@/components/log-timeline";
import { RelationsPanel } from "@/components/relations-panel";
import { Markdown } from "@/components/markdown";
import { TaskList } from "@/components/task-list";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/initiatives/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Not found" };
  const user = await requireUser();
  const initiative = await getInitiative(user.id, id);
  return { title: initiative?.title ?? "Not found" };
}

export default async function InitiativePage({ params }: PageProps<"/initiatives/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const [initiative, entries, areas, relations, options, taskRows] = await Promise.all([
    getInitiative(user.id, id),
    listEntries(user.id, id),
    listAreas(user.id),
    listRelations(user.id, id),
    listInitiativeOptions(user.id),
    listTasks(user.id, id),
  ]);
  if (!initiative) notFound();

  const now = new Date();
  const lastActivity = entries[0]?.createdAt && entries[0].createdAt > initiative.updatedAt ? entries[0].createdAt : initiative.updatedAt;
  const target = targetLabel(initiative.targetDate, now);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Dashboard
        </Link>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-start gap-2">
              <h1 className="text-2xl font-semibold leading-tight tracking-tight">{initiative.title}</h1>
              <PinButton id={initiative.id} pinned={initiative.pinned} className="mt-0.5" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
              {initiative.area && (
                <Link href={`/?area=${encodeURIComponent(initiative.area)}`}>
                  <Badge variant="secondary" className="font-normal">{initiative.area}</Badge>
                </Link>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", PRIORITY_DOT[initiative.priority])} aria-hidden />
                {PRIORITY_LABEL[initiative.priority]} priority
              </span>
              {target && (
                <span className={cn("inline-flex items-center gap-1", target.overdue && initiative.status !== "done" && "font-medium text-status-blocked")}>
                  <CalendarDays className="size-4" aria-hidden />
                  {target.overdue && initiative.status !== "done" ? "Was due" : "Due"} {format(new Date(`${initiative.targetDate}T00:00:00`), "d MMM yyyy")}
                </span>
              )}
              {initiative.status === "waiting" && (
                <span className="inline-flex items-center gap-1 font-medium text-status-waiting">
                  <UserRound className="size-4" aria-hidden />
                  {waitingLabel(initiative.waitingOn, initiative.waitingSince, now)}
                </span>
              )}
              <span>Updated {relativeDays(lastActivity, now)}</span>
              {initiative.checkInDays && <span>Check-in every {initiative.checkInDays}d</span>}
              <span>Created {format(initiative.createdAt, "d MMM yyyy")}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StatusSelect id={initiative.id} status={initiative.status} waitingOn={initiative.waitingOn} size="default" className="h-8" />
            <SnoozeMenu id={initiative.id} snoozedUntil={initiative.snoozedUntil} now={now} />
            <EditInitiativeSheet initiative={initiative} areas={areas} />
          </div>
        </div>

        <div className="mt-4">
          <StatusHistory segments={statusHistory(initiative.createdAt, initiative.status, entries, now)} />
        </div>

        {initiative.links.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Links">
            {initiative.links.map((l, i) => (
              <li key={`${l.url}-${i}`}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-sm hover:border-primary/40 hover:text-primary"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {initiative.description.trim() && (
        <section aria-label="Description" className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
          <Markdown text={initiative.description} className="break-words" />
        </section>
      )}

      <TaskList initiativeId={initiative.id} tasks={taskRows} />

      <RelationsPanel initiativeId={initiative.id} relations={relations} options={options} />

      <section aria-labelledby="log-heading" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="log-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Log
          </h2>
          <span className="text-xs text-muted-foreground/70">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <LogEntryForm initiativeId={initiative.id} />
        <LogTimeline entries={entries} />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        <span>{initiative.status === "archived" ? "Archived. Kept for history; delete only if it was created by mistake." : "Reuse this shape (description, defaults, to-dos) for future initiatives."}</span>
        <div className="flex items-center gap-1">
          <SaveAsTemplateButton initiativeId={initiative.id} />
          {initiative.status === "archived" && <DeleteInitiativeButton id={initiative.id} title={initiative.title} entryCount={entries.length} />}
        </div>
      </footer>
    </div>
  );
}
