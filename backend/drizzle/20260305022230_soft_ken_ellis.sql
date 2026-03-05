CREATE TABLE "post_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"place_id" text NOT NULL,
	"place_name" text NOT NULL,
	"location_type" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "place_name" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "location_type" text;