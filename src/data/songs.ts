// 初期曲データ(参考値・未検証)
// 音域まとめサイト等の参考値を元にした近似値。is_verified=0 で投入し、
// UI側では必ず「参考値」である旨を表示すること(仕様 2.2.3)。
// MIDIノート番号: hiA = A4 = 69

export interface SeedSong {
  title: string;
  artist: string;
  chestMax: number; // 地声最高音
  falsettoMax?: number; // 裏声最高音
  lowest?: number; // 最低音
  originalKey?: string;
}

export const SEED_SONGS: SeedSong[] = [
  { title: "Pretender", artist: "Official髭男dism", chestMax: 70, falsettoMax: 73, lowest: 49, originalKey: "A♭" },
  { title: "Subtitle", artist: "Official髭男dism", chestMax: 71, falsettoMax: 76, lowest: 51 },
  { title: "ミックスナッツ", artist: "Official髭男dism", chestMax: 72, falsettoMax: 75, lowest: 50 },
  { title: "宿命", artist: "Official髭男dism", chestMax: 72, falsettoMax: 75, lowest: 51 },
  { title: "115万キロのフィルム", artist: "Official髭男dism", chestMax: 69, falsettoMax: 73, lowest: 48 },
  { title: "夜に駆ける", artist: "YOASOBI", chestMax: 73, falsettoMax: 77, lowest: 53, originalKey: "E♭m" },
  { title: "アイドル", artist: "YOASOBI", chestMax: 74, falsettoMax: 78, lowest: 54 },
  { title: "群青", artist: "YOASOBI", chestMax: 73, falsettoMax: 76, lowest: 52 },
  { title: "怪物", artist: "YOASOBI", chestMax: 74, falsettoMax: 77, lowest: 55 },
  { title: "Lemon", artist: "米津玄師", chestMax: 69, falsettoMax: 73, lowest: 49, originalKey: "B" },
  { title: "感電", artist: "米津玄師", chestMax: 70, falsettoMax: 74, lowest: 50 },
  { title: "KICK BACK", artist: "米津玄師", chestMax: 71, falsettoMax: 74, lowest: 47 },
  { title: "マリーゴールド", artist: "あいみょん", chestMax: 71, lowest: 52, originalKey: "D" },
  { title: "ドライフラワー", artist: "優里", chestMax: 70, falsettoMax: 72, lowest: 51 },
  { title: "ベテルギウス", artist: "優里", chestMax: 71, falsettoMax: 74, lowest: 52 },
  { title: "新時代", artist: "Ado", chestMax: 74, falsettoMax: 76, lowest: 53 },
  { title: "うっせぇわ", artist: "Ado", chestMax: 73, falsettoMax: 77, lowest: 50 },
  { title: "残酷な天使のテーゼ", artist: "高橋洋子", chestMax: 72, lowest: 57 },
  { title: "紅蓮華", artist: "LiSA", chestMax: 73, falsettoMax: 75, lowest: 56 },
  { title: "炎", artist: "LiSA", chestMax: 72, falsettoMax: 75, lowest: 54 },
  { title: "白日", artist: "King Gnu", chestMax: 70, falsettoMax: 81, lowest: 44 },
  { title: "一途", artist: "King Gnu", chestMax: 71, falsettoMax: 79, lowest: 50 },
  { title: "天体観測", artist: "BUMP OF CHICKEN", chestMax: 69, lowest: 50 },
  { title: "小さな恋のうた", artist: "MONGOL800", chestMax: 68, lowest: 51 },
  { title: "チェリー", artist: "スピッツ", chestMax: 67, falsettoMax: 69, lowest: 49 },
  { title: "楓", artist: "スピッツ", chestMax: 68, falsettoMax: 70, lowest: 50 },
  { title: "シンデレラボーイ", artist: "Saucy Dog", chestMax: 71, falsettoMax: 73, lowest: 54 },
  { title: "魔法の絨毯", artist: "川崎鷹也", chestMax: 69, falsettoMax: 71, lowest: 47 },
  { title: "猫", artist: "DISH//", chestMax: 69, falsettoMax: 72, lowest: 49 },
  { title: "さよならエレジー", artist: "菅田将暉", chestMax: 70, falsettoMax: 73, lowest: 52 },
  { title: "虹", artist: "菅田将暉", chestMax: 69, falsettoMax: 71, lowest: 48 },
  { title: "高嶺の花子さん", artist: "back number", chestMax: 70, falsettoMax: 73, lowest: 51 },
  { title: "クリスマスソング", artist: "back number", chestMax: 70, falsettoMax: 73, lowest: 49 },
  { title: "水平線", artist: "back number", chestMax: 69, falsettoMax: 72, lowest: 48 },
  { title: "Wherever you are", artist: "ONE OK ROCK", chestMax: 72, falsettoMax: 75, lowest: 51 },
  { title: "完全感覚Dreamer", artist: "ONE OK ROCK", chestMax: 73, falsettoMax: 76, lowest: 52 },
  { title: "丸ノ内サディスティック", artist: "椎名林檎", chestMax: 70, falsettoMax: 73, lowest: 56 },
  { title: "First Love", artist: "宇多田ヒカル", chestMax: 72, falsettoMax: 75, lowest: 53 },
  { title: "栄光の架橋", artist: "ゆず", chestMax: 71, falsettoMax: 74, lowest: 50 },
  { title: "夏色", artist: "ゆず", chestMax: 69, lowest: 50 },
  { title: "世界に一つだけの花", artist: "SMAP", chestMax: 67, lowest: 48 },
  { title: "打上花火", artist: "DAOKO×米津玄師", chestMax: 70, falsettoMax: 72, lowest: 53 },
  { title: "Bling-Bang-Bang-Born", artist: "Creepy Nuts", chestMax: 71, falsettoMax: 74, lowest: 48 },
  { title: "怪獣の花唄", artist: "Vaundy", chestMax: 70, falsettoMax: 75, lowest: 50 },
  { title: "踊り子", artist: "Vaundy", chestMax: 69, falsettoMax: 73, lowest: 50 },
];
