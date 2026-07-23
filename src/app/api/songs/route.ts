import { NextRequest, NextResponse } from "next/server";
import { ensureDbReady, getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureDbReady();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const like = `%${q}%`;
  const rows = q
    ? await getDb().execute({
        sql: `select * from songs where title like ? or artist like ?
              order by artist, title limit 300`,
        args: [like, like],
      })
    : await getDb().execute(
        "select * from songs order by artist, title limit 300"
      );
  return NextResponse.json({
    songs: rows.rows.map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      chestMax: r.chest_max,
      falsettoMax: r.falsetto_max,
      lowest: r.lowest,
      originalKey: r.original_key,
      isVerified: Number(r.is_verified) === 1,
    })),
  });
}
