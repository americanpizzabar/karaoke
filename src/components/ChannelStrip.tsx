"use client";

import { useEffect, useRef, useState } from "react";
import { midiToKaraoke } from "@/lib/notes";

/**
 * チャンネルストリップ: 縦型LEDラダー(仕様書 3章)。
 * 素子は 2px 角丸の「機材のLED」。地声=amber、裏声=cyan、現在音=signal-red。
 * C音の位置に長ティック+刻印ラベル。
 * 記録完了時は該当域が下から順に点灯(1素子8ms間隔)+ HOLD 刻印が点滅2回。
 */

interface Props {
  currentMidi: number | null;
  chestLow?: number | null;
  chestHigh?: number | null;
  falsettoHigh?: number | null;
  min?: number;
  max?: number;
  /** インクリメントすると記録完了スイープを再生 */
  sweepToken?: number;
  height?: number;
}

const LED_W = 26;
const LABEL_W = 46;

export function ChannelStrip({
  currentMidi,
  chestLow,
  chestHigh,
  falsettoHigh,
  min = 40,
  max = 84,
  sweepToken = 0,
  height = 320,
}: Props) {
  const count = max - min + 1;
  const cur = currentMidi !== null ? Math.round(currentMidi) : null;

  // 記録完了スイープ: 下から順に1素子8msで点灯 → HOLD点滅
  const [sweepUpTo, setSweepUpTo] = useState<number | null>(null);
  const [holdBlink, setHoldBlink] = useState(0);
  const prevToken = useRef(sweepToken);

  useEffect(() => {
    if (sweepToken === prevToken.current) return;
    prevToken.current = sweepToken;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setHoldBlink((b) => b + 1);
      return;
    }
    let n = min;
    setSweepUpTo(min);
    const iv = setInterval(() => {
      n += 1;
      if (n > max) {
        clearInterval(iv);
        setSweepUpTo(null);
        setHoldBlink((b) => b + 1);
        return;
      }
      setSweepUpTo(n);
    }, 8);
    return () => clearInterval(iv);
  }, [sweepToken, min, max]);

  const cellH = height / count;
  const ledH = Math.max(2, cellH - 2);

  const leds = [];
  for (let i = 0; i < count; i++) {
    const n = min + i;
    const y = height - (i + 1) * cellH + 1;
    const inChest =
      chestLow != null && chestHigh != null && n >= chestLow && n <= chestHigh;
    const inFalsetto =
      chestHigh != null &&
      falsettoHigh != null &&
      n > chestHigh &&
      n <= falsettoHigh;
    const isChestMarker = n === chestLow || n === chestHigh;
    const isFalsettoMarker = n === falsettoHigh;
    const isCur = cur === n;
    const isSwept = sweepUpTo !== null && n <= sweepUpTo;

    let fill = "var(--groove)";
    let glow = false;
    let opacity = 1;
    if (inChest) {
      fill = "var(--phosphor-amber)";
      opacity = 0.3;
    }
    if (inFalsetto) {
      fill = "var(--phosphor-cyan)";
      opacity = 0.3;
    }
    if (isChestMarker) {
      fill = "var(--phosphor-amber)";
      opacity = 1;
      glow = true;
    }
    if (isFalsettoMarker) {
      fill = "var(--phosphor-cyan)";
      opacity = 1;
      glow = true;
    }
    if (isSwept) {
      fill = "var(--phosphor-amber)";
      opacity = 1;
      glow = true;
    }
    if (isCur) {
      fill = "var(--signal-red)"; // 現在音のピークのみ signal-red
      opacity = 1;
      glow = true;
    }

    leds.push(
      <rect
        key={n}
        x={LABEL_W + 2}
        y={y}
        width={LED_W}
        height={ledH}
        rx={2}
        fill={fill}
        fillOpacity={opacity}
        filter={glow ? "url(#seg-glow)" : undefined}
      />
    );

    // C音の位置に長ティック+刻印ラベル
    if (n % 12 === 0) {
      const ty = y + ledH / 2;
      leds.push(
        <g key={`tick-${n}`}>
          <line
            x1={LABEL_W - 8}
            y1={ty}
            x2={LABEL_W}
            y2={ty}
            stroke="var(--etch)"
            strokeWidth={1}
          />
          <text
            x={LABEL_W - 12}
            y={ty + 3}
            textAnchor="end"
            fill="var(--etch)"
            fontSize={8.5}
            letterSpacing={0.6}
            fontFamily="var(--font-data)"
          >
            {midiToKaraoke(n)}
          </text>
        </g>
      );
    } else {
      // 等間隔の 1px ティック
      const ty = y + ledH / 2;
      leds.push(
        <line
          key={`tick-${n}`}
          x1={LABEL_W - 4}
          y1={ty}
          x2={LABEL_W}
          y2={ty}
          stroke="var(--groove)"
          strokeWidth={1}
        />
      );
    }
  }

  return (
    <div style={{ width: LABEL_W + LED_W + 4, flexShrink: 0 }}>
      <div
        className="etch-label"
        style={{ textAlign: "right", marginBottom: 6, paddingRight: 2 }}
      >
        RANGE
      </div>
      <svg
        width={LABEL_W + LED_W + 4}
        height={height}
        role="img"
        aria-label={
          cur !== null
            ? `現在の音: ${midiToKaraoke(cur)}`
            : "音を検出していません"
        }
      >
        {leds}
      </svg>
      <div
        key={holdBlink}
        className={`etch-label${holdBlink > 0 ? " hold-blink" : ""}`}
        style={{
          textAlign: "right",
          marginTop: 6,
          paddingRight: 2,
          color: holdBlink > 0 ? "var(--phosphor-amber)" : undefined,
          visibility: holdBlink > 0 ? "visible" : "hidden",
        }}
      >
        HOLD
      </div>
    </div>
  );
}
