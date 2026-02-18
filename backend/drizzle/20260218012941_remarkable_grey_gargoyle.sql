ALTER TABLE "profiles" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "bio_url";