import { pgTable, text, integer, boolean, jsonb, timestamp, serial, uniqueIndex, index } from "drizzle-orm/pg-core";

/** A multiplayer "Duel Kanji" room. Server is the single source of truth for phase + timers. */
export const duelRooms = pgTable("duel_rooms", {
  code: text().primaryKey(),
  hostId: text("host_id").notNull(),
  // lobby | countdown | question | reveal | finished
  status: text().notNull().default("lobby"),
  settings: jsonb().notNull(),
  questions: jsonb().notNull().default([]),
  qIndex: integer("q_index").notNull().default(-1),
  phaseStartedAt: timestamp("phase_started_at", { precision: 3, withTimezone: true }),
  phaseEndsAt: timestamp("phase_ends_at", { precision: 3, withTimezone: true }),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true }).notNull().defaultNow(),
});

export const duelPlayers = pgTable(
  "duel_players",
  {
    id: text().primaryKey(),
    roomCode: text("room_code").notNull().references(() => duelRooms.code, { onDelete: "cascade" }),
    token: text().notNull(),
    name: text().notNull(),
    avatar: text().notNull(),
    score: integer().notNull().default(0),
    streak: integer().notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    lastSeen: timestamp("last_seen", { precision: 3, withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { precision: 3, withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("duel_players_room_idx").on(t.roomCode)]
);

export const duelAnswers = pgTable(
  "duel_answers",
  {
    id: serial().primaryKey(),
    roomCode: text("room_code").notNull().references(() => duelRooms.code, { onDelete: "cascade" }),
    playerId: text("player_id").notNull().references(() => duelPlayers.id, { onDelete: "cascade" }),
    qIndex: integer("q_index").notNull(),
    choice: integer().notNull(),
    correct: boolean().notNull(),
    points: integer().notNull(),
    ms: integer().notNull(),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("duel_answers_once_idx").on(t.roomCode, t.playerId, t.qIndex)]
);
