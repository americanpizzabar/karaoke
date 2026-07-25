"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePitchDetector } from "@/hooks/usePitchDetector";
import { PitchMeter } from "@/components/PitchMeter";
import { RMS_THRESHOLD } from "@/lib/pitch";
import { midiToFreq, midiToFullLabel, midiToKaraoke, midiToScientific } from "@/lib/notes";
import { fetchRangeHistory, useAppStore } from "@/store/useAppStore";

const HOLD_MS = 1600; // 同一音程(±1半音)をこの時間連続検出したら自動記録

type PhaseKey = "chestLow" | "chestHigh" | "falsettoHigh";

const PHASES: { key: PhaseKey; step: string; title: string; desc: string }[] = [
  {
    key: "chestLow",
    step: "①",
    title: "低い声",
    desc: "出せる一番低い声で「あー」と2秒キープ",
  },
  {
    key: "chestHigh",
    step: "②",
    title: "地声の高音",
    desc: "裏声にせず、地声で出せる一番高い声を2秒キープ",
  },
  {
    key: "falsettoHigh",
    step: "③",
    title: "裏声の高音",
    desc: "裏声で出せる一番高い声を2秒キープ(出せなければスキップ)",
  },
];

interface Result {
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
}

export default function MeasurePage() {
  const { state, active, error, start, stop } = usePitchDetector();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [result, setResult] = useState<Result>({
    chestLow: null,
    chestHigh: null,
    falsettoHigh: null,
  });
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [holdProgress, setHoldProgress] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const candidateRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);
  const samplesRef = useRef<number[]>([]);
  const phaseIdxRef = useRef(0);
  const resultRef = useRef<Result>(result);
  phaseIdxRef.current = phaseIdx;
  resultRef.current = result;

  const advance = useCallback(
    (recorded: number | null) => {
      const key = PHASES[phaseIdxRef.current].key;
      const next = { ...resultRef.current, [key]: recorded };
      setResult(next);
      candidateRef.current = null;
      samplesRef.current = [];
      setHoldProgress(0);
      if (recorded !== null) {
        setFlash(`${midiToKaraoke(recorded)} を記録!`);
        setTimeout(() => setFlash(null), 1200);
      }
      if (phaseIdxRef.current >= PHASES.length - 1) {
        setFinished(true);
        stop();
      } else {
        setPhaseIdx(phaseIdxRef.current + 1);
      }
    },
    [stop]
  );

  // ホールド判定: 現在音が candidate ±1半音なら継続、HOLD_MS で自動記録
  useEffect(() => {
    if (!active || finished) return;
    const midi = state.midi;
    const now = performance.now();
    if (midi === null) {
      candidateRef.current = null;
      samplesRef.current = [];
      setHoldProgress(0);
      return;
    }
    const rounded = Math.round(midi);
    if (
      candidateRef.current !== null &&
      Math.abs(midi - candidateRef.current) <= 1
    ) {
      samplesRef.current.push(midi);
      const held = now - holdStartRef.current;
      setHoldProgress(Math.min(held / HOLD_MS, 1));
      if (held >= HOLD_MS) {
        const sorted = [...samplesRef.current].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        advance(Math.round(median));
      }
    } else {
      candidateRef.current = rounded;
      holdStartRef.current = now;
      samplesRef.current = [midi];
      setHoldProgress(0);
    }
  }, [state, active, finished, advance]);

  const restart = () => {
    setPhaseIdx(0);
    setResult({ chestLow: null, chestHigh: null, falsettoHigh: null });
    setFinished(false);
    setSaved("idle");
    candidateRef.current = null;
  };

  if (finished) {
    return (
      <ResultView
        result={result}
        saved={saved}
        setSaved={setSaved}
        onRestart={restart}
      />
    );
  }

  const phase = PHASES[phaseIdx];
  const cur = state.midi;

  return (
    <main>
      <h1 className="page-title">音域測定</h1>

      {!active ? (
        <section className="card">
          <p style={{ marginBottom: 10 }}>
            3ステップ(低い声 → 地声の高音 → 裏声の高音)で音域を測定します。
            静かな場所で、マイクから20cmほど離して発声してください。
          </p>
          <p className="muted" style={{ marginBottom: 14 }}>
            音声はすべて端末内で処理され、サーバーには送信されません。保存されるのは音名(番号)だけです。
          </p>
          {error && (
            <p className="warn" style={{ marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button className="btn btn-accent btn-block" onClick={() => start()}>
            マイクを許可して測定開始
          </button>
        </section>
      ) : (
        <>
          <section className="card" aria-live="polite">
            <div className="muted">
              STEP {phase.step}({phaseIdx + 1}/3)
            </div>
            <strong style={{ fontSize: 18 }}>{phase.title}</strong>
            <p className="muted" style={{ marginTop: 4 }}>
              {phase.desc}
            </p>
          </section>

          <section className="card">
            <div className="meter-wrap">
              <div style={{ position: "relative" }}>
                <PitchMeter
                  currentMidi={cur}
                  chestLow={result.chestLow}
                  chestHigh={result.chestHigh}
                  falsettoHigh={result.falsettoHigh}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="note-display" aria-live="polite">
                  {flash ?? (cur !== null ? midiToKaraoke(cur) : "‥‥")}
                </div>
                <div className="note-sub led">
                  {cur !== null
                    ? `${midiToScientific(cur)} / ${midiToFreq(Math.round(cur)).toFixed(0)}Hz`
                    : state.rms < RMS_THRESHOLD
                      ? "声を出してください"
                      : "音程を検出中…"}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 10, marginBottom: 3 }}>
                    MIC LEVEL
                  </div>
                  <div className="hold-bar" style={{ marginTop: 0, height: 5 }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        width: `${Math.min(100, (state.rms / 0.06) * 100)}%`,
                        background:
                          state.rms < RMS_THRESHOLD
                            ? "var(--muted)"
                            : "var(--falsetto)",
                      }}
                    />
                  </div>
                  {state.rms > 0 && state.rms < RMS_THRESHOLD && (
                    <p className="warn" style={{ marginTop: 4 }}>
                      入力音量が小さいようです。マイクに口を近づけて(20cmほど)、少し大きめに発声してください。
                    </p>
                  )}
                </div>
                <div
                  className="hold-bar"
                  role="progressbar"
                  aria-valuenow={Math.round(holdProgress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="キープ進捗"
                >
                  <div
                    className="hold-bar-fill"
                    style={{ width: `${holdProgress * 100}%` }}
                  />
                </div>
                <p className="muted" style={{ marginTop: 8 }}>
                  同じ音を{(HOLD_MS / 1000).toFixed(1)}秒キープすると自動記録
                </p>

                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => advance(null)}>
                    スキップ
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      stop();
                      restart();
                    }}
                  >
                    中止
                  </button>
                </div>
              </div>
            </div>
          </section>

          <p className="muted" style={{ fontSize: 11 }}>
            カラオケボックスではBGMを止め、周囲が静かな状態で測定すると精度が上がります。
            喉に痛みを感じたらすぐに中止してください。
          </p>
        </>
      )}
    </main>
  );
}

