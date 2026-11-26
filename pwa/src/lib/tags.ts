import { buildLibrary } from "./library";
import type { StoredTrackTags } from "./offline";
import type { Library, Track } from "./types";

/**
 * 抽出済みタグをライブラリへ適用し、アルバム・アーティストを再構築する。
 * フォルダ内に1曲でもカバーがあれば、同じフォルダの曲にもそのサムネイルを割り当てる。
 */
export function applyTagsToLibrary(
  library: Library,
  tags: Record<string, StoredTrackTags>
): Library {
  let tagged: Track[] = library.tracks.map((track) => {
    const item = tags[track.id];
    if (!item) return track;
    return {
      ...track,
      title: item.title || track.title,
      artist: item.artist || track.artist,
      album: item.album || track.album,
      albumArtist: item.albumArtist || track.albumArtist,
      trackNo: item.trackNo ?? track.trackNo,
      discNo: item.discNo ?? track.discNo,
      year: item.year ?? track.year,
      genre: item.genre || track.genre,
      coverThumb: item.coverThumb || track.coverThumb,
      tagsApplied: Boolean(item.title || item.artist || item.album || item.coverThumb),
    };
  });

  const donors = new Map<string, { trackId: string; thumb: string }>();
  for (const track of tagged) {
    if (track.coverThumb && track.folderId && !donors.has(track.folderId)) {
      donors.set(track.folderId, { trackId: track.id, thumb: track.coverThumb });
    }
  }
  tagged = tagged.map((track) => {
    if (track.coverThumb) return track;
    const donor = donors.get(track.folderId);
    if (!donor) return track;
    return { ...track, coverThumb: donor.thumb, coverTrackId: donor.trackId };
  });

  const files = tagged.map((track) => ({
    id: track.id,
    name: track.fileName,
    mimeType: track.mimeType,
    size: String(track.sizeBytes),
    modifiedTime: track.modifiedTime,
    parents: [track.folderId],
    thumbnailLink: track.thumbnailLink,
    audioMediaMetadata: {
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumArtist: track.albumArtist,
      trackNumber: track.trackNo,
      discNumber: track.discNo,
      year: track.year,
      durationMillis: track.durationSec * 1000,
    },
  }));
  const folders = library.folders.map((folder) => ({
    id: folder.folderId,
    name: folder.name,
  }));
  const next = buildLibrary(files, folders, library.folderId);
  const byId = new Map(tagged.map((track) => [track.id, track]));
  next.tracks = next.tracks.map((track) => {
    const original = byId.get(track.id);
    if (!original) return track;
    return {
      ...track,
      coverThumb: original.coverThumb,
      coverTrackId: original.coverTrackId,
      tagsApplied: original.tagsApplied,
      genre: original.genre,
      sizeBytes: original.sizeBytes,
      durationSec: original.durationSec || track.durationSec,
      modifiedTime: original.modifiedTime,
    };
  });
  return next;
}
