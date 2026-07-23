import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { attachUserCookie, resolveUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await resolveUser(req);
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);
  const rows = await getDb().execute({
    sql: `select id, chest_low, chest_high, falsetto_high, measured_at
          from range_records where user_id = ?
          order by measured_at desc, rowid desc limit ?`,
    args: [session.userId, limit],
  });
  const res = NextResponse.json({
    records: rows.rows.map((r) => ({
      id: r.id,
      chestLow: r.chest_low,
      chestHigh: r.chest_high,
      falsettoHigh: r.falsetto_high,
      measuredAt: r.measured_at,
    })),
  });
  if (session.isNew) attachUserCookie(res, session.userId);
  return res;
}

export async function POST(req: NextRequest) {
  const session = await resolveUser(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const norm = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 20 && n <= 100 ? Math.round(n) : null;
  };
  const chestLow = norm(body.chestLow);
  const chestHigh = norm(body.chestHigh);
  const falsettoHigh = norm(body.falsettoHigh);
  if (chestLow === null && chestHigh === null && falsettoHigh === null) {
    return NextResponse.json({ error: "empty record" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await getDb().execute({
    sql: `insert into range_records (id, user_id, chest_low, chest_high, falsetto_high)
          values (?, ?, ?, ?, ?)`,
    args: [id, session.userId, chestLow, chestHigh, falsettoHigh],
  });
  const res = NextResponse.json({ id, chestLow, chestHigh, falsettoHigh }, { status: 201 });
  if (session.isNew) attachUserCookie(res, session.userId);
  return res;
}
