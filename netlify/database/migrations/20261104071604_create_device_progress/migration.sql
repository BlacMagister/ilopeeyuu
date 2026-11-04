CREATE TABLE "device_progress" (
	"device_id" text PRIMARY KEY,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
