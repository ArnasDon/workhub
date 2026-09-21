CREATE TYPE "public"."initiative_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."initiative_status" AS ENUM('idea', 'in_progress', 'blocked', 'waiting', 'done', 'archived');--> statement-breakpoint
CREATE TABLE "initiatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"status" "initiative_status" DEFAULT 'idea' NOT NULL,
	"priority" "initiative_priority" DEFAULT 'medium' NOT NULL,
	"target_date" date,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initiative_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_initiative_id_initiatives_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiatives_status_idx" ON "initiatives" USING btree ("status");--> statement-breakpoint
CREATE INDEX "initiatives_area_idx" ON "initiatives" USING btree ("area");--> statement-breakpoint
CREATE INDEX "initiatives_updated_at_idx" ON "initiatives" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "log_entries_initiative_created_idx" ON "log_entries" USING btree ("initiative_id","created_at");