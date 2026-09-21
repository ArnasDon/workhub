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
