import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { STALE_DAYS } from "@/lib/constants";

export function relativeDays(date: Date, now = new Date()): string {
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function isStale(lastActivityAt: Date, now = new Date()): boolean {
  return differenceInCalendarDays(now, lastActivityAt) >= STALE_DAYS;
}

export function dayHeading(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, d MMM yyyy");
}

export function targetLabel(targetDate: string | null, now = new Date()): { text: string; overdue: boolean } | null {
  if (!targetDate) return null;
  const d = new Date(`${targetDate}T00:00:00`);
  const days = differenceInCalendarDays(d, now);
  const text = format(d, "d MMM");
  return { text, overdue: days < 0 };
}

/** Whole calendar days from `now` to a YYYY-MM-DD date; negative when in the past. */
export function daysUntil(targetDate: string, now = new Date()): number {
  return differenceInCalendarDays(new Date(`${targetDate}T00:00:00`), now);
}

export function dueLabel(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/** "Waiting on Jane · 3d" / "Waiting · 3d" / "Waiting on Jane". */
export function waitingLabel(waitingOn: string, waitingSince: Date | null, now = new Date()): string {
  const who = waitingOn ? `Waiting on ${waitingOn}` : "Waiting";
  if (!waitingSince) return who;
  const days = differenceInCalendarDays(now, waitingSince);
  return days <= 0 ? `${who} · today` : `${who} · ${days}d`;
}
