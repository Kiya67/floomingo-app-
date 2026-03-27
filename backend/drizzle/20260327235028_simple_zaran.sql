ALTER TABLE "experiences" ADD COLUMN "location_id" text;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "location_name" text;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "likes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;