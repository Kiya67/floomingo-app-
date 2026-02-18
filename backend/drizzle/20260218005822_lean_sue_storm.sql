CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"display_name" text,
	"avatar_url" text,
	"bio_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
