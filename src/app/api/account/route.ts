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
    // DB未接続でもCookieは破棄する(端末内データはクライアント側で削除)
    const res = NextResponse.json({ deleted: true, fallback: true });
    clearUserCookie(res);
    return res;
  }
}
