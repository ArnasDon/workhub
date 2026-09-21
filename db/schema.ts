import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const STATUSES = [
  "idea",
  "in_progress",
  "blocked",
  "waiting",
  "done",
  "archived",
] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type Link = { label: string; url: string };

export const statusEnum = pgEnum("initiative_status", STATUSES);
export const priorityEnum = pgEnum("initiative_priority", PRIORITIES);

export const initiatives = pgTable(
  "initiatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    area: text("area").notNull().default(""),
    status: statusEnum("status").notNull().default("idea"),
    priority: priorityEnum("priority").notNull().default("medium"),
    targetDate: date("target_date", { mode: "string" }),
    links: jsonb("links").$type<Link[]>().notNull().default([]),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("initiatives_status_idx").on(t.status),
    index("initiatives_area_idx").on(t.area),
    index("initiatives_updated_at_idx").on(t.updatedAt),
  ],
);

export const logEntries = pgTable(
  "log_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    initiativeId: uuid("initiative_id")
      .notNull()
      .references(() => initiatives.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("log_entries_initiative_created_idx").on(t.initiativeId, t.createdAt)],
);

export const initiativesRelations = relations(initiatives, ({ many }) => ({
  entries: many(logEntries),
}));

export const logEntriesRelations = relations(logEntries, ({ one }) => ({
  initiative: one(initiatives, {
    fields: [logEntries.initiativeId],
    references: [initiatives.id],
  }),
}));

export type Initiative = typeof initiatives.$inferSelect;
export type NewInitiative = typeof initiatives.$inferInsert;
export type LogEntry = typeof logEntries.$inferSelect;
