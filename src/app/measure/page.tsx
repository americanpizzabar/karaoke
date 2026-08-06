"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePitchDetector } from "@/hooks/usePitchDetector";
import { ChannelStrip } from "@/components/ChannelStrip";
import { TunerFace } from "@/components/TunerFace";
import { SegmentDisplay } from "@/components/SegmentDisplay";
import { Nameplate, exportNameplateImage } from "@/components/Nameplate";
import { midiToKaraoke } from "@/lib/notes";
import { saveRangeRecord, useAppStore } from "@/store/useAppStore";

const HOLD_MS = 1600; // 同一音程(±1半音)をこの時間連続検出したら候補として記録(確定は手動)

type PhaseKey = "chestLow" | "chestHigh" | "falsettoHigh";

const PHASES: { key: PhaseKey; title: string; desc: string }[] = [
  {
    key: "chestLow",
    title: "低い声",
    desc: "出せる一番低い声で「あー」と2秒キープ",
  },
  {
    key: "chestHigh",
    title: "地声の高音",
    desc: "裏声にせず、いちばん高い声で2秒キープ",
  },
  {
    key: "falsettoHigh",
    title: "裏声の高音",
    desc: "裏声で出せる一番高い声を2秒キープ(出せなければスキップ)",
  },
];

interface Result {
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
}

type SaveState = "idle" | "saving" | "done" | "local" | "error";

