import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#167c5a"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const gameSessions = sqliteTable(
  "game_sessions",
  {
    id: text("id").primaryKey(),
    playedAt: text("played_at").notNull(),
    season: text("season").notNull().default("本季"),
    rounds: integer("rounds").notNull().default(1),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_game_sessions_played_at").on(table.playedAt)],
);

export const gameResults = sqliteTable(
  "game_results",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull().references(() => players.id),
    amount: integer("amount").notNull(),
    placement: integer("placement").notNull(),
    wins: integer("wins").notNull().default(0),
    selfDraws: integer("self_draws").notNull().default(0),
    dealsIn: integer("deals_in").notNull().default(0),
  },
  (table) => [
    uniqueIndex("idx_game_results_session_player").on(table.sessionId, table.playerId),
    index("idx_game_results_player_id").on(table.playerId),
  ],
);
