"use client";

import { memo, useEffect, useRef, useState } from "react";
import { SegmentDisplay } from "@/components/SegmentDisplay";
import { midiToFreq, midiToKaraoke, midiToScientific } from "@/lib/notes";
import { RMS_THRESHOLD } from "@/lib/pitch";

/**
 * シグネチャ要素: チューナーフェイス(仕様書 3章)。
 * 14セグ音名表示 + セント偏差のアナログ針(バネ物理)+ 入力レベルVU。
 */

interface Props {
  midi: number | null; // 浮動小数(セント込み)
  rms: number;
  recording?: boolean;
  /** 指定時、針はこの音からの偏差を示す(トレーニングのターゲット音) */
  referenceMidi?: number | null;
  /** ターゲット音名をcyanで固定表示(S5 ロングトーン) */
  targetLabel?: string | null;
}

/** バネ・ダンパー物理の針(stiffness 170 / damping 14 相当) */
function useSpringValue(target: number) {
  const [value, setValue] = useState(target);
  const pos = useRef(target);
  const vel = useRef(0);
  const targetRef = useRef(target);
  const rafRef = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    targetRef.current = target;
    if (reduced.current) {
      pos.current = target;
      setValue(target);
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 170;
      const c = 14;
      const x = pos.current;
      const a = -k * (x - targetRef.current) - c * vel.current;
      vel.current += a * dt;
      pos.current += vel.current * dt;
      setValue(pos.current);
      if (
        Math.abs(pos.current - targetRef.current) > 0.05 ||
        Math.abs(vel.current) > 0.05
      ) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        pos.current = targetRef.current;
        vel.current = 0;
        setValue(targetRef.current);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return value;
}

/* 計器の寸法(viewBox 260×104) */
const CX = 130;
const CY = 92;
const NEEDLE_LEN = 74;

/** 目盛りは不変なのでモジュール読み込み時に1度だけ作る */
const GAUGE_TICKS = (() => {
  const ticks = [];
  for (let c = -50; c <= 50; c += 5) {
    const long = c % 25 === 0;
    const a = ((c / 50) * 45 - 90) * (Math.PI / 180);
    const r1 = 80;
    const r2 = long ? 68 : 74;
    ticks.push(
      <line
        key={c}
        x1={CX + r1 * Math.cos(a)}
        y1={CY + r1 * Math.sin(a)}
        x2={CX + r2 * Math.cos(a)}
        y2={CY + r2 * Math.sin(a)}
        stroke={c === 0 ? "var(--phosphor-amber)" : "var(--groove)"}
        strokeWidth={c === 0 ? 1.5 : 1}
      />
    );
  }
  return ticks;
})();

/**
 * セント偏差の計器。針のバネ物理は60Hzで値が変わるため、
 * 親から切り離して この小さなSVGだけが再描画されるようにする。
 */
const CentsGauge = memo(function CentsGauge({
  cents,
  hasSignal,
}: {
  cents: number;
  hasSignal: boolean;
}) {
  const needleCents = useSpringValue(cents);
  const rad = (((needleCents / 50) * 45 - 90) * Math.PI) / 180;
  const nx = CX + NEEDLE_LEN * Math.cos(rad);
  const ny = CY + NEEDLE_LEN * Math.sin(rad);

  return (
    <svg
      viewBox="0 0 260 104"
      style={{ width: "100%", display: "block" }}
      role="img"
      aria-label={
        hasSignal
          ? `セント偏差 ${cents >= 0 ? "+" : ""}${cents.toFixed(0)}`
          : "セント偏差 計測待ち"
      }
    >
      {GAUGE_TICKS}
      <text x={CX - 86} y={30} fill="var(--etch)" fontSize="9" fontFamily="var(--font-data)">
        -50
      </text>
      <text x={CX + 70} y={30} fill="var(--etch)" fontSize="9" fontFamily="var(--font-data)">
        +50
      </text>
      {/* 針(グローは二重線。垂直線+SVGフィルタは領域が空になり消えるため) */}
      {hasSignal && (
        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="var(--phosphor-amber)"
          strokeOpacity={0.3}
          strokeWidth={5}
          strokeLinecap="round"
        />
      )}
      <line
        x1={CX}
        y1={CY}
        x2={nx}
        y2={ny}
        stroke={hasSignal ? "var(--phosphor-amber)" : "var(--groove)"}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r={3} fill="var(--groove)" />
      <text
        x={CX}
        y={102}
        fill="var(--etch)"
        fontSize="9"
        letterSpacing="1.2"
        textAnchor="middle"
        fontFamily="var(--font-body)"
      >
        CENTS
      </text>
    </svg>
  );
});

export function TunerFace({
  midi,
  rms,
  recording = false,
  referenceMidi = null,
  targetLabel = null,
}: Props) {
  const hasSignal = midi !== null;
  const note = hasSignal ? Math.round(midi!) : null;

  // セント偏差: referenceMidi 指定時はターゲットから、通常は最寄り音から
  const cents = hasSignal
    ? Math.max(
        -50,
        Math.min(
          50,
          (midi! - (referenceMidi ?? Math.round(midi!))) * 100
        )
      )
    : 0;

  // 入力レベルVU: RMS→12素子。ピーク素子のみ signal-red(900msホールド)
  const litCount = Math.min(12, Math.round((rms / 0.06) * 12));
  const [peak, setPeak] = useState(0);
  const peakTsRef = useRef(0);
  useEffect(() => {
    const now = performance.now();
    if (litCount >= peak || now - peakTsRef.current > 900) {
      peakTsRef.current = now;
      setPeak(litCount);
    }
  }, [litCount, peak]);

  return (
    <div>
      {/* 刻印ラベル+状態LED */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span className="etch-label">
          <span
            className={`led-dot${rms >= RMS_THRESHOLD ? " on-amber" : ""}`}
            style={{ marginRight: 6 }}
          />
          INPUT
        </span>
        <span className="etch-label">TUNER</span>
        <span className="etch-label">
          REC
          <span
            className={`led-dot${recording ? " on-red" : ""}`}
            style={{ marginLeft: 6 }}
          />
        </span>
      </div>

      {/* 表示窓 */}
      <div
        style={{
          background: "var(--chassis)",
          border: "1px solid var(--groove)",
          borderRadius: 4,
          padding: "12px 12px 4px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <SegmentDisplay
            value={note !== null ? midiToKaraoke(note) : "----"}
            color="amber"
            cellHeight={64}
            chars={8}
            fluid
            aria-label={
              note !== null
                ? `現在の音: ${midiToKaraoke(note)}`
                : "音を検出していません"
            }
          />
        </div>
        <div
          className="data"
          style={{
            color: "var(--etch)",
            fontSize: 11,
            marginTop: 6,
            minHeight: 15,
          }}
        >
          {note !== null
            ? `${midiToScientific(note)}  ${midiToFreq(note).toFixed(0)}Hz`
            : rms < RMS_THRESHOLD
              ? "NO INPUT"
              : "DETECTING"}
        </div>

        {targetLabel && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
            }}
          >
            <span className="etch-label">TARGET</span>
            <SegmentDisplay
              value={targetLabel}
              color="cyan"
              cellHeight={24}
              noFlicker
              aria-label={`ターゲット音: ${targetLabel}`}
            />
          </div>
        )}

        {/* セント偏差針 */}
        <div style={{ borderTop: "1px solid var(--groove)", marginTop: 8 }}>
          <CentsGauge cents={cents} hasSignal={hasSignal} />
        </div>
      </div>

      {/* 入力レベルVU(12素子・横型) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 10,
          whiteSpace: "nowrap",
        }}
      >
        <svg width={12 * 12} height={10} role="img" aria-label="入力レベル">
          {Array.from({ length: 12 }, (_, i) => {
            const isOn = i < litCount;
            const isPeak = peak > 0 && i === peak - 1;
            return (
              <rect
                key={i}
                x={i * 12}
                y={0}
                width={8}
                height={10}
                rx={2}
                fill={
                  isPeak
                    ? "var(--signal-red)"
                    : isOn
                      ? "var(--phosphor-amber)"
                      : "var(--groove)"
                }
                filter={isOn || isPeak ? "url(#seg-glow)" : undefined}
              />
            );
          })}
        </svg>
        <span className="etch-label">INPUT LEVEL</span>
      </div>
    </div>
  );
}
