"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Nameplate } from "@/components/Nameplate";
import { classifySingable } from "@/lib/keyAdvice";
import {
  fetchRangeHistory,
  fetchSongs,
  useAppStore,
} from "@/store/useAppStore";

export default function HomePage() {
  const latest = useAppStore((s) => s.latestRange);
  const history = useAppStore((s) => s.rangeHistory);
  const songs = useAppStore((s) => s.songs);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "4px 0 14px",
        }}
      >
        <span className="etch-label">ONIKI ATTACK</span>
        <Link href="/settings" className="etch-label" aria-label="設定">
          SETUP
        </Link>
      </div>

      {/* 1. 現在の音域を刻んだ小型の銘板 */}
      <section aria-label="現在の音域" style={{ marginBottom: 14 }}>
        {latest ? (
          <>
            <Nameplate
              compact
              data={{
                chestLow: latest.chestLow,
                chestHigh: latest.chestHigh,
                falsettoHigh: latest.falsettoHigh,
                measuredAt: latest.measuredAt,
                serial: history?.length ?? null,
              }}
            />
            {singableCount !== null && (
              <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                原キーで歌える曲 {singableCount} / {songs?.length}曲
              </p>
            )}
            <Link href="/measure">
              <button className="btn btn-block" style={{ marginTop: 10 }}>
                音域を再測定する
              </button>
            </Link>
          </>
        ) : (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="etch-label" style={{ marginBottom: 8 }}>
              VOCAL RANGE CERTIFICATE
            </div>
            <p className="muted">
              {loaded
                ? "まだ測定データがありません。まずは音域を測定します(約1分)。"
                : "読み込み中..."}
            </p>
            <Link href="/measure">
              <button className="btn btn-accent btn-block" style={{ marginTop: 12 }}>
                音域を測定する
              </button>
            </Link>
          </div>
        )}
      </section>

      {/* 2. 今日のトレーニングユニット */}
      <Link href="/training">
        <section className="card" aria-label="今日のトレーニング">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div className="etch-label" style={{ marginBottom: 6 }}>
                <span className="led-dot on-amber" style={{ marginRight: 6 }} />
                TODAY&apos;S TRAINING
              </div>
              <p style={{ fontSize: 14 }}>1回3分。高音を伸ばすメニューへ</p>
            </div>
            <span className="etch-label">RUN</span>
          </div>
        </section>
      </Link>

      {/* 3. 曲検索 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q.trim() ? `/songs?q=${encodeURIComponent(q.trim())}` : "/songs");
        }}
        role="search"
      >
        <input
          className="input"
          type="search"
          placeholder="曲名・アーティストで検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="曲検索"
        />
      </form>

      <p className="muted" style={{ marginTop: 18, fontSize: 11 }}>
        本アプリのトレーニングは医学的・専門的判定ではありません。喉に痛みや
        違和感を感じたらすぐに中止してください。
      </p>
    </main>
  );
}
