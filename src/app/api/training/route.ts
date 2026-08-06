import { NextRequest, NextResponse } from "next/server";
import { ensureDbReady, getDb } from "@/lib/db";
import { attachUserCookie, readUserId, resolveUser } from "@/lib/auth";

export const runtime = "nodejs";

const MENUS = ["liproll", "longtone", "challenge", "falsetto_slide"] as const;

export async function GET(req: NextRequest) {
  // 読み取りではIDを発行しない(発行するとCookieの競合でデータが迷子になる)
  const userId = readUserId(req);
  if (!userId) return NextResponse.json({ logs: [] });
  try {
    await ensureDbReady();
    const rows = await getDb().execute({
      sql: `select id, menu, target_note, achieved, stability_cents, done_at
            from training_logs where user_id = ?
            order by done_at desc, rowid desc limit 200`,
      args: [userId],
    });
    return NextResponse.json({
      logs: rows.rows.map((r) => ({
        id: r.id,
        menu: r.menu,
        targetNote: r.target_note,
        achieved: r.achieved === null ? null : Number(r.achieved) === 1,
        stabilityCents: r.stability_cents,
        doneAt: r.done_at,
      })),
    });
  } catch {
    // DB未接続時はクライアントが端末内保存(localStorage)へフォールバックする
    return NextResponse.json({ logs: [], fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !MENUS.includes(body.menu)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  try {
    const session = await resolveUser(req);
    const id = crypto.randomUUID();
    const targetNote = Number.isFinite(Number(body.targetNote)) ? Math.round(Number(body.targetNote)) : null;
    const stability = Number.isFinite(Number(body.stabilityCents)) ? Number(body.stabilityCents) : null;
    await getDb().execute({
      sql: `insert into training_logs (id, user_id, menu, target_note, achieved, stability_cents)
            values (?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        session.userId,
        body.menu,
        targetNote,
        typeof body.achieved === "boolean" ? (body.achieved ? 1 : 0) : null,
        stability,
      ],
    });
    const res = NextResponse.json({ id }, { status: 201 });
    if (session.isNew) attachUserCookie(res, session.userId);
    return res;
  } catch {
    return NextResponse.json(
      { error: "db unavailable", fallback: true },
      { status: 503 }
    );
  }
}
