"use client";

import { memo, useEffect, useRef, useState } from "react";

/**
 * カスタムSVG 14セグメント表示(仕様書 4.1 / 7章)。
 * フォントではなくSVGで描画するため、オフラインでも崩れない。
 * 消灯セグメントも --groove でうっすら見せる(実機のVFDと同じ)。
 */

export type SegmentColor = "amber" | "cyan" | "red";

/* セル座標系: 24 x 40 */
export const CELL_W = 24;
export const CELL_H = 40;

/* 14セグメントの線分定義 [x1, y1, x2, y2] */
const SEG_LINES: Record<string, [number, number, number, number]> = {
  a: [4, 3, 20, 3],
  b: [21, 4, 21, 19],
  c: [21, 21, 21, 36],
  d: [4, 37, 20, 37],
  e: [3, 21, 3, 36],
  f: [3, 4, 3, 19],
  g1: [4, 20, 11, 20],
  g2: [13, 20, 20, 20],
  h: [5, 5, 10, 18], // 左上対角
  i: [12, 4, 12, 19], // 上中央縦
  j: [19, 5, 14, 18], // 右上対角
  k: [10, 22, 5, 35], // 左下対角
  l: [12, 21, 12, 36], // 下中央縦
  m: [14, 22, 19, 35], // 右下対角
};

export const ALL_SEGMENTS = Object.keys(SEG_LINES);

