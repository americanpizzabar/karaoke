import { NextRequest, NextResponse } from "next/server";
import { ensureDbReady, getDb } from "@/lib/db";
import { SEED_SONGS } from "@/data/songs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  try {
    await ensureDbReady();
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
  } catch {
    // DB未設定・接続不可でも曲リストは同梱の初期データで提供する
    // idは元配列のindexで採番(検索条件でidが変わらないようfilterより先にmap)
    const needle = q.toLowerCase();
    const songs = SEED_SONGS.map((s, i) => ({
      id: `seed-${i}`,
      title: s.title,
      artist: s.artist,
      chestMax: s.chestMax,
      falsettoMax: s.falsettoMax ?? null,
      lowest: s.lowest ?? null,
      originalKey: s.originalKey ?? null,
      isVerified: false,
    }))
      .filter(
        (s) =>
          !needle ||
          s.title.toLowerCase().includes(needle) ||
          s.artist.toLowerCase().includes(needle)
      )
      .sort(
        (a, b) =>
          a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
      );
    return NextResponse.json({ songs, fallback: true });
  }
}
