"use client";

import { useState } from "react";
import {
  ChevronRight,
  Disc3,
  Heart,
  History,
  Image as ImageIcon,
  ListMusic,
  Plus,
  Tags,
  Trash2,
  User,
} from "lucide-react";
import type { Library, Track, UserData } from "@/lib/types";
import type { ScanProgress } from "@/lib/scan";
import type { ArtworkProgress } from "@/lib/artwork";
import { formatBytes } from "@/lib/format";
import { tracksFor } from "@/lib/library";
import { CoverArt } from "./CoverArt";

type Tab = "folders" | "artists" | "albums" | "genres" | "playlists" | "favorites" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "folders", label: "フォルダ" },
  { key: "artists", label: "アーティスト" },
  { key: "albums", label: "アルバム" },
  { key: "genres", label: "ジャンル" },
  { key: "playlists", label: "プレイリスト" },
  { key: "favorites", label: "お気に入り" },
  { key: "history", label: "履歴" },
];

export function LibraryView({
  library,
  userData,
  genreList,
  metaScan,
  artworkScan,
  tagCount,
  estimatedBytes,
  onScanTags,
  onStopScan,
  onLookupArtwork,
  onStopArtwork,
  onCreatePlaylist,
  onDeletePlaylist,
  onOpen,
}: {
  library: Library;
  userData: UserData;
  genreList: { name: string; count: number; color: string }[];
  metaScan: (ScanProgress & { running: boolean }) | null;
  artworkScan: (ArtworkProgress & { running: boolean }) | null;
  tagCount: number;
  estimatedBytes: number;
  onScanTags: (force?: boolean) => void;
  onStopScan: () => void;
  onLookupArtwork: () => void;
  onStopArtwork: () => void;
  onCreatePlaylist: () => void;
  onDeletePlaylist: (id: string) => void;
  onOpen: (kind: Tab, id?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("folders");
  const totalTracks = library.tracks.length;
  const progress = metaScan && metaScan.total > 0 ? (metaScan.done / metaScan.total) * 100 : 0;
  const artworkProgress =
    artworkScan && artworkScan.total > 0
      ? (artworkScan.done / artworkScan.total) * 100
      : 0;

  return (
    <div>
      <div className="mt-3 flex items-center justify-between px-1">
        <h1 className="text-lg font-bold">ライブラリ</h1>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-zinc-200">タグ・サムネイル</div>
            <div className="text-[10px] text-zinc-500">
              {tagCount} / {totalTracks} 曲 取得済み
            </div>
          </div>
          {metaScan?.running ? (
            <button
              type="button"
              onClick={onStopScan}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300"
            >
              中止
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onScanTags(tagCount >= totalTracks)}
              className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black"
            >
              {tagCount >= totalTracks ? "再取得" : "すべて取得"}
            </button>
          )}
        </div>
        {metaScan?.running ? (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-zinc-500">
              {metaScan.done} / {metaScan.total} 曲 ・ {formatBytes(metaScan.bytes)}
              {metaScan.failed > 0 ? ` ・ 失敗 ${metaScan.failed}` : ""}
            </div>
          </>
        ) : tagCount < totalTracks ? (
          <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">
            約 {formatBytes(estimatedBytes)}。Wi-Fi推奨。埋め込みアートとタグ（曲名・アーティスト・アルバム）を読み取ります。
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2">
          <ImageIcon className="h-4 w-4 text-sky-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-zinc-200">サムネイル検索</div>
            <div className="text-[10px] text-zinc-500">
              曲名・アーティストから公開カタログを検索
            </div>
          </div>
          {artworkScan?.running ? (
            <button
              type="button"
              onClick={onStopArtwork}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300"
            >
              中止
            </button>
          ) : (
            <button
              type="button"
              onClick={onLookupArtwork}
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-300"
            >
              名前から取得
            </button>
          )}
        </div>
        {artworkScan?.running ? (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-sky-400 transition-[width]"
                style={{ width: `${artworkProgress}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-zinc-500">
              {artworkScan.done} / {artworkScan.total} 曲 ・ 取得 {artworkScan.found}
              {artworkScan.failed > 0 ? ` ・ 失敗 ${artworkScan.failed}` : ""}
            </div>
          </>
        ) : (
          <div className="mt-1 text-[10px] text-zinc-500">
            YouTube IDが無い／無効な曲を、Deezer・iTunesの公開カタログから探します。
          </div>
        )}
      </div>

      <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] ${
              tab === item.key
                ? "bg-white text-black"
                : "border border-white/10 text-zinc-400"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "folders" ? (
          <div className="divide-y divide-white/[0.04]">
            {library.folders.map((folder) => {
              const first = tracksFor(library, folder.trackIds)[0];
              return (
                <button
                  key={folder.folderId}
                  type="button"
                  onClick={() => onOpen("folders", folder.folderId)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-white/5"
                >
                  <CoverArt
                    title={folder.name}
                    url={first?.coverThumb ?? first?.artworkUrl ?? first?.thumbnailLink}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{folder.name}</div>
                    <div className="text-[11px] text-zinc-500">{folder.trackIds.length} 曲</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </button>
              );
            })}
          </div>
        ) : null}

        {tab === "artists" ? (
          <div className="divide-y divide-white/[0.04]">
            {library.artists.map((artist) => (
              <button
                key={artist.name}
                type="button"
                onClick={() => onOpen("artists", artist.name)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-white/5"
              >
                <User className="h-5 w-5 text-violet-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{artist.name}</div>
                  <div className="text-[11px] text-zinc-500">{artist.trackIds.length} 曲</div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </button>
            ))}
          </div>
        ) : null}

        {tab === "albums" ? (
          library.albums.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {library.albums.map((album) => {
                const first = tracksFor(library, album.trackIds)[0];
                return (
                  <button
                    key={album.key}
                    type="button"
                    onClick={() => onOpen("albums", album.key)}
                    className="group text-left active:opacity-70"
                  >
                    <CoverArt
                      title={album.title}
                      url={first?.coverThumb ?? first?.artworkUrl ?? first?.thumbnailLink}
                      size="fill"
                      className="transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="mt-1.5 truncate text-[13px] font-medium">{album.title}</div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {album.artist} · {album.trackIds.length}曲
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-zinc-500">
              2曲以上そろったアルバムはまだありません
            </div>
          )
        ) : null}

        {tab === "genres" ? (
          <div className="grid grid-cols-2 gap-2">
            {genreList.map((genre) => (
              <button
                key={genre.name}
                type="button"
                onClick={() => onOpen("genres", genre.name)}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left active:bg-white/5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: genre.color }}
                  />
                  <span className="truncate text-[12px] font-medium">{genre.name}</span>
                </span>
                <span className="shrink-0 text-[10px] text-zinc-500">{genre.count}</span>
              </button>
            ))}
            {genreList.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-sm text-zinc-500">
                ジャンルはまだありません
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "playlists" ? (
          <div>
            <button
              type="button"
              onClick={onCreatePlaylist}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2.5 text-[13px] text-zinc-300"
            >
              <Plus className="h-4 w-4" />
              新しいプレイリスト
            </button>
            <div className="divide-y divide-white/[0.04]">
              {userData.playlists.map((playlist) => (
                <div key={playlist.id} className="flex items-center gap-2 px-2">
                  <button
                    type="button"
                    onClick={() => onOpen("playlists", playlist.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                  >
                    <ListMusic className="h-5 w-5 text-rose-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{playlist.name}</div>
                      <div className="text-[11px] text-zinc-500">{playlist.trackIds.length} 曲</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="削除"
                    onClick={() => onDeletePlaylist(playlist.id)}
                    className="p-2 text-zinc-600 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {userData.playlists.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  プレイリストはまだありません
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "favorites" ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onOpen("favorites", "tracks")}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
            >
              <Heart className="h-5 w-5 text-rose-400" />
              <div className="flex-1">
                <div className="text-sm font-medium">お気に入りの曲</div>
                <div className="text-[11px] text-zinc-500">
                  {userData.favorites.tracks.length} 曲
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-600" />
            </button>
            <button
              type="button"
              onClick={() => onOpen("favorites", "albums")}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
            >
              <Disc3 className="h-5 w-5 text-amber-400" />
              <div className="flex-1">
                <div className="text-sm font-medium">お気に入りのアルバム</div>
                <div className="text-[11px] text-zinc-500">
                  {userData.favorites.albums.length} 件
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-600" />
            </button>
          </div>
        ) : null}

        {tab === "history" ? (
          <button
            type="button"
            onClick={() => onOpen("history")}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
          >
            <History className="h-5 w-5 text-violet-400" />
            <div className="flex-1">
              <div className="text-sm font-medium">最近の再生</div>
              <div className="text-[11px] text-zinc-500">{userData.history.length} 件</div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
