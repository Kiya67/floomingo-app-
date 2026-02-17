CREATE TABLE "post_stats" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"view_count" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"caption" text NOT NULL,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"place_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
