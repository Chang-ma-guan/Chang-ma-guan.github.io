import { env } from "cloudflare:workers";

let schemaReady: Promise<void> | null = null;

export function getMahjongDb(): D1Database {
  if (!env.DB) {
    throw new Error("麻將帳本資料庫目前無法使用，請稍後再試。");
  }
  return env.DB;
}

export async function ensureMahjongSchema() {
  if (!schemaReady) {
    schemaReady = initializeSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function initializeSchema() {
  const db = getMahjongDb();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#167c5a',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      played_at TEXT NOT NULL,
      season TEXT NOT NULL DEFAULT '本季',
      rounds INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS game_results (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id),
      amount INTEGER NOT NULL,
      placement INTEGER NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      self_draws INTEGER NOT NULL DEFAULT 0,
      deals_in INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_game_sessions_played_at ON game_sessions(played_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_game_results_session_player ON game_results(session_id, player_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_game_results_player_id ON game_results(player_id)"),
  ]);
}
