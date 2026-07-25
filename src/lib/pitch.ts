// 自己相関法によるピッチ検出(クライアントサイド完結・音声はサーバーに送らない)
// 検出範囲: 60〜1200Hz / AnalyserNode fftSize=2048

export const PITCH_MIN_HZ = 60;
export const PITCH_MAX_HZ = 1200;
export const RMS_THRESHOLD = 0.005;

export interface PitchResult {
  freq: number | null; // Hz。無音・非周期のとき null
  rms: number;
}

/**
 * 自己相関 + 放物線補間によるピッチ検出。
 * 相関は検出対象のラグ範囲(60〜1200Hz相当)のみ計算する。
 * オクターブエラー対策としてサブハーモニック検証を行う。
 */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchResult {
  const size = buf.length;
  let energy = 0;
  for (let i = 0; i < size; i++) energy += buf[i] * buf[i];
  const rms = Math.sqrt(energy / size);
  if (rms < RMS_THRESHOLD) return { freq: null, rms };

  const minLag = Math.max(2, Math.floor(sampleRate / PITCH_MAX_HZ));
  const maxLag = Math.min(size - 2, Math.ceil(sampleRate / PITCH_MIN_HZ));
  if (maxLag <= minLag) return { freq: null, rms };

  const c = new Float32Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) sum += buf[i] * buf[i + lag];
    c[lag] = sum;
  }

  // 最初の谷(相関の減少が止まる点)を越えてから最大ピークを探す
  let d = 1;
  while (d < maxLag && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let lag = Math.max(d, minLag); lag <= maxLag; lag++) {
    if (c[lag] > maxval) {
      maxval = c[lag];
      maxpos = lag;
    }
  }
  // c[0] = 総エネルギー。相関ピークが小さすぎる場合は非周期(ノイズ)とみなす
  if (maxpos <= 0 || maxval < 0.25 * c[0]) return { freq: null, rms };

  // サブハーモニック検証: 半分のラグ(1オクターブ上)に同等のピークがあればそちらを採用
  const half = Math.round(maxpos / 2);
  if (half >= minLag && c[half] > 0.85 * maxval) {
    maxpos = half;
  }

  // 放物線補間でラグを微調整
  let T0 = maxpos;
  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - b / (2 * a);

  const freq = sampleRate / T0;
  if (freq < PITCH_MIN_HZ || freq > PITCH_MAX_HZ) return { freq: null, rms };
  return { freq, rms };
}
