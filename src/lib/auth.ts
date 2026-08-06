import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { ensureDbReady, getDb } from "./db";

// 匿名認証: 署名付きCookieで匿名ユーザーIDを保持する。
// (Supabase匿名認証の置き換え。メール/ソーシャル昇格はPhase 2以降)
//
// 重要: 新規IDの発行は「書き込み時だけ」に限る。
// 読み取り(GET)でも発行していた頃は、Cookie未取得の状態で複数のAPIが
// 同時に走ると各レスポンスが別々のIDを Set-Cookie し、最後に届いた
// レスポンスのIDが勝つ。その結果、直前に保存したデータが別IDの下に
// 取り残されて「測定したのに履歴が空」になっていた。

const COOKIE_NAME = "oa_uid";
const SECRET = process.env.AUTH_SECRET ?? "onikiattack-dev-secret";

function sign(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("hex");
}

function verify(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  try {
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return id;
  } catch {
    /* fallthrough */
  }
  return null;
}

export interface UserSession {
  userId: string;
  isNew: boolean;
}

/**
 * Cookieから既存の匿名ユーザーIDを読む。副作用なし(発行もDB書き込みもしない)。
 * 読み取り系のAPIはこちらを使い、未取得なら「データなし」を返す。
 */
export function readUserId(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  return raw ? verify(raw) : null;
}

/**
 * 書き込み系のAPI用。既存IDがあればそれを返し、なければ新規発行してDBに登録する。
 * 呼び出し側は isNew のとき attachUserCookie でCookieを載せること。
 */
export async function resolveUser(req: NextRequest): Promise<UserSession> {
  await ensureDbReady();
  const existing = readUserId(req);
  if (existing) return { userId: existing, isNew: false };
  const id = crypto.randomUUID();
  await getDb().execute({
    sql: "insert or ignore into users (id) values (?)",
    args: [id],
  });
  return { userId: id, isNew: true };
}

/** 新規発行したユーザーIDをレスポンスCookieに載せる */
export function attachUserCookie(res: NextResponse, userId: string): void {
  res.cookies.set(COOKIE_NAME, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 2, // 2年
    path: "/",
  });
}

export function clearUserCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