function ResultView({
  result,
  saved,
  setSaved,
  onRestart,
}: {
  result: Result;
  saved: "idle" | "saving" | "done" | "error";
  setSaved: (s: "idle" | "saving" | "done" | "error") => void;
  onRestart: () => void;
}) {
  const invalidate = useAppStore((s) => s.invalidateRange);
  const savedOnce = useRef(false);

  useEffect(() => {
    if (savedOnce.current) return;
    savedOnce.current = true;
    const hasAny =
      result.chestLow !== null ||
      result.chestHigh !== null ||
      result.falsettoHigh !== null;
    if (!hasAny) return;
    setSaved("saving");
    fetch("/api/range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        invalidate();
        fetchRangeHistory(true);
        setSaved("done");
      })
      .catch(() => setSaved("error"));
  }, [result, setSaved, invalidate]);

  const shareImage = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    try {
      await document.fonts.load('700 64px "DotGothic16"');
    } catch {
      /* フォント未ロードでも描画は続行 */
    }
    ctx.fillStyle = "#0A0D1F";
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = "#FF4D8D";
    ctx.font = '700 72px "DotGothic16", monospace';
    ctx.textAlign = "center";
    ctx.fillText("音域アタック", 540, 160);
    ctx.fillStyle = "#8B92B0";
    ctx.font = '400 36px "Zen Kaku Gothic New", sans-serif';
    ctx.fillText("MY VOCAL RANGE", 540, 230);

    const rows: [string, number | null, string][] = [
      ["最低音", result.chestLow, "#EDEFF7"],
      ["地声最高音", result.chestHigh, "#F5B841"],
      ["裏声最高音", result.falsettoHigh, "#7FD6FF"],
    ];
    rows.forEach(([label, midi, color], i) => {
      const y = 420 + i * 190;
      ctx.fillStyle = "#8B92B0";
      ctx.font = '400 40px "Zen Kaku Gothic New", sans-serif';
      ctx.fillText(label, 540, y - 80);
      ctx.fillStyle = color;
      ctx.font = '700 96px "DotGothic16", monospace';
      ctx.fillText(midi !== null ? midiToKaraoke(midi) : "—", 540, y + 10);
    });

    ctx.fillStyle = "#1C2342";
    ctx.fillRect(140, 990, 800, 2);
    ctx.fillStyle = "#8B92B0";
    ctx.font = '400 30px "Zen Kaku Gothic New", sans-serif';
    ctx.fillText("#音域アタック", 540, 1045);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "oniki-attack-range.png";
    a.click();
  };

  return (
    <main>
      <h1 className="page-title">測定結果</h1>
      <section className="card">
        <div className="range-summary">
          <div>
            <div className="muted">最低音</div>
            <div className="val val-low led">
              {result.chestLow !== null ? midiToKaraoke(result.chestLow) : "—"}
            </div>
          </div>
          <div>
            <div className="muted">地声最高</div>
            <div className="val val-chest led">
              {result.chestHigh !== null ? midiToKaraoke(result.chestHigh) : "—"}
            </div>
          </div>
          <div>
            <div className="muted">裏声最高</div>
            <div className="val val-falsetto led">
              {result.falsettoHigh !== null
                ? midiToKaraoke(result.falsettoHigh)
                : "—"}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {result.chestLow !== null && (
            <p className="muted">最低音: {midiToFullLabel(result.chestLow)}</p>
          )}
          {result.chestHigh !== null && (
            <p className="muted">地声最高音: {midiToFullLabel(result.chestHigh)}</p>
          )}
          {result.falsettoHigh !== null && (
            <p className="muted">
              裏声最高音: {midiToFullLabel(result.falsettoHigh)}
            </p>
          )}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          {saved === "saving" && "保存中..."}
          {saved === "done" && "測定履歴に保存しました。"}
          {saved === "error" && "保存に失敗しました(オフラインの可能性)。"}
          {saved === "idle" && "記録された音がないため保存されませんでした。"}
        </p>
      </section>

      <button className="btn btn-block" onClick={shareImage} style={{ marginBottom: 10 }}>
        シェア画像を保存
      </button>
      <Link href="/songs">
        <button className="btn btn-accent btn-block" style={{ marginBottom: 10 }}>
          この音域で歌える曲を探す →
        </button>
      </Link>
      <button className="btn btn-ghost btn-block" onClick={onRestart}>
        もう一度測定する
      </button>
    </main>
  );
}
