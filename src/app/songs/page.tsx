"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { judgeKey, type KeyAdvice } from "@/lib/keyAdvice";
import { midiToKaraoke } from "@/lib/notes";
import { effectiveChestLow } from "@/lib/range";
import { SegmentDisplay } from "@/components/SegmentDisplay";
import {
  fetchRangeHistory,
  fetchSongs,
  useAppStore,
  type Song,
} from "@/store/useAppStore";

const LEVEL_BADGE: Record<KeyAdvice["level"], string> = {
  easy: "badge-easy",
  edge: "badge-edge",
  shift: "badge-shift",
  octave: "badge-octave",
};

export default function SongsPage() {
  return (
    <Suspense fallback={null}>
      <SongsView />
    </Suspense>
  );
}

function SongsView() {
  const latest = useAppStore((s) => s.latestRange);
  const songs = useAppStore((s) => s.songs);
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<Song | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([fetchRangeHistory(), fetchSongs()]).then(() =>
      setLoaded(true)
    );
  }, []);

  const filtered = useMemo(() => {
    if (!songs) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.artist.toLowerCase().includes(needle)
    );
  }, [songs, q]);

  const chestHigh = latest?.chestHigh ?? null;

  return (
    <main>
      <div className="etch-label" style={{ margin: "4px 0 14px" }}>
        SONG PATCH BAY
      </div>
      <h1 className="page-title">曲攻略</h1>

      {chestHigh === null && loaded && (
        <section className="card">
          <p>
            音域データがありません。
            <Link href="/measure" style={{ color: "var(--phosphor-amber)" }}>
              先に音域を測定
            </Link>
            すると、あなた専用のキー判定が表示されます。
          </p>
        </section>
      )}

      <input
        className="input"
        type="search"
        placeholder="曲名・アーティストで検索"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="曲検索"
        style={{ marginBottom: 12 }}
      />

      {selected && (
        <SongDetail
          song={selected}
          chestLow={latest?.chestLow ?? null}
          chestHigh={chestHigh}
          falsettoHigh={latest?.falsettoHigh ?? null}
          onClose={() => setSelected(null)}
        />
      )}

      <section className="card" style={{ padding: "4px 12px" }}>
        {!loaded && <p className="muted" style={{ padding: 12 }}>読み込み中...</p>}
        {loaded && filtered.length === 0 && (
          <p className="muted" style={{ padding: 12 }}>
            該当する曲がありません。
          </p>
        )}
        {filtered.map((s) => {
          const advice = chestHigh !== null ? judgeKey(chestHigh, s.chestMax) : null;
          return (
            <button
              key={s.id}
              className="song-row"
              onClick={() => {
                setSelected(s);
                // 詳細パネルはリスト上部に出るため、見える位置までスクロール
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </strong>
                <span className="muted">
                  {s.artist} ・ 地声最高 {midiToKaraoke(s.chestMax)}
                </span>
              </span>
              {advice && (
                <span className={`badge ${LEVEL_BADGE[advice.level]}`}>
                  {advice.level === "easy" && "OK"}
                  {advice.level === "edge" && "EDGE"}
                  {advice.level === "shift" && `KEY ${advice.keyShift}`}
                  {advice.level === "octave" && "OCT"}
                </span>
              )}
            </button>
          );
        })}
      </section>

      <p className="muted" style={{ fontSize: 11 }}>
        曲の音域データは参考値です。実際の楽曲と異なる場合があります。
      </p>
    </main>
  );
}

/**
 * パッチベイ: 曲の要求音域(グレーのブラケット)に自分の音域(amber/cyan)を重ね、
 * 届いていない区間だけ signal-red の細線(仕様書 S4)。
 */
function PatchBay({
  song,
  chestLow: rawChestLow,
  chestHigh,
  falsettoHigh,
}: {
  song: Song;
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
}) {
  // 最低音が未測定でも自分の音域バーが消えないよう補完する
  const chestLow = effectiveChestLow(rawChestLow, chestHigh);
  const songLow = song.lowest ?? song.chestMax - 14;
  const songHigh = Math.max(song.chestMax, song.falsettoMax ?? song.chestMax);
  const lo =
    Math.min(songLow, chestLow ?? songLow) - 2;
  const hi =
    Math.max(songHigh, falsettoHigh ?? chestHigh ?? songHigh) + 2;
  const W = 320;
  const x = (n: number) => ((n - lo) / (hi - lo)) * (W - 16) + 8;

  const ticks = [];
  for (let n = Math.ceil(lo); n <= hi; n++) {
    const long = n % 12 === 0;
    ticks.push(
      <line
        key={n}
        x1={x(n)}
        y1={64}
        x2={x(n)}
        y2={long ? 56 : 60}
        stroke="var(--groove)"
        strokeWidth={1}
      />
    );
    if (long) {
      // 端の目盛りラベルが図の外にはみ出して欠けないよう寄せる
      const px = x(n);
      const anchor = px < 26 ? "start" : px > W - 26 ? "end" : "middle";
      ticks.push(
        <text
          key={`t-${n}`}
          x={anchor === "start" ? 2 : anchor === "end" ? W - 2 : px}
          y={76}
          textAnchor={anchor}
          fill="var(--etch)"
          fontSize={8.5}
          fontFamily="var(--font-data)"
        >
          {midiToKaraoke(n)}
        </text>
      );
    }
  }

  // 届いていない区間(高域)
  const userHigh = falsettoHigh ?? chestHigh;
  const gapStart =
    userHigh !== null && songHigh > userHigh ? userHigh : null;

  return (
    <svg
      viewBox={`0 0 ${W} 80`}
      style={{ width: "100%", display: "block", marginTop: 12 }}
      role="img"
      aria-label="曲の要求音域と自分の音域の比較"
    >
      {/* 曲の要求音域: グレーのブラケット */}
      <line x1={x(songLow)} y1={16} x2={x(songHigh)} y2={16} stroke="var(--etch)" strokeWidth={1} />
      <line x1={x(songLow)} y1={11} x2={x(songLow)} y2={21} stroke="var(--etch)" strokeWidth={1} />
      <line x1={x(songHigh)} y1={11} x2={x(songHigh)} y2={21} stroke="var(--etch)" strokeWidth={1} />
      <text x={x(songLow)} y={8} fill="var(--etch)" fontSize={8.5} fontFamily="var(--font-body)" letterSpacing={1}>
        SONG
      </text>

      {/* 自分の音域: amber(地声)/ cyan(裏声) */}
      {chestLow !== null && chestHigh !== null && (
        <rect
          x={x(chestLow)}
          y={30}
          width={Math.max(2, x(chestHigh) - x(chestLow))}
          height={8}
          rx={2}
          fill="var(--phosphor-amber)"
          filter="url(#seg-glow)"
        />
      )}
      {chestHigh !== null && falsettoHigh !== null && falsettoHigh > chestHigh && (
        <rect
          x={x(chestHigh)}
          y={30}
          width={Math.max(2, x(falsettoHigh) - x(chestHigh))}
          height={8}
          rx={2}
          fill="var(--phosphor-cyan)"
          fillOpacity={0.85}
        />
      )}
      {/* 届いていない区間: signal-red の細線(グローは二重線で表現) */}
      {gapStart !== null && (
        <>
          <line
            x1={x(gapStart)}
            y1={34}
            x2={x(songHigh)}
            y2={34}
            stroke="var(--signal-red)"
            strokeOpacity={0.3}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <line
            x1={x(gapStart)}
            y1={34}
            x2={x(songHigh)}
            y2={34}
            stroke="var(--signal-red)"
            strokeWidth={1.5}
          />
        </>
      )}
      <text x={8} y={50} fill="var(--etch)" fontSize={8.5} fontFamily="var(--font-body)" letterSpacing={1}>
        YOU
      </text>
      {ticks}
    </svg>
  );
}

function SongDetail({
  song,
  chestLow,
  chestHigh,
  falsettoHigh,
  onClose,
}: {
  song: Song;
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
  onClose: () => void;
}) {
  const chestAdvice = chestHigh !== null ? judgeKey(chestHigh, song.chestMax) : null;
  const falsettoAdvice =
    falsettoHigh !== null && song.falsettoMax !== null
      ? judgeKey(falsettoHigh, song.falsettoMax, "falsetto")
      : null;

  return (
    <section className="card" aria-label={`${song.title} の攻略情報`}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div>
          <strong style={{ fontSize: 16 }}>{song.title}</strong>
          <p className="muted">{song.artist}</p>
        </div>
        <button className="btn btn-ghost" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>

      <PatchBay
        song={song}
        chestLow={chestLow}
        chestHigh={chestHigh}
        falsettoHigh={falsettoHigh}
      />

      <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        <span className="data">
          MAX {midiToKaraoke(song.chestMax)}
          {song.falsettoMax !== null && ` / FALSETTO ${midiToKaraoke(song.falsettoMax)}`}
          {song.lowest !== null && ` / LOW ${midiToKaraoke(song.lowest)}`}
          {song.originalKey && ` / KEY ${song.originalKey}`}
        </span>
      </div>

      {chestAdvice ? (
        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid var(--groove)",
            paddingTop: 12,
          }}
        >
          {/* キー推奨はセグメント表示で大きく。理由は和文で1行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SegmentDisplay
              value={`KEY ${chestAdvice.keyShift > 0 ? "+" : ""}${chestAdvice.keyShift}`}
              color={chestAdvice.keyShift === 0 ? "cyan" : "amber"}
              cellHeight={40}
              noFlicker
              aria-label={`推奨キー ${chestAdvice.keyShift}`}
            />
            <span className={`badge ${LEVEL_BADGE[chestAdvice.level]}`}>
              {chestAdvice.level === "easy" && "OK"}
              {chestAdvice.level === "edge" && "EDGE"}
              {chestAdvice.level === "shift" && "SHIFT"}
              {chestAdvice.level === "octave" && "OCTAVE"}
            </span>
          </div>
          <p style={{ marginTop: 8, fontSize: 14 }}>{chestAdvice.detail}</p>
          {falsettoAdvice && (
            <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              裏声パートは裏声最高音で判定。{falsettoAdvice.detail}
            </p>
          )}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          音域を測定すると、あなた専用のキー推奨が表示されます。
        </p>
      )}
      <p className="muted" style={{ marginTop: 10, fontSize: 11 }}>
        参考値です{song.isVerified ? "(検証済みデータ)" : "(未検証データ)"}
      </p>
    </section>
  );
}
