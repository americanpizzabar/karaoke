import { createClient, type Client } from "@libsql/client";
import { SEED_SONGS } from "@/data/songs";

// Turso (libSQL)。環境変数未設定時はローカルファイルにフォールバック(開発用)。
function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({ url, authToken });
}

const globalForDb = globalThis as unknown as {
  __db?: Client;
  __dbReady?: Promise<void>;
};

export function getDb(): Client {
  if (!globalForDb.__db) globalForDb.__db = makeClient();
  return globalForDb.__db;
}

async function initSchema(db: Client): Promise<void> {
  await db.batch(
    [
      `create table if not exists users (
        id         text primary key,
        created_at text not null default (datetime('now'))
      )`,
      `create table if not exists range_records (
        id            text primary key,
        user_id       text not null references users(id),
        chest_low     integer,
        chest_high    integer,
        falsetto_high integer,
        measured_at   text not null default (datetime('now'))
      )`,
      `create table if not exists songs (
        id           text primary key,
        title        text not null,
        artist       text not null,
        chest_max    integer not null,
        falsetto_max integer,
        lowest       integer,
        original_key text,
        is_verified  integer not null default 0,
        created_at   text not null default (datetime('now'))
      )`,
      `create table if not exists training_logs (
        id              text primary key,
        user_id         text not null references users(id),
        menu            text not null,
        target_note     integer,
        achieved        integer,
        stability_cents real,
        done_at         text not null default (datetime('now'))
      )`,
      `create index if not exists idx_range_user on range_records(user_id, measured_at)`,
      `create index if not exists idx_training_user on training_logs(user_id, done_at)`,
    ],
    "write"
  );

  const count = await db.execute("select count(*) as c from songs");
  if (Number(count.rows[0].c) === 0) {
    await db.batch(
      SEED_SONGS.map((s) => ({
        sql: `insert into songs (id, title, artist, chest_max, falsetto_max, lowest, original_key, is_verified)
              values (?, ?, ?, ?, ?, ?, ?, 0)`,
        args: [
          crypto.randomUUID(),
          s.title,
          s.artist,
          s.chestMax,
          s.falsettoMax ?? null,
          s.lowest ?? null,
          s.originalKey ?? null,
        ],
      })),
      "write"
    );
  }
}

/** スキーマ作成+初期曲データ投入(プロセスにつき1回) */
export function ensureDbReady(): Promise<void> {
  if (!globalForDb.__dbReady) {
    globalForDb.__dbReady = initSchema(getDb()).catch((e) => {
      globalForDb.__dbReady = undefined;
      throw e;
    });
  }
  return globalForDb.__dbReady;
}
