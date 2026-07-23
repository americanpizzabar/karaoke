// 自己相関法によるピッチ検出(クライアントサイド完結・音声はサーバーに送らない)
// 検出範囲: 60〜1200Hz / AnalyserNode fftSize=2048

export const PITCH_MIN_HZ = 60;
export const PITCH_MAX_HZ = 1200;
export const RMS_THRESHOLD = 0.008;

export interface PitchResult {
  freq: number | null; // Hz。無音・非周期のとき null
  rms: number;
}

/**
 * 正規化自己相関 + 放物線補間。
 * オクターブエラー対策としてサブハーモニック検証を行う。
 */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchResult {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < RMS_THRESHOLD) return { freq: null, rms };

  // 信号の端の無音をトリム
  let r1 = 0;
  let r2 = size - 1;
  const thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]) < thres) r1 = i;
    else break;
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]) < thres) r2 = size - i;
    else break;
  }
  const trimmed = buf.slice(r1, r2);
  const n = trimmed.length;
  if (n < 128) return { freq: null, rms };

  const c = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }

  // 最初の谷を越えてから最大ピークを探す
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  const minLag = Math.max(d, Math.floor(sampleRate / PITCH_MAX_HZ));
  const maxLag = Math.min(n - 1, Math.ceil(sampleRate / PITCH_MIN_HZ));
  for (let lag = minLag; lag < maxLag; lag++) {
    if (c[lag] > maxval) {
      maxval = c[lag];
      maxpos = lag;
    }
  }
  if (maxpos <= 0 || maxval < 0.3 * c[0]) return { freq: null, rms };

  // サブハーモニック検証: 半分のラグ(1オクターブ上)に同等のピークがあればそちらを採用
  const half = Math.round(maxpos / 2);
  if (half >= minLag && c[half] > 0.85 * maxval) {
    maxpos = half;
    maxval = c[half];
  }

  // 放物線補間でラグを微調整
  let T0 = maxpos;
  const x1 = c[T0 - 1] ?? c[T0];
  const x2 = c[T0];
  const x3 = c[T0 + 1] ?? c[T0];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - b / (2 * a);

  const freq = sampleRate / T0;
  if (freq < PITCH_MIN_HZ || freq > PITCH_MAX_HZ) return { freq: null, rms };
  return { freq, rms };
}
