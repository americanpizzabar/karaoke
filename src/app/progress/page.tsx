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
      <h1 className="page-title">進捗</h1>

      {!loaded && <p className="muted">読み込み中...</p>}

      {loaded && (!history || history.length === 0) && (
        <section className="card">
          <p>
            まだ測定履歴がありません。
            <Link href="/measure" style={{ color: "var(--accent)" }}>
              音域を測定
            </Link>
            すると推移が記録されます。
          </p>
        </section>
      )}

      {history && history.length > 0 && (
        <>
          <section className="card" aria-label="音域推移グラフ">
            <div className="section-label" style={{ marginTop: 0 }}>
              RANGE HISTORY
            </div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke="#1C2342" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    stroke="#8B92B0"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#8B92B0"
                    domain={["dataMin - 2", "dataMax + 2"]}
                    tickFormatter={(v: number) => midiToKaraoke(v)}
                    tick={{ fontSize: 10 }}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#12172E",
                      border: "1px solid #1C2342",
                      borderRadius: 8,
                      color: "#EDEFF7",
                    }}
                    formatter={(v) =>
                      typeof v === "number" ? midiToKaraoke(v) : "—"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="地声最高"
                    stroke="#F5B841"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="裏声最高"
                    stroke="#7FD6FF"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="最低音"
                    stroke="#8B92B0"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {growth !== null && growth > 0 && (
              <p style={{ marginTop: 8 }}>
                初回から地声最高音が{" "}
                <strong style={{ color: "var(--chest)" }}>+{growth}半音</strong>{" "}
                伸びました 🎉
              </p>
            )}
          </section>

          {singable && (
            <section className="card" aria-label="歌える曲">
              <div className="section-label" style={{ marginTop: 0 }}>
                SINGABLE SONGS
              </div>
              <div className="range-summary">
                <div>
                  <div className="muted">原キーOK</div>
                  <div className="val val-chest led">{singable.original}</div>
                </div>
                <div>
                  <div className="muted">キー-2以内</div>
                  <div className="val val-falsetto led">{singable.minus2}</div>
                </div>
                <div>
                  <div className="muted">現状難しい</div>
                  <div className="val led" style={{ color: "var(--muted)" }}>
                    {singable.hard}
                  </div>
                </div>
              </div>
              <Link href="/songs">
                <button className="btn btn-block" style={{ marginTop: 12 }}>
                  曲リストを見る →
                </button>
              </Link>
            </section>
          )}

          <section className="card" aria-label="測定履歴">
            <div className="section-label" style={{ marginTop: 0 }}>
              LOG
            </div>
            {history.slice(0, 10).map((r) => (
              <p key={r.id} className="muted" style={{ padding: "4px 0" }}>
                {(r.measuredAt ?? "").slice(0, 16).replace("T", " ")} —{" "}
                {r.chestLow != null ? midiToKaraoke(r.chestLow) : "—"} 〜{" "}
                <span style={{ color: "var(--chest)" }}>
                  {r.chestHigh != null ? midiToKaraoke(r.chestHigh) : "—"}
                </span>
                {r.falsettoHigh != null && (
                  <span style={{ color: "var(--falsetto)" }}>
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
