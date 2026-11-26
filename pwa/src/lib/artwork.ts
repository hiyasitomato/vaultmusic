import type { Library, Track } from "./types";
import { getAllArtwork, putArtwork, type StoredArtwork } from "./offline";

export interface ArtworkCandidate {
  url: string;
  source: "deezer" | "itunes";
  title: string;
  artist: string;
  duration: number;
}

export interface ArtworkProgress {
  done: number;
  total: number;
  found: number;
  failed: number;
}

export interface ArtworkOptions {
  onProgress: (progress: ArtworkProgress) => void;
  onFound?: (trackId: string, url: string) => void;
  shouldStop?: () => boolean;
  force?: boolean;
  concurrency?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\[[a-z0-9_-]{11}\]/g, " ")
    .replace(/[\s\-_/.,:;!?'"()[\]【】「」『』・~〜]/g, "")
    .trim();
}

export function cleanTrackTitle(title: string): string {
  return title
    .replace(/\[[A-Za-z0-9_-]{11}\]/g, " ")
    .replace(/\((?:TV\s*size|TV\s*ver\.?|Short|Official|Music Video|MV|Lyric Video|Anime Ver\.?)[^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SUSPICIOUS_ARTIST =
  /^(他|不明|unknown|various|various artists|none|n\/a|artist|音楽|music)$/i;

function effectiveArtist(track: Track): string {
  const artist = (track.artist || track.albumArtist || "").trim();
  if (!artist) return "";
  if (artist === "不明なアーティスト") return "";
  if (SUSPICIOUS_ARTIST.test(artist)) return "";
  if (/downloader|spotmate|spotify|https?:|\.com\//i.test(artist)) return "";
  return artist;
}

export function scoreArtworkCandidate(track: Track, candidate: ArtworkCandidate): number {
  const title = normalizeForMatch(cleanTrackTitle(track.title));
  const candidateTitle = normalizeForMatch(candidate.title);
  if (!title || !candidateTitle) return 0;

  let score = 0;
  if (candidateTitle === title) {
    score += 0.7;
  } else if (candidateTitle.includes(title) || title.includes(candidateTitle)) {
    score += 0.5;
    if (
      candidateTitle.length >= 4 &&
      (title.startsWith(candidateTitle) || title.endsWith(candidateTitle))
    ) {
      // 「Enemy Imagine Dragons」に対する「Enemy」のような、
      // ファイル名にアーティスト名と曲名が連結されているケース
      score += 0.15;
    }
  } else {
    return 0;
  }

  const artist = effectiveArtist(track);
  if (artist) {
    const artistNorm = normalizeForMatch(artist);
    const candidateArtist = normalizeForMatch(candidate.artist);
    if (
      candidateArtist &&
      (candidateArtist === artistNorm ||
        candidateArtist.includes(artistNorm) ||
        artistNorm.includes(candidateArtist))
    ) {
      score += 0.2;
    } else {
      score -= 0.35;
    }
  } else {
    const candidateArtist = normalizeForMatch(candidate.artist);
    if (candidateArtist && title.includes(candidateArtist)) {
      // アーティスト不明でも、曲名側にアーティスト名が入っていれば強い一致
      score += 0.1;
    }
  }

  if (track.durationSec > 0 && candidate.duration > 0) {
    const diff = Math.abs(track.durationSec - candidate.duration);
    if (diff <= 5) score += 0.1;
    else if (diff <= 20) score += 0.03;
    else score -= 0.25;
  }
  return score;
}

let callbackSeq = 0;

function jsonp<T>(url: string, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("jsonp unavailable"));
      return;
    }
    const callback = `__vm_jsonp_${Date.now()}_${callbackSeq++}`;
    const script = document.createElement("script");
    let settled = false;
    const timer = setTimeout(() => finish(new Error("jsonp timeout")), timeoutMs);

    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[callback];
      script.remove();
      clearTimeout(timer);
    };
    const finish = (error?: Error, data?: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(data as T);
    };

    (window as unknown as Record<string, unknown>)[callback] = (data: T) => finish(undefined, data);
    script.onerror = () => finish(new Error("jsonp error"));
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${callback}`;
    document.head.appendChild(script);
  });
}

let lastDeezer = 0;
async function deezerSlot(): Promise<void> {
  const wait = Math.max(0, 250 - (Date.now() - lastDeezer));
  if (wait > 0) await sleep(wait);
  lastDeezer = Date.now();
}

let lastItunes = 0;
let itunesChain: Promise<void> = Promise.resolve();
function itunesSlot(): Promise<void> {
  const run = itunesChain.then(async () => {
    const wait = Math.max(0, 3300 - (Date.now() - lastItunes));
    if (wait > 0) await sleep(wait);
    lastItunes = Date.now();
  });
  itunesChain = run.catch(() => undefined);
  return run;
}

function pickCandidate(track: Track, candidates: ArtworkCandidate[]): ArtworkCandidate | null {
  let best: ArtworkCandidate | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreArtworkCandidate(track, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

async function searchDeezer(query: string, track: Track): Promise<ArtworkCandidate | null> {
  await deezerSlot();
  const data = await jsonp<{ data?: Array<Record<string, unknown>> }>(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5&output=jsonp`,
    8000
  );
  const candidates: ArtworkCandidate[] = [];
  for (const item of data.data ?? []) {
    const album = item.album as { cover_big?: string; cover_xl?: string } | undefined;
    const artist = item.artist as { name?: string } | undefined;
    const url = album?.cover_big || album?.cover_xl;
    if (!url) continue;
    candidates.push({
      url,
      source: "deezer",
      title: String(item.title ?? ""),
      artist: String(artist?.name ?? ""),
      duration: Number(item.duration ?? 0),
    });
  }
  return pickCandidate(track, candidates);
}

async function searchItunes(query: string, track: Track): Promise<ArtworkCandidate | null> {
  await itunesSlot();
  const data = await jsonp<{ results?: Array<Record<string, unknown>> }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&entity=song&limit=5&country=jp`,
    12000
  );
  const candidates: ArtworkCandidate[] = [];
  for (const item of data.results ?? []) {
    const artwork = String(item.artworkUrl100 ?? "");
    if (!artwork) continue;
    candidates.push({
      url: artwork.replace("100x100bb", "600x600bb"),
      source: "itunes",
      title: String(item.trackName ?? ""),
      artist: String(item.artistName ?? ""),
      duration: Number(item.trackTimeMillis ?? 0) / 1000,
    });
  }
  return pickCandidate(track, candidates);
}

async function searchTrack(track: Track): Promise<ArtworkCandidate | null> {
  const title = cleanTrackTitle(track.title);
  if (!title) return null;
  const artist = effectiveArtist(track);
  const queries: string[] = [];
  const addQuery = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !queries.includes(trimmed)) queries.push(trimmed);
  };
  if (artist) addQuery(`${title} ${artist}`);
  addQuery(title);
  if (track.album && track.album !== title) addQuery(`${title} ${track.album}`);

  for (const query of queries) {
    try {
      const deezer = await searchDeezer(query, track);
      if (deezer) return deezer;
    } catch {
      // Deezerが失敗してもiTunesへ
    }
    try {
      const itunes = await searchItunes(query, track);
      if (itunes) return itunes;
    } catch {
      // 次のクエリへ
    }
  }
  return null;
}

export function youtubeThumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
}

export function probeImage(url: string, timeoutMs = 4000): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;
    const timer = setTimeout(() => finish(false), timeoutMs);
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(ok);
    };
    image.onload = () => finish(image.naturalWidth > 0);
    image.onerror = () => finish(false);
    image.src = url;
  });
}

export function applyArtwork(
  library: Library,
  artwork: Record<string, StoredArtwork>
): Library {
  let changed = false;
  const tracks = library.tracks.map((track) => {
    if (track.coverThumb) return track;
    const url = artwork[track.id]?.url;
    if (!url || track.artworkUrl === url) return track;
    changed = true;
    return { ...track, artworkUrl: url };
  });
  return changed ? { ...library, tracks } : library;
}

export function applyArtworkItem(
  library: Library,
  trackId: string,
  url: string
): Library {
  if (!url) return library;
  let changed = false;
  const tracks = library.tracks.map((track) => {
    if (track.id !== trackId || track.coverThumb || track.artworkUrl === url) return track;
    changed = true;
    return { ...track, artworkUrl: url };
  });
  return changed ? { ...library, tracks } : library;
}

export async function findArtworkForTracks(
  tracks: Track[],
  options: ArtworkOptions
): Promise<ArtworkProgress> {
  const existing = await getAllArtwork().catch(() => ({} as Record<string, StoredArtwork>));
  const DAY = 24 * 60 * 60 * 1000;
  const pending = tracks.filter((track) => {
    if (track.coverThumb) return false;
    if (options.force) return true;
    const record = existing[track.id];
    if (!record) return true;
    const ttl = record.url ? 30 * DAY : 7 * DAY;
    return Date.now() - record.at >= ttl;
  });

  const total = pending.length;
  let done = 0;
  let found = 0;
  let failed = 0;
  let index = 0;

  const workers = Array.from({ length: options.concurrency ?? 2 }, async () => {
    while (true) {
      if (options.shouldStop?.()) return;
      const current = index++;
      if (current >= pending.length) return;
      const track = pending[current];
      try {
        if (track.youtubeId) {
          const url = youtubeThumbUrl(track.youtubeId);
          if (await probeImage(url)) {
            await putArtwork({
              trackId: track.id,
              url,
              source: "youtube",
              at: Date.now(),
            });
            options.onFound?.(track.id, url);
            found += 1;
            done += 1;
            options.onProgress({ done, total, found, failed });
            continue;
          }
        }
        const candidate = await searchTrack(track);
        await putArtwork({
          trackId: track.id,
          url: candidate?.url ?? "",
          source: candidate?.source ?? "none",
          at: Date.now(),
        });
        if (candidate) {
          options.onFound?.(track.id, candidate.url);
          found += 1;
        }
      } catch {
        failed += 1;
      }
      done += 1;
      options.onProgress({ done, total, found, failed });
    }
  });

  await Promise.all(workers);
  return { done, total, found, failed };
}
