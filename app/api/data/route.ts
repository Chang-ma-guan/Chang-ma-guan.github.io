import { ensureMahjongSchema, getMahjongDb } from "@/db/mahjong";

export async function GET() {
  try {
    await ensureMahjongSchema();
    const db = getMahjongDb();
    const [players, sessions, results] = await Promise.all([
      db.prepare(`SELECT id, name, color, active, created_at AS createdAt
        FROM players ORDER BY active DESC, created_at ASC`).all(),
      db.prepare(`SELECT id, played_at AS playedAt, season, rounds, note, created_at AS createdAt
        FROM game_sessions ORDER BY played_at DESC, created_at DESC`).all(),
      db.prepare(`SELECT id, session_id AS sessionId, player_id AS playerId, amount,
        placement, wins, self_draws AS selfDraws, deals_in AS dealsIn
        FROM game_results`).all(),
    ]);

    return Response.json({
      players: players.results,
      sessions: sessions.results,
      results: results.results,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "讀取資料失敗" }, { status: 500 });
  }
}
