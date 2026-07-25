"use client";

import { create } from "zustand";

export interface RangeRecord {
  id: string;
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
  measuredAt: string;
}

export interface TrainingLog {
  id: string;
  menu: string;
  targetNote: number | null;
  achieved: boolean | null;
  stabilityCents: number | null;
  doneAt: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  chestMax: number;
  falsettoMax: number | null;
  lowest: number | null;
  originalKey: string | null;
  isVerified: boolean;
}

interface AppState {
  latestRange: RangeRecord | null;
  rangeHistory: RangeRecord[] | null;
  songs: Song[] | null;
  setRangeHistory: (records: RangeRecord[]) => void;
  setSongs: (songs: Song[]) => void;
  invalidateRange: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  latestRange: null,
  rangeHistory: null,
  songs: null,
  setRangeHistory: (records) =>
    set({ rangeHistory: records, latestRange: records[0] ?? null }),
  setSongs: (songs) => set({ songs }),
  invalidateRange: () => set({ rangeHistory: null, latestRange: null }),
}));

/* ------------------------------------------------------------------
   端末内保存(localStorage)フォールバック。
   サーバーDB(Turso)が未設定・接続不可でも、測定記録とトレーニング
   ログはこの端末内に保存してアプリを完全動作させる。
   ------------------------------------------------------------------ */

const LS_RANGE = "oa_range_history";
const LS_TRAINING = "oa_training_logs";

function loadLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function storeLocal<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, 200)));
  } catch {
    /* 容量超過などは無視 */
  }
}

/** 端末内の測定履歴・トレーニングログを全削除(設定画面のデータ削除用) */
export function clearLocalData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_RANGE);
    localStorage.removeItem(LS_TRAINING);
  } catch {
    /* noop */
  }
}

export type SaveMode = "server" | "local";

/** 音域履歴を取得(サーバー優先、未接続時は端末内保存分) */
export async function fetchRangeHistory(force = false): Promise<RangeRecord[]> {
  const { rangeHistory, setRangeHistory } = useAppStore.getState();
  if (rangeHistory && !force) return rangeHistory;
  let records: RangeRecord[] = [];
  try {
    const res = await fetch("/api/range");
    if (!res.ok) throw new Error("range fetch failed");
    const data = await res.json();
    records = data.records ?? [];
  } catch {
    /* サーバー到達不能 → 端末内保存分へ */
  }
  if (records.length === 0) {
    const local = loadLocal<RangeRecord>(LS_RANGE);
    if (local.length > 0) records = local;
  }
  setRangeHistory(records);
  return records;
}

/** 測定結果を保存。サーバー未接続時は端末内に保存し "local" を返す */
export async function saveRangeRecord(input: {
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
}): Promise<SaveMode> {
  let mode: SaveMode = "server";
  try {
    const res = await fetch("/api/range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("range save failed");
  } catch {
    mode = "local";
    const rec: RangeRecord = {
      id: crypto.randomUUID(),
      ...input,
      measuredAt: new Date().toISOString(),
    };
    storeLocal(LS_RANGE, [rec, ...loadLocal<RangeRecord>(LS_RANGE)]);
  }
  useAppStore.getState().invalidateRange();
  await fetchRangeHistory(true).catch(() => {});
  return mode;
}

/** トレーニングログを取得(サーバー優先、未接続時は端末内保存分) */
export async function fetchTrainingLogs(): Promise<TrainingLog[]> {
  try {
    const res = await fetch("/api/training");
    if (!res.ok) throw new Error("training fetch failed");
    const data = await res.json();
    const logs: TrainingLog[] = data.logs ?? [];
    if (logs.length > 0) return logs;
  } catch {
    /* サーバー到達不能 → 端末内保存分へ */
  }
  return loadLocal<TrainingLog>(LS_TRAINING);
}

/** トレーニングログを保存。サーバー未接続時は端末内に保存 */
export async function saveTrainingLog(input: {
  menu: string;
  targetNote: number | null;
  achieved: boolean;
  stabilityCents: number | null;
}): Promise<SaveMode> {
  try {
    const res = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("training save failed");
    return "server";
  } catch {
    const log: TrainingLog = {
      id: crypto.randomUUID(),
      menu: input.menu,
      targetNote: input.targetNote,
      achieved: input.achieved,
      stabilityCents: input.stabilityCents,
      doneAt: new Date().toISOString(),
    };
    storeLocal(LS_TRAINING, [log, ...loadLocal<TrainingLog>(LS_TRAINING)]);
    return "local";
  }
}

export async function fetchSongs(): Promise<Song[]> {
  const { songs, setSongs } = useAppStore.getState();
  if (songs) return songs;
  const res = await fetch("/api/songs");
  if (!res.ok) throw new Error("songs fetch failed");
  const data = await res.json();
  setSongs(data.songs);
  return data.songs;
}
