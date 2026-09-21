-- Defense in depth: the app talks to Postgres through DATABASE_URL (the `postgres`
-- role, which bypasses RLS). Enabling RLS with no policies means the public
-- anon/authenticated roles that the Supabase REST API exposes can read nothing.
ALTER TABLE "initiatives" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "log_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Full-text search indexes used by lib/queries.ts.
CREATE INDEX IF NOT EXISTS "initiatives_title_fts_idx"
  ON "initiatives" USING gin (to_tsvector('english', "title" || ' ' || "area"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_entries_body_fts_idx"
  ON "log_entries" USING gin (to_tsvector('english', "body"));
--> statement-breakpoint

-- Keep updated_at honest on direct row edits.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS initiatives_set_updated_at ON "initiatives";
--> statement-breakpoint
CREATE TRIGGER initiatives_set_updated_at
  BEFORE UPDATE ON "initiatives"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
