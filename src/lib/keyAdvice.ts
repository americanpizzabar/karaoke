import { midiToKaraoke } from "./notes";

export type AdviceLevel = "easy" | "edge" | "shift" | "octave";

/** 判定対象の声区。表示文面の「地声/裏声」を切り替える */
export type VoiceType = "chest" | "falsetto";

export interface KeyAdvice {
  level: AdviceLevel;
  diff: number; // user - song(半音)
  keyShift: number; // 推奨キー変更(0なら原キー)
  label: string;
  detail: string;
}

/**
 * キー攻略判定(仕様 2.2.1)
 * chestDiff >= 2  → 原キーで余裕
 * chestDiff 0〜1  → 原キーでギリギリ可
 * chestDiff < 0   → キー ±n を推奨(下限 -7、超える場合はオクターブ下+キー)
 */
export function judgeKey(
  userHigh: number,
  songMax: number,
  voice: VoiceType = "chest"
): KeyAdvice {
  const diff = userHigh - songMax;
  const voiceLabel = voice === "falsetto" ? "裏声" : "地声";

  if (diff >= 2) {
    return {
      level: "easy",
      diff,
      keyShift: 0,
      label: "原キーで余裕",
      detail: `最高音 ${midiToKaraoke(songMax)} に対して ${diff} 半音の余裕があります。`,
    };
  }
  if (diff >= 0) {
    return {
      level: "edge",
      diff,
      keyShift: 0,
      label: "原キーでギリギリ可",
      detail:
        voice === "falsetto"
          ? "余裕は1半音以下です。息を混ぜて軽く当てると安定します。"
          : "余裕は1半音以下です。サビ前に喉を温めてから挑みましょう。",
    };
  }
  if (diff >= -7) {
    return {
      level: "shift",
      diff,
      keyShift: diff,
      label: `キー ${diff} を推奨`,
      detail: `最高音が ${-diff} 半音超えています。キー ${diff} なら${voiceLabel}で届きます。`,
    };
  }
  const octaveShift = diff + 12; // 1オクターブ下で歌う場合の+キー
  return {
    level: "octave",
    diff,
    keyShift: Math.max(diff, -7),
    label: `キー -7 または +${octaveShift}(オクターブ下)`,
    detail: `差が ${-diff} 半音と大きいため、キー +${octaveShift} にして1オクターブ下で歌う方法も有効です。`,
  };
}

/** 歌える曲リスト用の3分類 */
export type SingableClass = "original" | "minus2" | "hard";

export function classifySingable(userHigh: number, songMax: number): SingableClass {
  const diff = userHigh - songMax;
  if (diff >= 0) return "original";
  if (diff >= -2) return "minus2";
  return "hard";
}
