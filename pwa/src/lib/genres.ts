import type { Library, Track, UserData } from "./types";

export const DEFAULT_GENRES = [
  "J-POP",
  "アニソン",
  "クラシック",
  "ジャズ",
  "ロック",
  "ポップス",
  "電子音楽",
  "ヒップホップ",
  "サウンドトラック",
  "ゲーム音楽",
  "ボカロ",
  "演歌",
  "童謡",
  "その他",
];

const PALETTE = [
  "#f43f5e",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
  "#d97706",
  "#22c55e",
  "#71717a",
];

export function genreColor(name: string): string {
  const index = DEFAULT_GENRES.indexOf(name);
  if (index >= 0) return PALETTE[index % PALETTE.length];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const RULES: { genre: string; words: string[] }[] = [
  {
    genre: "クラシック",
    words: [
      "交響曲",
      "協奏曲",
      "ソナタ",
      "レクイエム",
      "管弦楽",
      "組曲",
      "アリア",
      "ワルツ",
      "オペラ",
      "メサイア",
      "ベートーヴェン",
      "モーツァルト",
      "バッハ",
      "ショパン",
      "ブラームス",
      "チャイコフスキー",
      "ドビュッシー",
      "ラヴェル",
      "マーラー",
      "ハイドン",
      "シューベルト",
      "ヴィヴァルディ",
      "ヘンデル",
      "symphony",
      "concerto",
      "sonata",
      "requiem",
      "orchestra",
      "classical",
    ],
  },
  {
    genre: "アニソン",
    words: [
      "アニソン",
      "アニメ",
      "主題歌",
      "オープニング",
      "エンディング",
      "キャラクターソング",
      "tv size",
      "tvsize",
      "anime",
    ],
  },
  {
    genre: "ゲーム音楽",
    words: ["ゲームミュージック", "ゲーム音楽", "game music", "ゲーム", "bgm"],
  },
  {
    genre: "サウンドトラック",
    words: ["サントラ", "サウンドトラック", "soundtrack", "劇伴", "映画", "ドラマ"],
  },
  {
    genre: "ボカロ",
    words: ["ボカロ", "vocaloid", "初音ミク", "鏡音", "巡音", "可不"],
  },
  {
    genre: "ジャズ",
    words: ["ジャズ", "jazz", "スウィング", "ビバップ", "bossa nova", "ボサノヴァ"],
  },
  {
    genre: "ロック",
    words: ["ロック", "rock", "バンド", "metal", "メタル", "punk", "パンク"],
  },
  {
    genre: "電子音楽",
    words: ["edm", "テクノ", "techno", "house", "ハウス", "electro", "エレクトロ", "synth", "シンセ", "トランス"],
  },
  {
    genre: "ヒップホップ",
    words: ["ヒップホップ", "hiphop", "hip-hop", "ラップ", "trap"],
  },
  { genre: "演歌", words: ["演歌", "歌謡曲"] },
  { genre: "童謡", words: ["童謡", "唱歌", "こどもの歌"] },
  { genre: "J-POP", words: ["j-pop", "jpop", "邦楽", "japanese pop"] },
  { genre: "ポップス", words: ["ポップス", "pop"] },
];

const ALIASES: Record<string, string> = {
  rock: "ロック",
  pop: "ポップス",
  "j-pop": "J-POP",
  jpop: "J-POP",
  classical: "クラシック",
  jazz: "ジャズ",
  soundtrack: "サウンドトラック",
  "hip hop": "ヒップホップ",
  "hip-hop": "ヒップホップ",
  hiphop: "ヒップホップ",
  rap: "ヒップホップ",
  electronic: "電子音楽",
  techno: "電子音楽",
  house: "電子音楽",
  anime: "アニソン",
  vocaloid: "ボカロ",
  enka: "演歌",
  "children's music": "童謡",
  "children's": "童謡",
};

export function canonicalGenre(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return ALIASES[key] ?? trimmed;
}

export function inferGenres(track: Track, folderName: string): string[] {
  const out = new Set<string>();
  if (track.genre) {
    const canonical = canonicalGenre(track.genre);
    if (canonical) out.add(canonical);
  }
  const haystack = `${track.title} ${track.artist} ${track.album} ${track.fileName} ${folderName}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((word) => haystack.includes(word))) out.add(rule.genre);
  }
  return Array.from(out).slice(0, 4);
}

export function autoGenresForTrack(library: Library, track: Track): string[] {
  const folderName =
    library.folders.find((folder) => folder.folderId === track.folderId)?.name ?? "";
  return inferGenres(track, folderName);
}

export function buildGenreMap(
  library: Library,
  userData: UserData
): Record<string, string[]> {  const folders = new Map(library.folders.map((folder) => [folder.folderId, folder.name]));
  const map: Record<string, string[]> = {};
  for (const track of library.tracks) {
    let genres = inferGenres(track, folders.get(track.folderId) ?? "");
    const override = userData.trackGenres[track.id];
    if (override) {
      genres = genres.filter((genre) => !override.removed.includes(genre));
      for (const genre of override.added) {
        if (!genres.includes(genre)) genres.push(genre);
      }
    }
    map[track.id] = genres;
  }
  return map;
}

export function buildGenreCounts(
  genreMap: Record<string, string[]>
): { name: string; count: number; color: string }[] {
  const counts = new Map<string, number>();
  for (const genres of Object.values(genreMap)) {
    for (const genre of genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count, color: genreColor(name) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

export function allGenreNames(
  genreMap: Record<string, string[]>,
  userData: UserData
): string[] {
  const names = new Set<string>([...DEFAULT_GENRES, ...userData.customGenres]);
  for (const genres of Object.values(genreMap)) {
    for (const genre of genres) names.add(genre);
  }
  return Array.from(names).sort((a, b) => {
    const ai = DEFAULT_GENRES.indexOf(a);
    const bi = DEFAULT_GENRES.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b, "ja");
  });
}
