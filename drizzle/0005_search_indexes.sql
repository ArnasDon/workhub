-- Full-text search now covers descriptions and to-do items (lib/queries.ts search()).
DROP INDEX IF EXISTS "initiatives_title_fts_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "initiatives_fts_idx"
  ON "initiatives" USING gin (to_tsvector('english', "title" || ' ' || "area" || ' ' || "description"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_title_fts_idx"
  ON "tasks" USING gin (to_tsvector('english', "title"));
