import { ensureMahjongSchema, getMahjongDb } from "@/db/mahjong";

const colors = ["#167c5a", "#e6533f", "#e7ae35", "#5f72c9", "#bf4d80", "#64748b", "#0f9db2", "#8b62b3"];

export async function POST(request: Request) {
  try {
    await ensureMahjongSchema();
    const body = (await request.json()) as { name?: string; color?: string };
    const name = body.name?.trim();
    if (!name) return Response.json({ error: "請輸入成員名稱" }, { status: 400 });

    const db = getMahjongDb();
    const existing = await db.prepare("SELECT COUNT(*) AS count FROM players").first<{ count: number }>();
    const id = crypto.randomUUID();
    const color = /^#[0-9a-fA-F]{6}$/.test(body.color ?? "")
      ? body.color!
      : colors[Number(existing?.count ?? 0) % colors.length];
    await db.prepare("INSERT INTO players (id, name, color) VALUES (?, ?, ?)").bind(id, name, color).run();
    return Response.json({ player: { id, name, color, active: 1 } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "新增成員失敗" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureMahjongSchema();
    const body = (await request.json()) as { id?: string; name?: string; color?: string; active?: boolean };
    const name = body.name?.trim();
    if (!body.id || !name) return Response.json({ error: "成員資料不完整" }, { status: 400 });
    if (!/^#[0-9a-fA-F]{6}$/.test(body.color ?? "")) return Response.json({ error: "顏色格式錯誤" }, { status: 400 });

    const db = getMahjongDb();
    await db.prepare("UPDATE players SET name = ?, color = ?, active = ? WHERE id = ?")
      .bind(name, body.color, body.active === false ? 0 : 1, body.id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "更新成員失敗" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureMahjongSchema();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "缺少成員編號" }, { status: 400 });

    const db = getMahjongDb();
    const used = await db.prepare("SELECT COUNT(*) AS count FROM game_results WHERE player_id = ?").bind(id).first<{ count: number }>();
    if ((used?.count ?? 0) > 0) {
      await db.prepare("UPDATE players SET active = 0 WHERE id = ?").bind(id).run();
    } else {
      await db.prepare("DELETE FROM players WHERE id = ?").bind(id).run();
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "移除成員失敗" }, { status: 500 });
  }
}
