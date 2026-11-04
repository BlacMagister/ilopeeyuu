CREATE TABLE "duel_answers" (
	"id" serial PRIMARY KEY,
	"room_code" text NOT NULL,
	"player_id" text NOT NULL,
	"q_index" integer NOT NULL,
	"choice" integer NOT NULL,
	"correct" boolean NOT NULL,
	"points" integer NOT NULL,
	"ms" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duel_players" (
	"id" text PRIMARY KEY,
	"room_code" text NOT NULL,
	"token" text NOT NULL,
	"name" text NOT NULL,
	"avatar" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"last_seen" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duel_rooms" (
	"code" text PRIMARY KEY,
	"host_id" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"settings" jsonb NOT NULL,
	"questions" jsonb DEFAULT '[]' NOT NULL,
	"q_index" integer DEFAULT -1 NOT NULL,
	"phase_started_at" timestamp(3) with time zone,
	"phase_ends_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "duel_answers_once_idx" ON "duel_answers" ("room_code","player_id","q_index");--> statement-breakpoint
CREATE INDEX "duel_players_room_idx" ON "duel_players" ("room_code");--> statement-breakpoint
ALTER TABLE "duel_answers" ADD CONSTRAINT "duel_answers_room_code_duel_rooms_code_fkey" FOREIGN KEY ("room_code") REFERENCES "duel_rooms"("code") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "duel_answers" ADD CONSTRAINT "duel_answers_player_id_duel_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "duel_players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "duel_players" ADD CONSTRAINT "duel_players_room_code_duel_rooms_code_fkey" FOREIGN KEY ("room_code") REFERENCES "duel_rooms"("code") ON DELETE CASCADE;