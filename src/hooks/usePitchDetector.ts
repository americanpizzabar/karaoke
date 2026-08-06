"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch } from "@/lib/pitch";
import { freqToMidiFloat } from "@/lib/notes";

/** ピッチ解析の実行間隔(ms)。約30Hz。 */
const ANALYSIS_INTERVAL_MS = 33;

/**
 * 解析窓のサンプル数。48kHzで約85ms分。
 * lowlowA(55Hz)でも4周期以上入るため、低音の検出が安定する。
 */
const FFT_SIZE = 4096;

export interface PitchState {
  freq: number | null;
  midi: number | null; // 浮動小数(セント込み)
  rms: number;
  ts: number;
}

export interface PitchDetector {
  state: PitchState;
  active: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** ガイド音生成用に共有AudioContextを返す(start後のみ) */
  getAudioContext: () => AudioContext | null;
}

/**
 * マイク入力からリアルタイムピッチ検出を行うフック。
 * 音声処理は完全にクライアント内で完結し、音声データは送信しない。
 * iOS Safari対策: ユーザー操作(ボタンタップ)内で start() を呼ぶこと。
 */
export function usePitchDetector(): PitchDetector {
  const [state, setState] = useState<PitchState>({ freq: null, midi: null, rms: 0, ts: 0 });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const lastAnalysisRef = useRef(0);

  const loop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !ctx) return;
    rafRef.current = requestAnimationFrame(loop);

    // 解析は約30Hzに間引く。自己相関はコストが高く、毎フレーム(60Hz)回すと
    // 中位機で描画が詰まる。声の変化は30Hzで十分追える。
    const now = performance.now();
    if (now - lastAnalysisRef.current < ANALYSIS_INTERVAL_MS) return;
    lastAnalysisRef.current = now;

    if (!bufRef.current) bufRef.current = new Float32Array(analyser.fftSize);
    const buf = bufRef.current;
    analyser.getFloatTimeDomainData(buf);
    const { freq, rms } = detectPitch(buf, ctx.sampleRate);
    setState({
      freq,
      midi: freq ? freqToMidiFloat(freq) : null,
      rms,
      ts: now,
    });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      // ピッチ検出精度確保のため各種音声処理を無効化(仕様 2.1.2)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const ctx = new AudioContext();
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      source.connect(analyser);

      ctxRef.current = ctx;
      streamRef.current = stream;
      analyserRef.current = analyser;
      lastAnalysisRef.current = 0; // 開始直後の1回は即座に解析する
      setActive(true);
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError(
          "マイクの使用が許可されていません。ブラウザのサイト設定からマイクを許可して、再読み込みしてください。"
        );
      } else {
        setError("マイクを開始できませんでした。他のアプリがマイクを使用していないか確認してください。");
      }
    }
  }, [loop]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current = null;
    analyserRef.current = null;
    setActive(false);
    setState({ freq: null, midi: null, rms: 0, ts: 0 });
  }, []);

  // iOS Safari: バックグラウンド復帰時にAudioContextがサスペンドされるため再開する
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && ctxRef.current?.state === "suspended") {
        ctxRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => stop, [stop]);

  const getAudioContext = useCallback(() => ctxRef.current, []);

  return { state, active, error, start, stop, getAudioContext };
}
