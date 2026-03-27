ALTER TABLE "experiences" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "duration" integer;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;