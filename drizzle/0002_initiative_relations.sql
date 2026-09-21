CREATE TYPE "public"."relation_kind" AS ENUM('blocked_by', 'related');--> statement-breakpoint
CREATE TABLE "initiative_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"kind" "relation_kind" DEFAULT 'blocked_by' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_relations_no_self" CHECK ("initiative_relations"."from_id" <> "initiative_relations"."to_id")
);
--> statement-breakpoint
ALTER TABLE "initiative_relations" ADD CONSTRAINT "initiative_relations_from_id_initiatives_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."initiatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_relations" ADD CONSTRAINT "initiative_relations_to_id_initiatives_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."initiatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "initiative_relations_unique_idx" ON "initiative_relations" USING btree ("from_id","to_id","kind");--> statement-breakpoint
CREATE INDEX "initiative_relations_to_idx" ON "initiative_relations" USING btree ("to_id");--> statement-breakpoint
-- Same posture as the other tables: no policies, so the public API exposes nothing.
ALTER TABLE "initiative_relations" ENABLE ROW LEVEL SECURITY;
