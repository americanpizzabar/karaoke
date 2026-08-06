// 音域データの補完ルール(全画面で同じ扱いにするための単一の窓口)

/**
 * 最低音は測定でスキップできる。未記録の場合は地声最高音の
 * 1オクターブ下を暫定値として扱う。
 * トレーニングのターゲット算出と曲攻略のパッチベイ表示で共通に使う。
 */
export function effectiveChestLow(
  chestLow: number | null | undefined,
  chestHigh: number | null | undefined
): number | null {
  if (chestLow != null) return chestLow;
  return chestHigh != null ? chestHigh - 12 : null;
}
