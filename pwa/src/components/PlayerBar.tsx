"use client";

import { Pause, Play, SkipForward } from "lucide-react";
import type { Track } from "@/lib/types";
import { usePlayerLive } from "@/lib/usePlayer";
import { CoverArt } from "./CoverArt";

export function PlayerBar({
  track,
  onToggle,
  onNext,
  onOpen,
}: {
  track: Track;
  onToggle: () => void;
  onNext: () => void;
  onOpen: () => void;
}) {
  const snapshot = usePlayerLive();
  const progress =
    snapshot.duration > 0 ? Math.min(100, (snapshot.time / snapshot.duration) * 100) : 0;
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.9rem+var(--vm-safe-bottom))] z-30 px-2">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[#1b1b21]/95 shadow-2xl backdrop-blur">
        <div className="h-0.5 w-full bg-white/10">
          <div className="h-full bg-rose-500 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-3 px-2.5 py-2">
          <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <CoverArt title={track.title} url={track.thumbnailLink} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-zinc-100">{track.title}</div>
              <div className="truncate text-[11px] text-zinc-400">
                {snapshot.error ? snapshot.error : track.artist || "不明なアーティスト"}
              </div>
            </div>
          </button>
          <button
            type="button"
            aria-label={snapshot.isPlaying ? "一時停止" : "再生"}
            onClick={onToggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black"
          >
            {snapshot.loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            ) : snapshot.isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>
          <button
            type="button"
            aria-label="次の曲"
            onClick={onNext}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:text-white"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
