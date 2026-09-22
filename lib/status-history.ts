import { differenceInCalendarDays } from "date-fns";
import { STATUS_LABEL, STATUSES, type Status } from "@/lib/constants";
import type { LogEntry } from "@/db/schema";

export type StatusSegment = { status: Status; from: Date; to: Date; days: number };

const LABEL_TO_STATUS = new Map<string, Status>(STATUSES.map((s) => [STATUS_LABEL[s], s]));
const TRANSITION = /^Status: (.+?) → (.+?)(?: \(.*\))?$/m;

/** Parse "Status: A → B" (optionally "(who)") into statuses. Null for anything else. */
export function parseTransition(body: string): { from: Status; to: Status } | null {
  const m = body.match(TRANSITION);
  if (!m) return null;
  const from = LABEL_TO_STATUS.get(m[1].trim());
  const to = LABEL_TO_STATUS.get(m[2].trim());
  return from && to ? { from, to } : null;
}

/**
 * Rebuild the status timeline of an initiative from its log. The first
 * transition's "from" is the initial status; with no transitions, the
 * current status spans the whole life.
 */
export function statusHistory(
  createdAt: Date,
  currentStatus: Status,
  entries: Pick<LogEntry, "body" | "createdAt" | "kind">[],
  now = new Date(),
): StatusSegment[] {
  const transitions = entries
    .filter((e) => e.kind === "status" || e.body.startsWith("Status: "))
    .map((e) => ({ at: e.createdAt, t: parseTransition(e.body) }))
    .filter((x): x is { at: Date; t: { from: Status; to: Status } } => x.t !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const segments: StatusSegment[] = [];
  let status: Status = transitions[0]?.t.from ?? currentStatus;
  let from = createdAt;
  for (const { at, t } of transitions) {
    segments.push({ status, from, to: at, days: Math.max(0, differenceInCalendarDays(at, from)) });
    status = t.to;
    from = at;
  }
  segments.push({ status, from, to: now, days: Math.max(0, differenceInCalendarDays(now, from)) });
  return segments;
}

/** Total days per status, in canonical status order. */
export function daysByStatus(segments: StatusSegment[]): { status: Status; days: number }[] {
  const totals = new Map<Status, number>();
  for (const s of segments) totals.set(s.status, (totals.get(s.status) ?? 0) + s.days);
  return STATUSES.filter((s) => totals.has(s)).map((s) => ({ status: s, days: totals.get(s)! }));
}
