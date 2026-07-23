import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { ensureDbReady, getDb } from "./db";

// 匿名認証: 署名付きCookieで匿名ユーザーIDを保持する。
// (Supabase匿名認証の置き換え。メール/ソーシャル昇格はPhase 2以降)

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

/** リクエストのCookieから匿名ユーザーIDを取得(なければ新規発行しDBに登録) */
export async function resolveUser(req: NextRequest): Promise<UserSession> {
  await ensureDbReady();
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (raw) {
    const id = verify(raw);
    if (id) return { userId: id, isNew: false };
  }
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
