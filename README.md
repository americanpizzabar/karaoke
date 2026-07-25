# 音域アタック

「音程は取れるのに、高音が出ないせいで歌えない曲がある」を解決するカラオケ攻略PWA。

1. **知る** — 自分の音域(地声・裏声)をマイクで測定
2. **今夜歌える** — 歌いたい曲への最適キーを根拠付きで提案
3. **いつか原キーで歌える** — 音域データに基づくトレーニングで高音を伸ばす

## 技術スタック

| レイヤ | 技術 |
|---|---|
| フロントエンド | Next.js (App Router) + TypeScript / Zustand / Recharts |
| 音声処理 | Web Audio API(自己相関法ピッチ検出・OscillatorNodeガイド音)— 完全クライアント内処理 |
| データベース | **Turso (libSQL)** — ユーザー音域履歴・曲DB・トレーニングログ |
| 認証 | 署名付きCookieによる匿名ユーザー(メール/ソーシャル昇格はPhase 2) |
| ホスティング | Vercel(マイクアクセスにHTTPS必須) |

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Turso の設定

```bash
# DB作成
turso db create onikiattack
turso db show onikiattack --url        # → TURSO_DATABASE_URL
turso db tokens create onikiattack     # → TURSO_AUTH_TOKEN
```

`.env.local`(Vercel の場合は Project Settings → Environment Variables)に設定:

```
TURSO_DATABASE_URL="libsql://<turso db show で表示された実際のURL>"
TURSO_AUTH_TOKEN="<turso db tokens create で発行された実際のトークン>"
AUTH_SECRET="ランダムな長い文字列"
```

> **注意:** `<org>` などのプレースホルダをそのまま貼り付けないでください。
> `turso db show onikiattack --url` の出力(実際のURL)をそのまま設定します。

- **Turso 未設定でもアプリは動作します(ローカルモード)。** 曲リストは同梱データから提供され、測定記録・トレーニングログは端末内(localStorage)に保存されます。複数端末での履歴共有が必要な場合のみ Turso を設定してください。
- ローカル開発では環境変数未設定時に `file:local.db`(ローカルSQLiteファイル)へフォールバックします。
- スキーマ作成と初期曲データ(約45曲・参考値)の投入は初回アクセス時に自動実行されます。

## プライバシー

- 音声波形は**保存・送信しない**。ピッチ検出はすべて端末内で完結
- サーバーに保存するのは音名(MIDIノート番号)とトレーニング結果のみ
- 設定画面から全データ削除が可能

## ディレクトリ構成

```
src/
  app/            画面(ホーム/測定/曲攻略/トレーニング/進捗/設定)+ APIルート
  components/     Nav, PitchMeter(縦型LEDメーター)など
  hooks/          usePitchDetector(マイク+自己相関ピッチ検出)
  lib/            notes(カラオケ表記変換), pitch, keyAdvice, db(Turso), auth
  data/           初期曲データ(参考値)
  store/          Zustandストア
public/           PWA manifest / Service Worker / アイコン
```

## 既知の制約(MVP)

- 曲データは音域まとめサイト等の**参考値**(`is_verified=0`)。検証フローはPhase 2
- 地声/裏声の自動判別は未実装(仕様 2.3.2 = Phase 2)
- 騒音環境では誤検出の可能性あり。静かな場所での測定を推奨
