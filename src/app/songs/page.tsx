"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { judgeKey, type KeyAdvice } from "@/lib/keyAdvice";
import { midiToKaraoke } from "@/lib/notes";
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
  const latest = useAppStore((s) => s.latestRange);
  const songs = useAppStore((s) => s.songs);
  const [q, setQ] = useState("");
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
      <h1 className="page-title">曲攻略</h1>

      {chestHigh === null && loaded && (
        <section className="card">
          <p>
            音域データがありません。
            <Link href="/measure" style={{ color: "var(--accent)" }}>
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
              onClick={() => setSelected(s)}
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
                  {advice.level === "easy" && "余裕"}
                  {advice.level === "edge" && "ギリ可"}
                  {advice.level === "shift" && `キー${advice.keyShift}`}
                  {advice.level === "octave" && "要工夫"}
                </span>
              )}
            </button>
          );
        })}
      </section>

      <p className="muted" style={{ fontSize: 11 }}>
        ※ 曲の音域データは参考値です。実際の楽曲と異なる場合があります。
      </p>
    </main>
  );
}

function SongDetail({
  song,
  chestHigh,
  falsettoHigh,
  onClose,
}: {
  song: Song;
  chestHigh: number | null;
  falsettoHigh: number | null;
  onClose: () => void;
}) {
  const chestAdvice = chestHigh !== null ? judgeKey(chestHigh, song.chestMax) : null;
  const falsettoAdvice =
    falsettoHigh !== null && song.falsettoMax !== null
      ? judgeKey(falsettoHigh, song.falsettoMax)
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
          <strong style={{ fontSize: 17 }}>{song.title}</strong>
          <p className="muted">{song.artist}</p>
        </div>
        <button className="btn btn-ghost" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 14 }}>
        <p>
          地声最高音:{" "}
          <span className="led" style={{ color: "var(--chest)" }}>
            {midiToKaraoke(song.chestMax)}
          </span>
          {song.falsettoMax !== null && (
            <>
              {" ／ 裏声最高音: "}
              <span className="led" style={{ color: "var(--falsetto)" }}>
                {midiToKaraoke(song.falsettoMax)}
              </span>
            </>
          )}
          {song.lowest !== null && (
            <>
              {" ／ 最低音: "}
              <span className="led">{midiToKaraoke(song.lowest)}</span>
            </>
          )}
        </p>
        {song.originalKey && (
          <p className="muted">原曲キー: {song.originalKey}</p>
        )}
      </div>

      {chestAdvice ? (
        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
          }}
        >
          <p>
            <span className={`badge ${LEVEL_BADGE[chestAdvice.level]}`}>地声判定</span>{" "}
            <strong style={{ marginLeft: 6 }}>{chestAdvice.label}</strong>
          </p>
          <p className="muted" style={{ marginTop: 4 }}>
            {chestAdvice.detail}
          </p>
          {falsettoAdvice && (
            <>
              <p style={{ marginTop: 10 }}>
                <span className="badge badge-octave">裏声判定</span>{" "}
                <strong style={{ marginLeft: 6 }}>{falsettoAdvice.label}</strong>
              </p>
              <p className="muted" style={{ marginTop: 4 }}>
                裏声パートは裏声最高音で判定しています。{falsettoAdvice.detail}
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          音域を測定すると、あなた専用のキー推奨が表示されます。
        </p>
      )}
      <p className="warn" style={{ marginTop: 10 }}>
        ※ 参考値です{song.isVerified ? "(検証済みデータ)" : "(未検証データ)"}
      </p>
    </section>
  );
}
