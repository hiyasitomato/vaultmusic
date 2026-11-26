import { dbAll, dbDelete, dbGet, dbKeys, dbPut } from "./db";
import { fetchFileBytes } from "./drive";
import type { DownloadEntry, Library, Track } from "./types";

const CATALOG_KEY = "library";

export async function cacheCatalog(library: Library): Promise<void> {
  await dbPut("kv", CATALOG_KEY, library);
}

export async function getCachedCatalog(): Promise<Library | null> {
  try {
    return await dbGet<Library>("kv", CATALOG_KEY);
  } catch {
    return null;
  }
}

export async function getDownloads(): Promise<DownloadEntry[]> {
  const entries = await dbAll<DownloadEntry>("downloads");
  return entries.sort((a, b) => a.at - b.at);
}

export async function getDownloadedIds(): Promise<Set<string>> {
  return new Set(await dbKeys("downloads"));
}

export async function isDownloaded(trackId: string): Promise<boolean> {
  return (await dbGet<DownloadEntry>("downloads", trackId)) !== null;
}

export async function getAudioBlob(trackId: string): Promise<Blob | null> {
  return dbGet<Blob>("audio", trackId);
}

export async function deleteDownload(trackId: string): Promise<void> {
  await dbDelete("audio", trackId);
  await dbDelete("downloads", trackId);
}

export async function clearDownloads(): Promise<void> {
  const ids = await dbKeys("downloads");
  await Promise.all(ids.map((id) => deleteDownload(id)));
}

async function enforceLimit(limitBytes: number, keepTrackId?: string): Promise<void> {
  const entries = await getDownloads();
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);
  for (const entry of entries) {
    if (total <= limitBytes) break;
    if (entry.trackId === keepTrackId) continue;
    await deleteDownload(entry.trackId);
    total -= entry.size;
  }
}

let persistenceRequested = false;

async function requestPersistence(): Promise<void> {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // 端末が拒否しても致命的ではない
  }
}

export async function downloadTrack(
  track: Track,
  token: string,
  limitBytes: number
): Promise<void> {
  if (await isDownloaded(track.id)) return;
  await requestPersistence();
  const blob = await fetchFileBytes(track.id, token);
  await dbPut("audio", track.id, blob);
  await dbPut("downloads", track.id, {
    trackId: track.id,
    size: blob.size,
    at: Date.now(),
  } satisfies DownloadEntry);
  await enforceLimit(limitBytes, track.id);
}

export async function cacheAudioBlob(
  trackId: string,
  blob: Blob,
  limitBytes: number
): Promise<void> {
  await requestPersistence();
  await dbPut("audio", trackId, blob);
  await dbPut("downloads", trackId, {
    trackId,
    size: blob.size,
    at: Date.now(),
  } satisfies DownloadEntry);
  await enforceLimit(limitBytes, trackId);
}

export async function storageUsage(): Promise<{ usage: number; quota: number }> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return { usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 };
  } catch {
    return { usage: 0, quota: 0 };
  }
}

export async function getDownloadedBytes(): Promise<number> {
  const entries = await getDownloads();
  return entries.reduce((sum, entry) => sum + entry.size, 0);
}

export async function getCachedCover(key: string): Promise<Blob | null> {
  return dbGet<Blob>("covers", key);
}

export async function putCachedCover(key: string, blob: Blob): Promise<void> {
  await dbPut("covers", key, blob);
}

export interface StoredTrackTags {
  trackId: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNo?: number;
  discNo?: number;
  year?: number;
  genre?: string;
  coverThumb?: string;
  scannedAt: number;
}

export async function putTrackTags(tags: StoredTrackTags): Promise<void> {
  await dbPut("tags", tags.trackId, tags);
}

export async function getAllTrackTags(): Promise<Record<string, StoredTrackTags>> {
  const all = await dbAll<StoredTrackTags>("tags");
  const result: Record<string, StoredTrackTags> = {};
  for (const tags of all) result[tags.trackId] = tags;
  return result;
}

export async function getTrackTags(trackId: string): Promise<StoredTrackTags | null> {
  return dbGet<StoredTrackTags>("tags", trackId);
}
