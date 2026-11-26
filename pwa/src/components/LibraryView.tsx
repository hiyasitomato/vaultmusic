"use client";

import { useState } from "react";
import {
  ChevronRight,
  Disc3,
  FolderOpen,
  Heart,
  History,
  ListMusic,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import type { Library, Track, UserData } from "@/lib/types";
import { tracksFor } from "@/lib/library";
import { CoverArt } from "./CoverArt";

type Tab = "folders" | "artists" | "albums" | "playlists" | "favorites" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "folders", label: "フォルダ" },
  { key: "artists", label: "アーティスト" },
  { key: "albums", label: "アルバム" },
  { key: "playlists", label: "プレイリスト" },
  { key: "favorites", label: "お気に入り" },
  { key: "history", label: "履歴" },
];

export function LibraryView({
  library,
  userData,
  onCreatePlaylist,
  onDeletePlaylist,
  onOpen,
}: {
  library: Library;
  userData: UserData;
  onCreatePlaylist: () => void;
  onDeletePlaylist: (id: string) => void;
  onOpen: (kind: Tab, id?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("folders");

  return (
    <div>
      <div className="mt-3 flex items-center justify-between px-1">
        <h1 className="text-lg font-bold">ライブラリ</h1>
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
            {library.folders.map((folder) => (
              <button
                key={folder.folderId}
                type="button"
                onClick={() => onOpen("folders", folder.folderId)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-white/5"
              >
                <FolderOpen className="h-5 w-5 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{folder.name}</div>
                  <div className="text-[11px] text-zinc-500">{folder.trackIds.length} 曲</div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </button>
            ))}
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
                    className="text-left active:opacity-70"
                  >
                    <CoverArt title={album.title} url={first?.thumbnailLink} size="fill" />
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
