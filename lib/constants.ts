import type { Priority, Status } from "@/db/schema";
export { STATUSES, PRIORITIES } from "@/db/schema";
export type { Priority, Status } from "@/db/schema";

export const STATUS_LABEL: Record<Status, string> = {
  idea: "Idea",
  in_progress: "In progress",
  blocked: "Blocked",
  waiting: "Waiting on someone",
  done: "Done",
  archived: "Archived",
};

/** Tailwind classes per status. Colors are defined as tokens in app/globals.css. */
export const STATUS_STYLE: Record<Status, { badge: string; dot: string }> = {
  idea: {
    badge: "bg-status-idea/15 text-status-idea border-status-idea/30",
    dot: "bg-status-idea",
  },
  in_progress: {
    badge: "bg-status-progress/15 text-status-progress border-status-progress/30",
    dot: "bg-status-progress",
  },
  blocked: {
    badge: "bg-status-blocked/15 text-status-blocked border-status-blocked/30",
    dot: "bg-status-blocked",
  },
  waiting: {
    badge: "bg-status-waiting/15 text-status-waiting border-status-waiting/30",
    dot: "bg-status-waiting",
  },
  done: {
    badge: "bg-status-done/15 text-status-done border-status-done/30",
    dot: "bg-status-done",
  },
  archived: {
    badge: "bg-status-archived/15 text-status-archived border-status-archived/30",
    dot: "bg-status-archived",
  },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-primary",
  medium: "bg-status-progress",
  low: "bg-muted-foreground/50",
};

/** An initiative with no activity for this many days is flagged as stale. */
export const STALE_DAYS = 7;

export const GROUPINGS = ["status", "area"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export const SORTS = ["activity", "priority", "target", "title"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABEL: Record<Sort, string> = {
  activity: "Last updated",
  priority: "Priority",
  target: "Target date",
  title: "Title",
};
