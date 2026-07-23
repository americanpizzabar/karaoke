"use client";

import { midiToKaraoke } from "@/lib/notes";

interface Props {
  currentMidi: number | null;
  chestLow?: number | null;
  chestHigh?: number | null;
  falsettoHigh?: number | null;
  min?: number;
  max?: number;
}

/**
 * 縦型LEDピッチメーター(シグネチャUI)。
 * 歌った音がリアルタイムで点灯し、記録済みの音域が「塗られていく」。
 */
export function PitchMeter({
  currentMidi,
  chestLow,
  chestHigh,
  falsettoHigh,
  min = 40,
  max = 84,
}: Props) {
  const cur = currentMidi !== null ? Math.round(currentMidi) : null;
  const segs = [];
  for (let n = min; n <= max; n++) {
    const inChest =
      chestLow != null && chestHigh != null && n >= chestLow && n <= chestHigh;
    const inFalsetto =
      chestHigh != null && falsettoHigh != null && n > chestHigh && n <= falsettoHigh;
    const isMarker = n === chestLow || n === chestHigh;
    const isFalsettoMarker = n === falsettoHigh;
    const lit = cur === n;
    const showLabel = n % 12 === 9 || n % 12 === 0; // Aと Cにラベル
    let cls = "meter-seg";
    if (inChest) cls += " in-chest";
    if (inFalsetto) cls += " in-falsetto";
    if (isMarker) cls += " marker-chest";
    if (isFalsettoMarker) cls += " marker-falsetto";
    if (lit) cls += " lit";
    segs.push(
      <div key={n} className={cls}>
        {showLabel && <span className="meter-label">{midiToKaraoke(n)}</span>}
      </div>
    );
  }
  return (
    <div
      className="meter-col"
      role="img"
      aria-label={
        cur !== null ? `現在の音: ${midiToKaraoke(cur)}` : "音を検出していません"
      }
    >
      {segs}
    </div>
  );
}
