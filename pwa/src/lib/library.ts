import type {
  Album,
  ArtistSummary,
  DriveAudioFile,
  DriveFolder,
  FolderCollection,
  Library,
  Track,
} from "./types";
import { naturalCompare, normalizeText } from "./format";
import { parseName, extractYouTubeId } from "./parseName";

const UNKNOWN_ARTIST = "不明なアーティスト";

function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function isPlayable(name: string): boolean {
  return !/\.(opus|ogg)$/i.test(name);
}

export function buildLibrary(
  files: DriveAudioFile[],
  folders: DriveFolder[],
  folderId: string
): Library {
  const knownArtists = new Set<string>();
  for (const file of files) {
    const artist = file.audioMediaMetadata?.artist?.trim();
    if (artist) knownArtists.add(normalizeText(artist));
  }

  const folderNames = new Map<string, string>();
  for (const folder of folders) folderNames.set(folder.id, folder.name);

  const tracks: Track[] = files.map((file) => {
    const meta = file.audioMediaMetadata ?? {};
    const parsed = parseName(file.name, knownArtists);
    const title = (meta.title ?? "").trim() || parsed.title || stripExtension(file.name);
    const artist = (meta.artist ?? "").trim() || parsed.artist;
    const parentId = file.parents?.[0] ?? "";
    const folderName = folderNames.get(parentId) ?? "";
    const taggedAlbum = (meta.album ?? "").trim();
    const album = taggedAlbum || folderName;
    const albumArtist =
      (meta.albumArtist ?? "").trim() || (taggedAlbum ? artist : folderName) || artist;
    const durationMillis = Number(meta.durationMillis ?? 0);
    const youtubeId = extractYouTubeId(file.name);
    const youtubeThumbnail = youtubeId
      ? `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`
      : undefined;
    return {
      id: file.id,
      folderId: parentId,
      fileName: file.name,
      title,
      artist,
      album,
      albumArtist,
      trackNo: Number(meta.trackNumber ?? parsed.trackNo) || 0,
      discNo: Number(meta.discNumber ?? 0) || 0,
      year: Number(meta.year ?? 0) || undefined,
      durationSec: Number.isFinite(durationMillis) && durationMillis > 0 ? durationMillis / 1000 : 0,
      bitrate: Number(meta.bitrate ?? 0) || undefined,
      sizeBytes: Number(file.size ?? 0) || 0,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime ?? file.createdTime ?? "",
      thumbnailLink: youtubeThumbnail ?? file.thumbnailLink,
      youtubeId: youtubeId ?? undefined,
      playable: isPlayable(file.name),
    };
  });

  tracks.sort((a, b) => naturalCompare(a.title, b.title));

  const folderBuckets = new Map<string, string[]>();
  for (const track of tracks) {
    if (!track.folderId) continue;
    const bucket = folderBuckets.get(track.folderId) ?? [];
    bucket.push(track.id);
    folderBuckets.set(track.folderId, bucket);
  }
  const folderCollections: FolderCollection[] = Array.from(folderBuckets.entries())
    .map(([id, trackIds]) => ({
      folderId: id,
      name: folderNames.get(id) ?? "フォルダ",
      trackIds,
    }))
    .sort((a, b) => naturalCompare(a.name, b.name));

  const albumBuckets = new Map<string, Track[]>();
  for (const track of tracks) {
    if (!track.album) continue;
    const key = `${normalizeText(track.albumArtist || track.artist)}|${normalizeText(track.album)}`;
    const bucket = albumBuckets.get(key) ?? [];
    bucket.push(track);
    albumBuckets.set(key, bucket);
  }
  const albums: Album[] = Array.from(albumBuckets.entries())
    .filter(([, bucket]) => bucket.length >= 2)
    .map(([key, bucket]) => ({
      key,
      title: mostCommon(bucket.map((t) => t.album)) || bucket[0].album,
      artist: mostCommon(bucket.map((t) => t.albumArtist || t.artist)) || UNKNOWN_ARTIST,
      trackIds: bucket
        .slice()
        .sort((a, b) => compareCollectionOrder(a, b))
        .map((t) => t.id),
    }))
    .sort((a, b) => naturalCompare(a.title, b.title));

  const artistBuckets = new Map<string, string[]>();
  for (const track of tracks) {
    const name = track.artist || UNKNOWN_ARTIST;
    const bucket = artistBuckets.get(name) ?? [];
    bucket.push(track.id);
    artistBuckets.set(name, bucket);
  }
  const artists: ArtistSummary[] = Array.from(artistBuckets.entries())
    .map(([name, trackIds]) => ({ name, trackIds }))
    .sort((a, b) => naturalCompare(a.name, b.name));

  return {
    tracks,
    folders: folderCollections,
    albums,
    artists,
    folderId,
    builtAt: Date.now(),
  };
}

export function compareCollectionOrder(a: Track, b: Track): number {
  if (a.discNo !== b.discNo) return a.discNo - b.discNo;
  if (a.trackNo !== b.trackNo) {
    if (a.trackNo === 0) return 1;
    if (b.trackNo === 0) return -1;
    return a.trackNo - b.trackNo;
  }
  return naturalCompare(a.fileName, b.fileName);
}

export function tracksFor(library: Library, ids: string[]): Track[] {
  const byId = new Map(library.tracks.map((track) => [track.id, track]));
  return ids.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track));
}

export function enrichYouTubeThumbnails(library: Library): Library {
  let changed = false;
  const tracks = library.tracks.map((track) => {
    if (track.youtubeId) return track;
    const youtubeId = extractYouTubeId(track.fileName);
    if (!youtubeId) return track;
    changed = true;
    const parsed = track.tagsApplied ? null : parseName(track.fileName);
    return {
      ...track,
      youtubeId,
      thumbnailLink: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
      title: parsed?.title || track.title,
      artist: parsed?.artist || track.artist,
    };
  });
  return changed ? { ...library, tracks } : library;
}

export function searchTracks(library: Library, query: string): Track[] {  const needle = normalizeText(query);
  if (!needle) return [];
  return library.tracks.filter((track) => {
    const haystack = normalizeText(
      `${track.title} ${track.artist} ${track.album} ${track.fileName}`
    );
    return haystack.includes(needle);
  });
}
