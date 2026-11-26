import { normalizeText } from "./format";

export interface ParsedName {
  title: string;
  artist: string;
  trackNo: number;
}

function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  return name.slice(0, idx);
}

function clean(text: string): string {
  return text.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
}

const NUMBER_PATTERNS = [
  /^(\d{1,3})\s*[.\-_)\]]\s*(.+)$/,
  /^(\d{1,3})\s+(.+)$/,
];

const SEPARATORS = [" - ", " – ", " — ", "／", " / "];

/**
 * ファイル名からタイトル・アーティスト・曲番号を推定する。
 * タグが無い曲（このライブラリでは半数以上）の表示名を決めるために使う。
 */
export function parseName(fileName: string, knownArtists: Set<string> = new Set()): ParsedName {
  let stem = stripExtension(fileName).trim();
  let trackNo = 0;

  for (const pattern of NUMBER_PATTERNS) {
    const match = stem.match(pattern);
    if (match) {
      trackNo = Number.parseInt(match[1], 10) || 0;
      stem = match[2];
      break;
    }
  }

  const bracketed = stem.match(/^[\[【]([^\]】]+)[\]】]\s*(.+)$/);
  if (bracketed) {
    return { title: clean(bracketed[2]), artist: clean(bracketed[1]), trackNo };
  }

  for (const separator of SEPARATORS) {
    const index = stem.indexOf(separator);
    if (index <= 0) continue;
    const left = clean(stem.slice(0, index));
    const right = clean(stem.slice(index + separator.length));
    if (!left || !right) continue;
    const leftKnown = knownArtists.has(normalizeText(left));
    const rightKnown = knownArtists.has(normalizeText(right));
    if (rightKnown && !leftKnown) {
      return { title: left, artist: right, trackNo };
    }
    return { title: right, artist: left, trackNo };
  }

  return { title: clean(stem) || fileName, artist: "", trackNo };
}
