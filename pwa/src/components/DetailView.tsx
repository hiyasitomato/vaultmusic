"use client";

import { ArrowLeft, Download, Play, Shuffle, Tags, Trash2 } from "lucide-react";
import type { Library, PlayerSnapshot, Track, UserData } from "@/lib/types";
import { compareCollectionOrder, tracksFor } from "@/lib/library";
import { TrackRow } from "./TrackRow";
import { CoverArt } from "./CoverArt";

export type DetailKind =
  | "folders"
  | "artists"
  | "albums"
  | "playlists"
  | "favorites"
  | "history"
  | "genres";

export interface DetailState {
  kind: DetailKind;
  id?: string;
}

export function DetailView({
  detail,
  library,
  userData,
  downloads,
  downloading,
  genres,
  snapshot,
  onBack,
  onPlayTrack,
  onShuffleTracks,
  onToggleFavorite,
  onDownload,
  onDownloadAll,
  onOpenAlbum,
  onDeletePlaylist,
  onEditGenres,
}: {
  detail: DetailState;
  library: Library;
  userData: UserData;
  downloads: Set<string>;
  downloading: Set<string>;
  genres: Record<string, string[]>;
  snapshot: PlayerSnapshot;
  onBack: () => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onShuffleTracks: (tracks: Track[]) => void;
  onToggleFavorite: (track: Track) => void;
  onDownload: (track: Track) => void;
  onDownloadAll: (tracks: Track[]) => void;
  onOpenAlbum: (key: string) => void;
  onDeletePlaylist: (id: string) => void;
  onEditGenres: (trackIds: string[], title: string) => void;
}) {
  let title = "";
  let subtitle = "";
  let tracks: Track[] = [];
  let playlistId: string | undefined;

  if (detail.kind === "folders") {
    const folder = library.folders.find((item) => item.folderId === detail.id);
    title = folder?.name ?? "フォルダ";
    tracks = tracksFor(library, folder?.trackIds ?? []).sort(compareCollectionOrder);
    subtitle = `${tracks.length} 曲`;
  } else if (detail.kind === "artists") {
    const artist = library.artists.find((item) => item.name === detail.id);
    title = artist?.name ?? "アーティスト";
    tracks = tracksFor(library, artist?.trackIds ?? []);
    subtitle = `${tracks.length} 曲`;
  } else if (detail.kind === "albums") {
    const album = library.albums.find((item) => item.key === detail.id);
    title = album?.title ?? "アルバム";
    tracks = tracksFor(library, album?.trackIds ?? []).sort(compareCollectionOrder);
    subtitle = `${album?.artist ?? ""} · ${tracks.length} 曲`;
  } else if (detail.kind === "playlists") {
    const playlist = userData.playlists.find((item) => item.id === detail.id);
    title = playlist?.name ?? "プレイリスト";
    tracks = tracksFor(library, playlist?.trackIds ?? []);
    subtitle = `${tracks.length} 曲`;
    playlistId = playlist?.id;
  } else if (detail.kind === "genres") {
    const name = detail.id ?? "ジャンル";
    title = name;
    tracks = library.tracks.filter((track) => (genres[track.id] ?? []).includes(name));
    subtitle = `${tracks.length} 曲`;
  } else if (detail.kind === "favorites") {
    if (detail.id === "albums") {
      const albums = userData.favorites.albums
        .map((key) => library.albums.find((album) => album.key === key))
        .filter((album): album is NonNullable<typeof album> => Boolean(album));
      return (
        <div>
          <Header title="お気に入りのアルバム" subtitle={`${albums.length} 件`} onBack={onBack} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {albums.map((album) => {
              const first = tracksFor(library, album.trackIds)[0];
              return (
                <button
                  key={album.key}
                  type="button"
                  onClick={() => onOpenAlbum(album.key)}
                  className="text-left active:opacity-70"
                >
                  <CoverArt
                    title={album.title}
                    url={first?.coverThumb ?? first?.artworkUrl ?? first?.thumbnailLink}
                    size="fill"
                  />
                  <div className="mt-1.5 truncate text-[13px] font-medium">{album.title}</div>
                  <div className="truncate text-[11px] text-zinc-500">{album.artist}</div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    title = "お気に入りの曲";
    tracks = tracksFor(library, userData.favorites.tracks);
    subtitle = `${tracks.length} 曲`;
  } else if (detail.kind === "history") {
    title = "再生履歴";
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const entry of userData.history) {
      if (seen.has(entry.trackId)) continue;
      seen.add(entry.trackId);
      ids.push(entry.trackId);
      if (ids.length >= 200) break;
    }
    tracks = tracksFor(library, ids);
    subtitle = `${tracks.length} 曲`;
  }

  return (
    <div>
      <Header
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        action={
          <div className="flex items-center">
            {tracks.length > 0 ? (
              <button
                type="button"
                aria-label="ジャンルを編集"
                onClick={() => onEditGenres(tracks.map((track) => track.id), title)}
                className="rounded-full p-2 text-zinc-500 hover:text-zinc-200"
              >
                <Tags className="h-4 w-4" />
              </button>
            ) : null}
            {playlistId ? (
              <button
                type="button"
                aria-label="プレイリストを削除"
                onClick={() => {
                  onDeletePlaylist(playlistId!);
                  onBack();
                }}
                className="rounded-full p-2 text-zinc-500 hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        }
      />

      {tracks.length > 0 ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onPlayTrack(tracks[0], tracks)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[13px] font-semibold text-black"
          >
            <Play className="h-4 w-4 fill-current" />
            全曲再生
          </button>
          <button
            type="button"
            onClick={() => onShuffleTracks(tracks)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-[13px] text-zinc-200"
          >
            <Shuffle className="h-4 w-4" />
            シャッフル
          </button>
          <button
            type="button"
            onClick={() => onDownloadAll(tracks)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-[13px] text-zinc-200"
          >
            <Download className="h-4 w-4" />
            保存
          </button>
        </div>
      ) : null}

      <div className="mt-3 divide-y divide-white/[0.04]">
        {tracks.map((track) => (
          <TrackRow
            key={`${detail.kind}-${track.id}`}
            track={track}
            isCurrent={snapshot.trackId === track.id}
            isPlaying={snapshot.isPlaying}
            downloaded={downloads.has(track.id)}
            downloading={downloading.has(track.id)}
            favorite={userData.favorites.tracks.includes(track.id)}
            genres={genres[track.id] ?? []}
            onPlay={() => onPlayTrack(track, tracks)}
            onToggleFavorite={() => onToggleFavorite(track)}
            onDownload={() => onDownload(track)}
          />
        ))}
        {tracks.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">曲がありません</div>
        ) : null}
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button
        type="button"
        aria-label="戻る"
        onClick={onBack}
        className="rounded-full p-1.5 text-zinc-300"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold">{title}</h1>
        <div className="text-[11px] text-zinc-500">{subtitle}</div>
      </div>
      {action}
    </div>
  );
}
