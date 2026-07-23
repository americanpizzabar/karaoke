// 音名変換ユーティリティ
// カラオケ表記: lowlow / low / mid1 / mid2 / hi / hihi(hiA = A4 = MIDI 69 = 440Hz)

const PITCH_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/** 科学的表記(例: A4, C#5) */
export function midiToScientific(midi: number): string {
  const n = Math.round(midi);
  return `${PITCH_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

/** カラオケ表記(例: hiA, mid2G#, lowF) */
export function midiToKaraoke(midi: number): string {
  const n = Math.round(midi);
  const name = PITCH_NAMES[((n % 12) + 12) % 12];
  let prefix: string;
  if (n <= 35) prefix = "lowlow";
  else if (n <= 47) prefix = "low";
  else if (n <= 59) prefix = "mid1";
  else if (n <= 68) prefix = "mid2";
  else if (n <= 80) prefix = "hi";
  else prefix = "hihi";
  return `${prefix}${name}`;
}

/** 表示用フルラベル(例: hiA (A4 / 440Hz)) */
export function midiToFullLabel(midi: number): string {
  const n = Math.round(midi);
  return `${midiToKaraoke(n)} (${midiToScientific(n)} / ${midiToFreq(n).toFixed(0)}Hz)`;
}

/** ±セント差(midiFloatと基準ノートの差) */
export function centsOff(midiFloat: number, targetMidi: number): number {
  return (midiFloat - targetMidi) * 100;
}
