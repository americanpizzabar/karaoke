"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { midiToFullLabel, midiToKaraoke } from "@/lib/notes";
import { classifySingable } from "@/lib/keyAdvice";
import {
  fetchRangeHistory,
  fetchSongs,
  useAppStore,
} from "@/store/useAppStore";

export default function HomePage() {
  const latest = useAppStore((s) => s.latestRange);
  const songs = useAppStore((s) => s.songs);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([fetchRangeHistory(), fetchSongs()]).then(() =>
      setLoaded(true)
    );
  }, []);

  const singableCount =
    latest?.chestHigh != null && songs
      ? songs.filter(
          (s) => classifySingable(latest.chestHigh!, s.chestMax) === "original"
        ).length
      : null;

  return (
    <main>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          音域アタック
        </h1>
        <Link href="/settings" aria-label="設定" style={{ fontSize: 20 }}>
          ⚙
        </Link>
      </header>
      <p className="muted" style={{ margin: "6px 0 16px" }}>
        知る → 今夜歌える → いつか原キーで歌える
      </p>

      <section className="card" aria-label="現在の音域">
        <div className="section-label" style={{ marginTop: 0 }}>
          MY RANGE
        </div>
        {latest ? (
          <>
            <div className="range-summary">
              <div>
                <div className="muted">最低音</div>
                <div className="val val-low led">
                  {latest.chestLow != null ? midiToKaraoke(latest.chestLow) : "—"}
                </div>
              </div>
              <div>
                <div className="muted">地声最高</div>
                <div className="val val-chest led">
                  {latest.chestHigh != null
                    ? midiToKaraoke(latest.chestHigh)
                    : "—"}
                </div>
              </div>
              <div>
                <div className="muted">裏声最高</div>
                <div className="val val-falsetto led">
                  {latest.falsettoHigh != null
                    ? midiToKaraoke(latest.falsettoHigh)
                    : "—"}
                </div>
              </div>
            </div>
            {latest.chestHigh != null && (
              <p className="muted" style={{ marginTop: 10 }}>
                地声最高音 {midiToFullLabel(latest.chestHigh)}
              </p>
            )}
            {singableCount !== null && (
              <p style={{ marginTop: 8, fontSize: 14 }}>
                原キーで歌える曲:{" "}
                <strong style={{ color: "var(--chest)" }}>
                  {singableCount}曲
                </strong>{" "}
                <span className="muted">/ {songs?.length}曲中</span>
              </p>
            )}
          </>
        ) : (
          <p className="muted">
            {loaded
              ? "まだ測定データがありません。まずは音域を測定しましょう(約1分)。"
              : "読み込み中..."}
          </p>
        )}
        <Link href="/measure">
          <button
            className="btn btn-accent btn-block"
            style={{ marginTop: 14 }}
          >
            {latest ? "音域を再測定する" : "音域を測定する(約1分)"}
          </button>
        </Link>
      </section>

      <div className="grid-2">
        <Link href="/songs" className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 22 }}>🎵</div>
          <strong>曲攻略</strong>
          <p className="muted">歌いたい曲の最適キーを知る</p>
        </Link>
        <Link href="/training" className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 22 }}>🔥</div>
          <strong>今日のトレ</strong>
          <p className="muted">1回3分で高音を伸ばす</p>
        </Link>
      </div>

      <p className="muted" style={{ marginTop: 18, fontSize: 11 }}>
        ※ 本アプリのトレーニングは医学的・専門的判定ではありません。喉に痛みや
        違和感を感じたらすぐに中止してください。
      </p>
    </main>
  );
}