/* 文字→点灯セグメント。小文字は h/i/d/o/w/l のみ専用グリフ */
const CHAR_MAP: Record<string, string[]> = {
  " ": [],
  "-": ["g1", "g2"],
  "−": ["g1", "g2"],
  "+": ["g1", "g2", "i", "l"],
  "#": ["a", "b", "c", "g1", "g2", "i", "l"],
  ".": [],
  "/": ["j", "k"],
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g1", "g2", "e", "d"],
  "3": ["a", "b", "c", "d", "g2"],
  "4": ["f", "g1", "g2", "b", "c"],
  "5": ["a", "f", "g1", "g2", "c", "d"],
  "6": ["a", "f", "e", "d", "c", "g1", "g2"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g1", "g2"],
  "9": ["a", "b", "c", "d", "f", "g1", "g2"],
  A: ["a", "b", "c", "e", "f", "g1", "g2"],
  B: ["a", "b", "c", "d", "i", "l", "g2"],
  C: ["a", "d", "e", "f"],
  D: ["a", "b", "c", "d", "i", "l"],
  E: ["a", "d", "e", "f", "g1", "g2"],
  F: ["a", "e", "f", "g1", "g2"],
  G: ["a", "c", "d", "e", "f", "g2"],
  H: ["b", "c", "e", "f", "g1", "g2"],
  I: ["a", "d", "i", "l"],
  J: ["b", "c", "d", "e"],
  K: ["e", "f", "g1", "j", "m"],
  L: ["d", "e", "f"],
  M: ["b", "c", "e", "f", "h", "j"],
  N: ["b", "c", "e", "f", "h", "m"],
  O: ["a", "b", "c", "d", "e", "f"],
  P: ["a", "b", "e", "f", "g1", "g2"],
  Q: ["a", "b", "c", "d", "e", "f", "m"],
  R: ["a", "b", "e", "f", "g1", "g2", "m"],
  S: ["a", "c", "d", "f", "g1", "g2"],
  T: ["a", "i", "l"],
  U: ["b", "c", "d", "e", "f"],
  V: ["e", "f", "j", "k"],
  W: ["b", "c", "e", "f", "k", "m"],
  X: ["h", "j", "k", "m"],
  Y: ["h", "j", "l"],
  Z: ["a", "d", "j", "k"],
  /* 小文字グリフ(カラオケ表記 lowlow / low / mid1 / mid2 / hi / hihi 用)。
     大文字にフォールバックすると "MId2G" のように字面が崩れるため、
     表記に使う文字はすべて小文字グリフを持たせる。 */
  h: ["e", "f", "g1", "g2", "c"],
  i: ["l"],
  // 中央バー + 3本の脚で 14セグ上の小文字 m を作る
  m: ["g1", "g2", "e", "l", "c"],
  d: ["b", "c", "d", "e", "g1", "g2"],
  o: ["c", "d", "e", "g1", "g2"],
  w: ["b", "c", "e", "f", "k", "m"],
  l: ["e", "f"],
};

export function charSegments(ch: string): string[] {
  if (ch in CHAR_MAP) return CHAR_MAP[ch];
  const upper = ch.toUpperCase();
  if (upper in CHAR_MAP) return CHAR_MAP[upper];
  return [];
}

export const SEGMENT_HEX: Record<SegmentColor, string> = {
  amber: "#FFB454",
  cyan: "#7DF0D4",
  red: "#E8442E",
};

/**
 * SVGマークアップ文字列を生成(シェア画像の SVG→Canvas→PNG 用)。
 */
/* 軸平行セグメントは rect で描く。
   幅/高さゼロの line に %指定領域の SVG フィルタを適用すると
   フィルタ領域が空になり要素ごと消えるため(SVG仕様)。 */
const SEG_T = 2.8; // 素子の太さ

function segShape(seg: string): {
  kind: "rect" | "line";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
} {
  const [x1, y1, x2, y2] = SEG_LINES[seg];
  if (x1 === x2) {
    return { kind: "rect", x: x1 - SEG_T / 2, y: y1, w: SEG_T, h: y2 - y1 };
  }
  if (y1 === y2) {
    return { kind: "rect", x: x1, y: y1 - SEG_T / 2, w: x2 - x1, h: SEG_T };
  }
  return { kind: "line", x1, y1, x2, y2 };
}

export function segmentSvgMarkup(
  text: string,
  color: SegmentColor,
  opts: { cellHeight?: number; allLit?: boolean } = {}
): { markup: string; width: number; height: number } {
  const scale = (opts.cellHeight ?? CELL_H) / CELL_H;
  const chars = [...text];
  const width = chars.length * CELL_W * scale;
  const height = CELL_H * scale;
  const hex = SEGMENT_HEX[color];
  let body = "";
  chars.forEach((ch, ci) => {
    const lit = new Set(opts.allLit ? ALL_SEGMENTS : charSegments(ch));
    const dx = ci * CELL_W;
    for (const seg of ALL_SEGMENTS) {
      const on = lit.has(seg);
      const fill = on ? hex : "#2A2F38";
      const opacity = on ? 1 : 0.55;
      const s = segShape(seg);
      if (s.kind === "rect") {
        body += `<rect x="${(dx + s.x!) * scale}" y="${s.y! * scale}" width="${
          s.w! * scale
        }" height="${s.h! * scale}" rx="${1.4 * scale}" fill="${fill}" fill-opacity="${opacity}"/>`;
      } else {
        body += `<line x1="${(dx + s.x1!) * scale}" y1="${s.y1! * scale}" x2="${
          (dx + s.x2!) * scale
        }" y2="${s.y2! * scale}" stroke="${fill}" stroke-opacity="${opacity}" stroke-width="${
          SEG_T * scale
        }" stroke-linecap="round"/>`;
      }
    }
  });
  return { markup: body, width, height };
}

interface Props {
  value: string;
  color?: SegmentColor;
  /** セル高さ(px)。タイプスケール上 64–96px を許可 */
  cellHeight?: number;
  /** 表示桁数(固定幅レイアウト用)。value が短い場合は右詰め */
  chars?: number;
  /** 全セグメント点灯(起動シーケンス用) */
  allLit?: boolean;
  /** value 変化時の 80ms 全点灯フリッカーを無効化 */
  noFlicker?: boolean;
  /** 親幅に合わせて縮小(cellHeight は上限として扱う) */
  fluid?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** 発光グロー用の共有SVGフィルタ(feGaussianBlur を再利用) */
export function SegmentGlowDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="seg-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

function SegmentDisplayImpl({
  value,
  color = "amber",
  cellHeight = 40,
  chars,
  allLit = false,
  noFlicker = false,
  fluid = false,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const [flickering, setFlickering] = useState(false);
  const prevValue = useRef(value);

  // 音名が変わる瞬間に 80ms の全点灯フリッカー(5章)
  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    if (noFlicker) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    setFlickering(true);
    const t = setTimeout(() => setFlickering(false), 80);
    return () => clearTimeout(t);
  }, [value, noFlicker]);

  const scale = cellHeight / CELL_H;
  const padded =
    chars !== undefined ? value.slice(0, chars).padStart(chars, " ") : value;
  const charList = [...padded];
  const width = charList.length * CELL_W * scale;
  const hex = SEGMENT_HEX[color];
  const lit = allLit || flickering;

  return (
    <svg
      width={fluid ? undefined : width}
      height={fluid ? undefined : cellHeight}
      viewBox={`0 0 ${charList.length * CELL_W} ${CELL_H}`}
      role="img"
      aria-label={ariaLabel ?? value.trim()}
      className={className}
      style={
        fluid
          ? { display: "block", width: "100%", maxWidth: width, height: "auto" }
          : { display: "block" }
      }
    >
      {charList.map((ch, ci) => {
        const on = new Set(lit ? ALL_SEGMENTS : charSegments(ch));
        return (
          <g key={ci} transform={`translate(${ci * CELL_W}, 0)`}>
            {ALL_SEGMENTS.map((seg) => {
              const isOn = on.has(seg);
              const paint = isOn ? hex : "var(--groove, #2A2F38)";
              const opacity = isOn ? 1 : 0.55;
              const s = segShape(seg);
              if (s.kind === "rect") {
                return (
                  <rect
                    key={seg}
                    x={s.x}
                    y={s.y}
                    width={s.w}
                    height={s.h}
                    rx={1.4}
                    fill={paint}
                    fillOpacity={opacity}
                    filter={isOn ? "url(#seg-glow)" : undefined}
                  />
                );
              }
              return (
                <line
                  key={seg}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke={paint}
                  strokeOpacity={opacity}
                  strokeWidth={SEG_T}
                  strokeLinecap="round"
                  filter={isOn ? "url(#seg-glow)" : undefined}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 表示文字が変わらない限り再描画しない。
 * 親(チューナーフェイス)は針の物理演算で60Hz再描画されるため、
 * メモ化しないとセグメントのSVGを毎フレーム作り直すことになる。
 */
export const SegmentDisplay = memo(SegmentDisplayImpl);
