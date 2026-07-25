"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { midiToKaraoke } from "@/lib/notes";
import { classifySingable } from "@/lib/keyAdvice";
import {
  fetchRangeHistory,
  fetchSongs,
  useAppStore,
} from "@/store/useAppStore";

export default function ProgressPage() {
  const history = useAppStore((s) => s.rangeHistory);
  const songs = useAppStore((s) => s.songs);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([fetchRangeHistory(), fetchSongs()]).then(() =>
      setLoaded(true)
    );
  }, []);

  const chartData = useMemo(() => {
    if (!history) return [];
    return [...history]
      .reverse()
      .map((r) => ({
        date: (r.measuredAt ?? "").slice(5, 10).replace("-", "/"),
        最低音: r.chestLow,
        地声最高: r.chestHigh,
        裏声最高: r.falsettoHigh,
      }));
  }, [history]);

  const latest = history?.[0] ?? null;
  const first = history && history.length > 1 ? history[history.length - 1] : null;

  const singable = useMemo(() => {
    if (!songs || latest?.chestHigh == null) return null;
    let original = 0;
    let minus2 = 0;
    let hard = 0;
    for (const s of songs) {
      const c = classifySingable(latest.chestHigh, s.chestMax);
      if (c === "original") original++;
      else if (c === "minus2") minus2++;
      else hard++;
    }
    return { original, minus2, hard };
  }, [songs, latest]);

  const growth =
    latest?.chestHigh != null && first?.chestHigh != null
      ? latest.chestHigh - first.chestHigh
      : null;

  return (
    <main>
      <div className="etch-label" style={{ margin: "4px 0 14px" }}>
        PROGRESS MONITOR
      </div>
      <h1 className="page-title">進捗</h1>

      {!loaded && <p className="muted">読み込み中...</p>}

      {loaded && (!history || history.length === 0) && (
        <section className="card">
          <p>
            まだ測定履歴がありません。
            <Link href="/measure" style={{ color: "var(--phosphor-amber)" }}>
              音域を測定
            </Link>
            すると推移が記録されます。
          </p>
        </section>
      )}

      {history && history.length > 0 && (
        <>
          {/* オシロスコープの画面として描く(S6): グリッドは--grooveの1px、
              線はamber 1.5px、ドットなし、エリア塗り禁止 */}
          <section className="card" aria-label="音域推移グラフ">
            <div className="section-label" style={{ marginTop: 0 }}>
              RANGE HISTORY
            </div>
            <div
              style={{
                width: "100%",
                height: 240,
                background: "var(--chassis)",
                border: "1px solid var(--groove)",
                borderRadius: 4,
                padding: "8px 4px 0 0",
              }}
            >
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ left: 8, right: 8, top: 4 }}>
                  <CartesianGrid stroke="#2A2F38" strokeWidth={1} />
                  <XAxis
                    dataKey="date"
                    stroke="#2A2F38"
                    tickLine={{ stroke: "#2A2F38" }}
                    tick={{ fontSize: 10, fill: "#868D99", fontFamily: "IBM Plex Mono, monospace" }}
                  />
                  <YAxis
                    stroke="#2A2F38"
                    tickLine={{ stroke: "#2A2F38" }}
                    domain={["dataMin - 2", "dataMax + 2"]}
                    tickFormatter={(v: number) => midiToKaraoke(v)}
                    tick={{ fontSize: 9, fill: "#868D99", fontFamily: "IBM Plex Mono, monospace" }}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ stroke: "#2A2F38", strokeWidth: 1 }}
                    contentStyle={{
                      background: "#1E2229",
                      border: "1px solid #2A2F38",
                      borderRadius: 4,
                      color: "#E9EAEE",
                      fontSize: 12,
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                    formatter={(v) =>
                      typeof v === "number" ? midiToKaraoke(v) : "—"
                    }
                  />
                  <Line
                    type="linear"
                    dataKey="地声最高"
                    stroke="#FFB454"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="裏声最高"
                    stroke="#7DF0D4"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="linear"
                    dataKey="最低音"
                    stroke="#868D99"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {growth !== null && growth > 0 && (
              <p style={{ marginTop: 8 }}>
                初回から地声最高音が{" "}
                <strong className="data" style={{ color: "var(--phosphor-amber)" }}>
                  +{growth}半音
                </strong>{" "}
                伸びました。
              </p>
            )}
          </section>

          {singable && (
            <section className="card" aria-label="歌える曲">
              <div className="section-label" style={{ marginTop: 0 }}>
                SINGABLE SONGS
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  textAlign: "center",
                }}
              >
                <div>
                  <div className="etch-label">ORIGINAL</div>
                  <div
                    className="data"
                    style={{
                      fontSize: 24,
                      color: "var(--phosphor-amber)",
                      textShadow: "var(--glow-amber)",
                    }}
                  >
                    {singable.original}
                  </div>
                </div>
                <div>
                  <div className="etch-label">KEY -2</div>
                  <div
                    className="data"
                    style={{
                      fontSize: 24,
                      color: "var(--phosphor-cyan)",
                      textShadow: "var(--glow-cyan)",
                    }}
                  >
                    {singable.minus2}
                  </div>
                </div>
                <div>
                  <div className="etch-label">LOCKED</div>
                  <div className="data" style={{ fontSize: 24, color: "var(--etch)" }}>
                    {singable.hard}
                  </div>
                </div>
              </div>
              <Link href="/songs">
                <button className="btn btn-block" style={{ marginTop: 12 }}>
                  曲リストを見る
                </button>
              </Link>
            </section>
          )}

          <section className="card" aria-label="測定履歴">
            <div className="section-label" style={{ marginTop: 0 }}>
              LOG
            </div>
            {history.slice(0, 10).map((r) => (
              <p key={r.id} className="muted data" style={{ padding: "4px 0", fontSize: 12 }}>
                {(r.measuredAt ?? "").slice(0, 16).replace("T", " ")} —{" "}
                {r.chestLow != null ? midiToKaraoke(r.chestLow) : "—"} 〜{" "}
                <span style={{ color: "var(--phosphor-amber)" }}>
                  {r.chestHigh != null ? midiToKaraoke(r.chestHigh) : "—"}
                </span>
                {r.falsettoHigh != null && (
                  <span style={{ color: "var(--phosphor-cyan)" }}>
                    {" "}
                    (裏声 {midiToKaraoke(r.falsettoHigh)})
                  </span>
                )}
              </p>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
