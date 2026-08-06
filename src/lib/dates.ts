// 日時表示ユーティリティ
// SQLiteの datetime('now') はタイムゾーン表記のないUTC文字列
// ("YYYY-MM-DD HH:MM:SS")を返すため、UTCとして解釈してからJSTで表示する。

export function parseDbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  let s = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATETIME_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 例: "2026-07-25" */
export function formatDateJst(value: string | null | undefined): string | null {
  const d = parseDbDate(value);
  return d ? DATE_FMT.format(d) : null;
}

/** 例: "2026-07-25 16:52" */
export function formatDateTimeJst(value: string | null | undefined): string | null {
  const d = parseDbDate(value);
  return d ? DATETIME_FMT.format(d) : null;
}

/** 例: "07/25"(グラフ軸ラベル用) */
export function formatMonthDayJst(value: string | null | undefined): string {
  const d = formatDateJst(value);
  return d ? d.slice(5).replace("-", "/") : "";
}
