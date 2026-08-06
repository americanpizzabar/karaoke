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
  components/     SegmentDisplay(14セグ表示), TunerFace(チューナーフェイス),
                  ChannelStrip(縦型LEDラダー), Nameplate(銘板+シェア画像),
                  BootSequence(起動シーケンス), Nav
  hooks/          usePitchDetector(マイク+自己相関ピッチ検出)
  lib/            notes(カラオケ表記変換), pitch, keyAdvice, dates, db(Turso), auth
  data/           初期曲データ(参考値)
  store/          Zustandストア(サーバー未接続時はlocalStorageフォールバック)
public/           PWA manifest / Service Worker / アイコン
```

## 動作モード

| モード | 条件 | 曲リスト | 測定履歴・トレーニングログ |
|---|---|---|---|
| サーバー | Turso が正しく設定済み | DB | DB(端末をまたいで共有可) |
| ローカル | Turso 未設定・接続不可 | 同梱の初期データ | 端末内(localStorage) |

ローカルモードでも全画面・全機能が動作する。測定結果画面には
`LOCAL — この端末内に保存しました` と表示される。

## ピッチ検出の設計値

| 項目 | 値 | 理由 |
|---|---|---|
| 検出範囲 | 55〜1200Hz | lowlowA(A1)まで測れるようにするため |
| 解析窓 | 4096サンプル(48kHzで約85ms) | 55Hzでも4周期以上入る長さ |
| 内部間引き | 1/2(24kHz相当) | ピッチ帯域には十分で、自己相関の計算量が約1/4になる |
| 解析頻度 | 約30Hz | 声の変化はこれで追えて、描画に余裕が残る |

合成音声(4種の倍音構成 × ノイズ/ビブラート × lowlowA〜hihiC、2496ケース)で
検出率99.9%・オクターブ誤り0件を確認している。

## 既知の制約(MVP)

- 曲データは音域まとめサイト等の**参考値**(`is_verified=0`)。検証フローはPhase 2
- 地声/裏声の自動判別は未実装(仕様 2.3.2 = Phase 2)
- 騒音環境では誤検出の可能性あり。静かな場所での測定を推奨
