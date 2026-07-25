"use client";

import { SegmentDisplay, segmentSvgMarkup } from "@/components/SegmentDisplay";
import { midiToKaraoke } from "@/lib/notes";

/**
 * 銘板(ネームプレート)— 機材の背面パネルの仕様表(仕様書 S3)。
 * S1 ホームでは compact 版を最上部に置く。
 */

export interface NameplateData {
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
  measuredAt: string | null; // ISO文字列
  serial: number | null; // 測定通し番号
}

function spanSemitones(d: NameplateData): number | null {
  const top = d.falsettoHigh ?? d.chestHigh;
  if (top == null || d.chestLow == null) return null;
  return top - d.chestLow;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(0, 10)}  JST`;
}

function fmtSerial(serial: number | null): string {
  return serial != null ? `No.${String(serial).padStart(6, "0")}` : "No.——";
}

export function Nameplate({
  data,
  compact = false,
}: {
  data: NameplateData;
  compact?: boolean;
}) {
  const span = spanSemitones(data);
  const chestText =
    data.chestLow != null || data.chestHigh != null
      ? `${data.chestLow != null ? midiToKaraoke(data.chestLow) : "—"} — ${
          data.chestHigh != null ? midiToKaraoke(data.chestHigh) : "—"
        }`
      : null;

  const segH = compact ? 18 : 22;

  return (
    <div className="nameplate" aria-label="音域の銘板">
      <div className="etch-label">VOCAL RANGE CERTIFICATE</div>
      <div className="nameplate-rule" />

      <div className="nameplate-row">
        <span className="etch-label">CHEST</span>
        {chestText ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {data.chestLow != null ? (
              <SegmentDisplay
                value={midiToKaraoke(data.chestLow)}
                color="amber"
                cellHeight={segH}
                noFlicker
              />
            ) : (
              <span className="data muted">—</span>
            )}
            <span className="data" style={{ color: "var(--etch)" }}>
              —
            </span>
            {data.chestHigh != null ? (
              <SegmentDisplay
                value={midiToKaraoke(data.chestHigh)}
                color="amber"
                cellHeight={segH}
                noFlicker
              />
            ) : (
              <span className="data muted">—</span>
            )}
          </span>
        ) : (
          <span className="data muted">未測定</span>
        )}
      </div>

      <div className="nameplate-row">
        <span className="etch-label">FALSETTO</span>
        {data.falsettoHigh != null ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="data" style={{ color: "var(--etch)" }}>
              —
            </span>
            <SegmentDisplay
              value={midiToKaraoke(data.falsettoHigh)}
              color="cyan"
              cellHeight={segH}
              noFlicker
            />
          </span>
        ) : (
          <span className="data muted">—</span>
        )}
      </div>

      <div className="nameplate-row">
        <span className="etch-label">SPAN</span>
        <span className="data" style={{ fontSize: 13 }}>
          {span != null ? `${span} semitones` : "—"}
        </span>
      </div>

      {!compact && (
        <>
          <div className="nameplate-row">
            <span className="etch-label">MEASURED</span>
            <span className="data" style={{ fontSize: 13 }}>
              {fmtDate(data.measuredAt)}
            </span>
          </div>
          <div className="nameplate-row">
            <span className="etch-label">SERIAL</span>
            <span className="data" style={{ fontSize: 13 }}>
              {fmtSerial(data.serial)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 銘板をシェア画像(OGP 1200×630)として書き出す。
 * SVG → Canvas → PNG(仕様書 8章)。
 */
export async function exportNameplateImage(data: NameplateData): Promise<void> {
  const W = 1200;
  const H = 630;
  const span = spanSemitones(data);

  const rows: { label: string; segs: { text: string; color: "amber" | "cyan" }[]; plain?: string }[] = [
    {
      label: "CHEST",
      segs: [
        ...(data.chestLow != null
          ? [{ text: midiToKaraoke(data.chestLow), color: "amber" as const }]
          : []),
        ...(data.chestHigh != null
          ? [{ text: midiToKaraoke(data.chestHigh), color: "amber" as const }]
          : []),
      ],
    },
    {
      label: "FALSETTO",
      segs:
        data.falsettoHigh != null
          ? [{ text: midiToKaraoke(data.falsettoHigh), color: "cyan" as const }]
          : [],
    },
    { label: "SPAN", segs: [], plain: span != null ? `${span} semitones` : "—" },
    { label: "MEASURED", segs: [], plain: fmtDate(data.measuredAt) },
    { label: "SERIAL", segs: [], plain: fmtSerial(data.serial) },
  ];

  const mono = "'IBM Plex Mono', ui-monospace, monospace";
  const plateX = 120;
  const plateY = 90;
  const plateW = W - 240;
  const plateH = H - 180;

  let inner = "";
  // タイトル+罫線
  inner += `<text x="${plateX + 44}" y="${plateY + 66}" fill="#868D99" font-family="${mono}" font-size="24" letter-spacing="4">VOCAL RANGE CERTIFICATE</text>`;
  inner += `<rect x="${plateX + 44}" y="${plateY + 86}" width="${plateW - 88}" height="2" fill="#2A2F38"/>`;

  const rowH = 62;
  rows.forEach((row, i) => {
    const y = plateY + 130 + i * rowH;
    inner += `<text x="${plateX + 44}" y="${y + 30}" fill="#868D99" font-family="${mono}" font-size="20" letter-spacing="3">${row.label}</text>`;
    let x = plateX + 300;
    if (row.segs.length > 0) {
      row.segs.forEach((seg, si) => {
        const { markup, width } = segmentSvgMarkup(seg.text, seg.color, {
          cellHeight: 44,
        });
        if (si > 0) {
          inner += `<text x="${x + 4}" y="${y + 32}" fill="#868D99" font-family="${mono}" font-size="26">—</text>`;
          x += 40;
        }
        inner += `<g transform="translate(${x}, ${y - 2})">${markup}</g>`;
        x += width + 12;
      });
    } else {
      inner += `<text x="${plateX + 300}" y="${y + 30}" fill="#E9EAEE" font-family="${mono}" font-size="26">${row.plain ?? "—"}</text>`;
    }
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#15171C"/>
    <rect x="${plateX}" y="${plateY}" width="${plateW}" height="${plateH}" rx="10" fill="#1E2229" stroke="#2A2F38" stroke-width="2"/>
    <rect x="${plateX}" y="${plateY}" width="${plateW}" height="2" rx="1" fill="rgba(255,255,255,0.06)"/>
    ${inner}
    <text x="${W - 130}" y="${H - 36}" text-anchor="end" fill="#868D99" font-family="${mono}" font-size="18" letter-spacing="2">ONIKI ATTACK — RANGE FINDER</text>
  </svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, W, H);
    const png = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = png;
    a.download = "oniki-attack-nameplate.png";
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
