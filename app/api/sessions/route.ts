import { ensureMahjongSchema, getMahjongDb } from "@/db/mahjong";

type SessionResultInput = {
  playerId?: string;
  amount?: number;
  wins?: number;
  selfDraws?: number;
  dealsIn?: number;
};

type SessionInput = {
  id?: string;
  playedAt?: string;
  season?: string;
  rounds?: number;
  note?: string;
  results?: SessionResultInput[];
};

function validate(body: SessionInput) {
  const playedAt = body.playedAt?.trim();
  const season = body.season?.trim() || "本季";
  const results = body.results ?? [];
  if (!playedAt) throw new Error("請選擇日期");
  if (results.length !== 4) throw new Error("每筆紀錄需要 4 位成員");
  if (new Set(results.map((item) => item.playerId)).size !== 4 || results.some((item) => !item.playerId)) {
    throw new Error("請選擇 4 位不同的成員");
  }
  if (results.some((item) => !Number.isFinite(Number(item.amount)))) throw new Error("請填寫每位成員的輸贏金額");
  if (results.reduce((sum, item) => sum + Number(item.amount), 0) !== 0) throw new Error("四位成員的輸贏加總必須為 0");
  return { playedAt, season, results, rounds: Math.max(1, Number(body.rounds) || 1), note: body.note?.trim() ?? "" };
}

async function save(request: Request, editing: boolean) {
  try {
    await ensureMahjongSchema();
    const body = (await request.json()) as SessionInput;
    const clean = validate(body);
    const db = getMahjongDb();
    const id = editing ? body.id : crypto.randomUUID();
    if (!id) return Response.json({ error: "缺少紀錄編號" }, { status: 400 });

    const sorted = [...clean.results].sort((a, b) => Number(b.amount) - Number(a.amount));
    const ranks = new Map(sorted.map((item, index) => [item.playerId!, index + 1]));
    const statements = editing
      ? [
          db.prepare("UPDATE game_sessions SET played_at = ?, season = ?, rounds = ?, note = ? WHERE id = ?")
            .bind(clean.playedAt, clean.season, clean.rounds, clean.note, id),
          db.prepare("DELETE FROM game_results WHERE session_id = ?").bind(id),
        ]
      : [db.prepare("INSERT INTO game_sessions (id, played_at, season, rounds, note) VALUES (?, ?, ?, ?, ?)")
          .bind(id, clean.playedAt, clean.season, clean.rounds, clean.note)];

    for (const result of clean.results) {
      statements.push(db.prepare(`INSERT INTO game_results
        (id, session_id, player_id, amount, placement, wins, self_draws, deals_in)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), id, result.playerId, Number(result.amount), ranks.get(result.playerId!) ?? 4,
          Math.max(0, Number(result.wins) || 0), Math.max(0, Number(result.selfDraws) || 0), Math.max(0, Number(result.dealsIn) || 0)));
    }

    await db.batch(statements);
    return Response.json({ id }, { status: editing ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存紀錄失敗";
    return Response.json({ error: message }, { status: message.includes("請") || message.includes("必須") ? 400 : 500 });
  }
}

export async function POST(request: Request) { return save(request, false); }
export async function PUT(request: Request) { return save(request, true); }

export async function DELETE(request: Request) {
  try {
    await ensureMahjongSchema();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "缺少紀錄編號" }, { status: 400 });
    const db = getMahjongDb();
    await db.batch([
      db.prepare("DELETE FROM game_results WHERE session_id = ?").bind(id),
      db.prepare("DELETE FROM game_sessions WHERE id = ?").bind(id),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "刪除紀錄失敗" }, { status: 500 });
  }
}