export default function MeasurePage() {
  const { state, active, error, start, stop } = usePitchDetector();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [result, setResult] = useState<Result>({
    chestLow: null,
    chestHigh: null,
    falsettoHigh: null,
  });
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState<SaveState>("idle");
  const [holdProgress, setHoldProgress] = useState(0);
  const [candidate, setCandidate] = useState<number | null>(null);
  const [sweepToken, setSweepToken] = useState(0);

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
      setCandidate(null);
      if (phaseIdxRef.current >= PHASES.length - 1) {
        setFinished(true);
        stop();
      } else {
        setPhaseIdx(phaseIdxRef.current + 1);
      }
    },
    [stop]
  );

  // ホールド判定: 現在音が candidate ±1半音なら継続、HOLD_MS で候補記録
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
        // 候補として記録し、確定はユーザーの「次へ」操作に委ねる
        const sorted = [...samplesRef.current].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const note = Math.round(median);
        setCandidate(note);
        setSweepToken((t) => t + 1); // 記録完了: ストリップ点灯 + HOLD 点滅
        candidateRef.current = null;
        samplesRef.current = [];
        setHoldProgress(0);
      }
    } else {
      candidateRef.current = rounded;
      holdStartRef.current = now;
      samplesRef.current = [midi];
      setHoldProgress(0);
    }
  }, [state, active, finished]);

  /** 1つ前のステップへ戻り、その記録を破棄してやり直す */
  const goBack = useCallback(() => {
    if (phaseIdxRef.current === 0) return;
    const prevIdx = phaseIdxRef.current - 1;
    const key = PHASES[prevIdx].key;
    setResult({ ...resultRef.current, [key]: null });
    setPhaseIdx(prevIdx);
    candidateRef.current = null;
    samplesRef.current = [];
    setHoldProgress(0);
    setCandidate(null);
  }, []);

  const restart = () => {
    setPhaseIdx(0);
    setResult({ chestLow: null, chestHigh: null, falsettoHigh: null });
    setFinished(false);
    setSaved("idle");
    setCandidate(null);
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

  return (
    <main>
      {/* 刻印のみのヘッダー(S2: ヘッダーもナビも消す) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "4px 0 14px",
        }}
      >
        <span className="etch-label">
          RANGE FINDER — STEP {phaseIdx + 1}/3
        </span>
        <Link
          href="/"
          className="etch-label"
          onClick={() => stop()}
          aria-label="測定をやめてホームへ戻る"
        >
          EXIT
        </Link>
      </div>

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
              NO INPUT — {error}
            </p>
          )}
          <button className="btn btn-accent btn-block" onClick={() => start()}>
            マイクを許可して測定開始
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <div style={{ display: "flex", gap: 12 }}>
              <ChannelStrip
                currentMidi={state.midi}
                chestLow={result.chestLow}
                chestHigh={result.chestHigh}
                falsettoHigh={result.falsettoHigh}
                sweepToken={sweepToken}
                height={330}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <TunerFace midi={state.midi} rms={state.rms} recording />
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
              </div>
            </div>
          </section>

          {/* 指示は日本語(刻印=機材の声、本文=コーチの声) */}
          <section className="card" aria-live="polite">
            <strong style={{ fontSize: 15 }}>{phase.title}</strong>
            <p className="muted" style={{ marginTop: 4 }}>
              {phase.desc}
            </p>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 28,
              }}
            >
              <span className="etch-label">CAPTURED</span>
              {candidate !== null ? (
                <SegmentDisplay
                  value={midiToKaraoke(candidate)}
                  color="amber"
                  cellHeight={24}
                  aria-label={`記録候補 ${midiToKaraoke(candidate)}`}
                />
              ) : (
                <span className="muted">
                  同じ音を{(HOLD_MS / 1000).toFixed(1)}秒キープで記録
                </span>
              )}
            </div>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-accent"
                disabled={candidate === null}
                onClick={() => advance(candidate)}
              >
                {phaseIdx >= PHASES.length - 1 ? "この音で完了" : "この音で次へ"}
              </button>
              <button className="btn btn-ghost" onClick={() => advance(null)}>
                スキップ
              </button>
              {phaseIdx > 0 && (
                <button className="btn btn-ghost" onClick={goBack}>
                  前のステップ
                </button>
              )}
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
  saved: SaveState;
  setSaved: (s: SaveState) => void;
  onRestart: () => void;
}) {
  const history = useAppStore((s) => s.rangeHistory);
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
    // サーバーDB未接続時は端末内(localStorage)に保存される
    saveRangeRecord(result)
      .then((mode) => setSaved(mode === "server" ? "done" : "local"))
      .catch(() => setSaved("error"));
  }, [result, setSaved]);

  const data = {
    ...result,
    measuredAt: history?.[0]?.measuredAt ?? new Date().toISOString(),
    serial: history ? history.length : null, // 測定通し番号
  };

  // 前回測定との地声最高音の差(履歴の先頭は今回の記録)
  const prev = history && history.length > 1 ? history[1] : null;
  const delta =
    prev?.chestHigh != null && result.chestHigh != null
      ? result.chestHigh - prev.chestHigh
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
        <span className="etch-label">RANGE FINDER — RESULT</span>
        <Link href="/" className="etch-label">
          EXIT
        </Link>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Nameplate data={data} />
      </div>

      {/* 音域スパンの静止画(チャンネルストリップ) */}
      <section className="card" aria-label="音域スパン">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <ChannelStrip
            currentMidi={null}
            chestLow={result.chestLow}
            chestHigh={result.chestHigh}
            falsettoHigh={result.falsettoHigh}
            height={240}
          />
          <div style={{ flex: 1 }}>
            <p className="muted">
              {saved === "saving" && "保存中..."}
              {saved === "done" && "測定履歴に保存しました。"}
              {saved === "local" &&
                "LOCAL — この端末内に保存しました(サーバー未接続)。"}
              {saved === "error" && "保存に失敗しました(オフラインの可能性)。"}
              {saved === "idle" && "記録された音がないため保存されませんでした。"}
            </p>
            {delta !== null && delta !== 0 && (
              <p style={{ marginTop: 10, fontSize: 14 }}>
                前回から地声最高音が{" "}
                <strong
                  className="data"
                  style={{
                    color:
                      delta > 0 ? "var(--phosphor-amber)" : "var(--etch)",
                  }}
                >
                  {delta > 0 ? `+${delta}` : delta}半音
                </strong>{" "}
                {delta > 0 ? "伸びました。" : "でした。"}
              </p>
            )}
          </div>
        </div>
      </section>

      <button
        className="btn btn-block"
        onClick={() => exportNameplateImage(data)}
        style={{ marginBottom: 10 }}
      >
        シェア画像を保存
      </button>
      <Link href="/songs">
        <button className="btn btn-accent btn-block" style={{ marginBottom: 10 }}>
          この音域で歌える曲を探す
        </button>
      </Link>
      <button className="btn btn-ghost btn-block" onClick={onRestart}>
        もう一度測定する
      </button>
    </main>
  );
}
