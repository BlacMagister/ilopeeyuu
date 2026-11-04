CREATE TABLE "bucket_items" (
	"id" serial PRIMARY KEY,
	"text" text NOT NULL,
	"emoji" text DEFAULT '✨' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "love_notes" (
	"id" serial PRIMARY KEY,
	"body" text NOT NULL,
	"color" text DEFAULT 'pink' NOT NULL,
	"sticker" text DEFAULT '💌' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_log" (
	"day" text PRIMARY KEY,
	"mood" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_counters" (
	"key" text PRIMARY KEY,
	"value" integer DEFAULT 0 NOT NULL
);
