"use client";

import { Plus, X } from "lucide-react";
import type { Playlist } from "@/lib/types";

export function PlaylistPicker({
  trackTitle,
  playlists,
  onPick,
  onCreate,
  onClose,
}: {
  trackTitle: string;
  playlists: Playlist[];
  onPick: (playlistId: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-[#17171c] pb-[calc(1rem+var(--vm-safe-bottom))]">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">追加先</div>
            <div className="truncate text-sm font-semibold">{trackTitle}</div>
          </div>
          <button type="button" aria-label="閉じる" onClick={onClose} className="rounded-full p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => onPick(playlist.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] active:bg-white/5"
            >
              <span className="truncate">{playlist.name}</span>
              <span className="text-[10px] text-zinc-500">{playlist.trackIds.length} 曲</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onCreate}
            className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2.5 text-[13px] text-zinc-300"
          >
            <Plus className="h-4 w-4" />
            新しいプレイリストを作成
          </button>
        </div>
      </div>
    </div>
  );
}
