"use client";

import { create } from "zustand";

export interface RangeRecord {
  id: string;
  chestLow: number | null;
  chestHigh: number | null;
  falsettoHigh: number | null;
  measuredAt: string;
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

/** 音域履歴を取得(キャッシュ済みならそれを返す) */
export async function fetchRangeHistory(force = false): Promise<RangeRecord[]> {
  const { rangeHistory, setRangeHistory } = useAppStore.getState();
  if (rangeHistory && !force) return rangeHistory;
  const res = await fetch("/api/range");
  if (!res.ok) throw new Error("range fetch failed");
  const data = await res.json();
  setRangeHistory(data.records);
  return data.records;
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
