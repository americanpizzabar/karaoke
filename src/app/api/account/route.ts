import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clearUserCookie, resolveUser } from "@/lib/auth";

export const runtime = "nodejs";

/** ユーザーデータの全削除(設定画面「データ削除」) */
export async function DELETE(req: NextRequest) {
  try {
    const session = await resolveUser(req);
    const db = getDb();
    await db.batch(
      [
        { sql: "delete from range_records where user_id = ?", args: [session.userId] },
        { sql: "delete from training_logs where user_id = ?", args: [session.userId] },
        { sql: "delete from users where id = ?", args: [session.userId] },
      ],
      "write"
    );
    const res = NextResponse.json({ deleted: true });
    clearUserCookie(res);
    return res;
  } catch {
    // DB未接続時に「成功」を返すとサーバー上の履歴が残ったまま
    // Cookieだけ消えて孤立するため、失敗として返す。
    // (端末内データの削除はクライアント側で行う)
    return NextResponse.json(
      { error: "db unavailable", fallback: true },
      { status: 503 }
    );
  }
}
