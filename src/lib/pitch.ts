// 自己相関法によるピッチ検出(クライアントサイド完結・音声はサーバーに送らない)
// 検出範囲: 55〜1200Hz(lowlowA 〜 hihiD 相当)

export const PITCH_MIN_HZ = 55; // lowlowA (A1) を測れるようにする
export const PITCH_MAX_HZ = 1200;
export const RMS_THRESHOLD = 0.005;

/**
 * 解析前の間引き率。ピッチ帯域(〜1200Hz)には 2 分の 1(24kHz相当)で
 * 十分な一方、自己相関の計算量は約 4 分の 1 になる。
 * 間引き時は隣接2サンプルの平均を取り、簡易ローパスとして折り返しを抑える。
 */
const DECIMATION = 2;

export interface PitchResult {
  freq: number | null; // Hz。無音・非周期のとき null
  rms: number;
}

/**
 * 自己相関 + 放物線補間によるピッチ検出。
 * 相関は検出対象のラグ範囲のみ計算する。
 * オクターブエラー対策として、サンプル数の違いを正規化したうえで
 * サブハーモニック(半分のラグ)を検証する。
 */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchResult {
  // RMS は間引き前の原波形から求める(入力レベル表示の精度を保つため)
  let energy = 0;
  for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
  const rms = Math.sqrt(energy / buf.length);
  if (rms < RMS_THRESHOLD) return { freq: null, rms };

  // 間引き(隣接平均)
  const size = Math.floor(buf.length / DECIMATION);
  const sr = sampleRate / DECIMATION;
  const x = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let s = 0;
    for (let k = 0; k < DECIMATION; k++) s += buf[i * DECIMATION + k];
    x[i] = s / DECIMATION;
  }

  // 直流成分を除去(マイクのDCオフセットが相関を歪めるのを防ぐ)
  let mean = 0;
  for (let i = 0; i < size; i++) mean += x[i];
  mean /= size;
  for (let i = 0; i < size; i++) x[i] -= mean;

  const minLag = Math.max(2, Math.floor(sr / PITCH_MAX_HZ));
  const maxLag = Math.min(size - 2, Math.ceil(sr / PITCH_MIN_HZ));
  if (maxLag <= minLag) return { freq: null, rms };

  const c = new Float32Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) sum += x[i] * x[i + lag];
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

  // サブハーモニック検証: 半分のラグ(1オクターブ上)に同等のピークがあれば採用。
  // c[lag] は (size - lag) 項の総和でラグが長いほど小さく出るため、
  // 項数で正規化してから比較する(正規化しないと常に半ラグ側が有利になる)。
  const half = Math.round(maxpos / 2);
  if (half >= minLag) {
    const normHalf = c[half] / (size - half);
    const normMax = maxval / (size - maxpos);
    if (normHalf > 0.85 * normMax) maxpos = half;
  }

  // 放物線補間でラグを微調整
  let T0 = maxpos;
  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - b / (2 * a);

  const freq = sr / T0;
  if (freq < PITCH_MIN_HZ || freq > PITCH_MAX_HZ) return { freq: null, rms };
  return { freq, rms };
}
