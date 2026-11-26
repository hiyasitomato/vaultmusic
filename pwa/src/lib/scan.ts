import { fetchFileBytes } from "./drive";
import { coverToBlob, makeCoverThumb, parseAudioMetadata, type ParsedAudioMetadata } from "./metadata";
import { getTrackTags, putCachedCover, putTrackTags } from "./offline";
import type { Track } from "./types";

const FIRST_BYTES = 32 * 1024;
const TAIL_BYTES = 128 * 1024;
const MP4_TAIL_BYTES = 1024 * 1024;
const MAX_TAG_BYTES = 2 * 1024 * 1024;

export interface ScanProgress {
  done: number;
  total: number;
  bytes: number;
  failed: number;
}

export interface ScanOptions {
  onProgress: (progress: ScanProgress) => void;
  shouldStop?: () => boolean;
  force?: boolean;
  concurrency?: number;
}

export function estimateScanBytes(tracks: Track[]): number {
  return tracks.length * 200 * 1024;
}

async function fetchRange(track: Track, token: string, range: string): Promise<Uint8Array> {
  const blob = await fetchFileBytes(track.id, token, range);
  return new Uint8Array(await blob.arrayBuffer());
}

async function fetchTail(track: Track, token: string, length: number): Promise<Uint8Array> {
  if (track.sizeBytes <= 0) return new Uint8Array();
  const start = Math.max(0, track.sizeBytes - length);
  return fetchRange(track, token, `bytes=${start}-`);
}

function merge(base: ParsedAudioMetadata, extra: ParsedAudioMetadata): ParsedAudioMetadata {
  return {
    title: base.title || extra.title,
    artist: base.artist || extra.artist,
    album: base.album || extra.album,
    albumArtist: base.albumArtist || extra.albumArtist,
    trackNo: base.trackNo ?? extra.trackNo,
    discNo: base.discNo ?? extra.discNo,
    year: base.year ?? extra.year,
    genre: base.genre || extra.genre,
    cover: base.cover || extra.cover,
    id3v2Size: base.id3v2Size ?? extra.id3v2Size,
  };
}

async function scanOne(track: Track, token: string): Promise<number> {
  let fetched = 0;
  const isMp4 = /\.(m4a|aac|mp4)$/i.test(track.fileName);

  let head = await fetchRange(track, token, `bytes=0-${FIRST_BYTES - 1}`);
  fetched += head.length;
  let meta = parseAudioMetadata(head);

  if (meta.id3v2Size && meta.id3v2Size > head.length && meta.id3v2Size <= MAX_TAG_BYTES) {
    head = await fetchRange(track, token, `bytes=0-${meta.id3v2Size + 32 - 1}`);
    fetched += head.length;
    meta = parseAudioMetadata(head);
  }

  if (isMp4) {
    if (!meta.title || !meta.cover) {
      const tail = await fetchTail(track, token, MP4_TAIL_BYTES);
      fetched += tail.length;
      meta = merge(meta, parseAudioMetadata(tail));
    }
  } else if (!meta.title || !meta.cover) {
    const tail = await fetchTail(track, token, TAIL_BYTES);
    fetched += tail.length;
    meta = merge(meta, parseAudioMetadata(new Uint8Array(0), tail));
  }

  const thumb = meta.cover ? await makeCoverThumb(meta.cover) : null;
  if (meta.cover) {
    await putCachedCover(track.id, coverToBlob(meta.cover)).catch(() => undefined);
  }

  await putTrackTags({
    trackId: track.id,
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    albumArtist: meta.albumArtist,
    trackNo: meta.trackNo,
    discNo: meta.discNo,
    year: meta.year,
    genre: meta.genre,
    coverThumb: thumb ?? undefined,
    scannedAt: Date.now(),
  });
  return fetched;
}

export async function scanLibraryMetadata(
  tracks: Track[],
  token: string,
  options: ScanOptions
): Promise<{ scanned: number; failed: number; bytes: number }> {
  const queue = [...tracks];
  const total = tracks.length;
  let done = 0;
  let failed = 0;
  let bytes = 0;

  const workers = Array.from({ length: options.concurrency ?? 3 }, async () => {
    while (queue.length > 0) {
      if (options.shouldStop?.()) return;
      const track = queue.shift();
      if (!track) break;
      try {
        const existing = options.force ? null : await getTrackTags(track.id);
        if (!existing) {
          bytes += await scanOne(track, token);
        }
      } catch {
        failed += 1;
      }
      done += 1;
      options.onProgress({ done, total, bytes, failed });
    }
  });

  await Promise.all(workers);
  return { scanned: done - failed, failed, bytes };
}
