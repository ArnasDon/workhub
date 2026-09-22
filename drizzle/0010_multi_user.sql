-- Multi-user: every initiative and template belongs to a Supabase Auth user.
-- Existing rows are assigned to the earliest account (the single owner so far).
ALTER TABLE "initiatives" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
DO $$
DECLARE first_user uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    SELECT id INTO first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF first_user IS NOT NULL THEN
      UPDATE "initiatives" SET "owner_id" = first_user WHERE "owner_id" IS NULL;
      UPDATE "templates" SET "owner_id" = first_user WHERE "owner_id" IS NULL;
    END IF;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "initiatives" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "initiatives_owner_status_idx" ON "initiatives" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "templates_owner_idx" ON "templates" USING btree ("owner_id");--> statement-breakpoint
-- Outside Supabase (local PGlite, plain Postgres) the "authenticated" role and auth.uid() do not
-- exist. Create inert stand-ins only when missing so the policies below can be created everywhere.
-- On Supabase both already exist and this block does nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULL::uuid $f$;
  END IF;
END $$;--> statement-breakpoint
-- Defense in depth for the Supabase REST API (the app itself scopes every query by owner_id):
-- a signed-in user may only touch their own rows through PostgREST.
DROP POLICY IF EXISTS "own initiatives" ON "initiatives";--> statement-breakpoint
CREATE POLICY "own initiatives" ON "initiatives" FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());--> statement-breakpoint
DROP POLICY IF EXISTS "own templates" ON "templates";--> statement-breakpoint
CREATE POLICY "own templates" ON "templates" FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());--> statement-breakpoint
DROP POLICY IF EXISTS "own log_entries" ON "log_entries";--> statement-breakpoint
CREATE POLICY "own log_entries" ON "log_entries" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "initiatives" i WHERE i.id = initiative_id AND i.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "initiatives" i WHERE i.id = initiative_id AND i.owner_id = auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "own tasks" ON "tasks";--> statement-breakpoint
CREATE POLICY "own tasks" ON "tasks" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "initiatives" i WHERE i.id = initiative_id AND i.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "initiatives" i WHERE i.id = initiative_id AND i.owner_id = auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "own initiative_relations" ON "initiative_relations";--> statement-breakpoint
CREATE POLICY "own initiative_relations" ON "initiative_relations" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "initiatives" i WHERE i.id = from_id AND i.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "initiatives" i WHERE i.id = from_id AND i.owner_id = auth.uid()));
