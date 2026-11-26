"use client";

import { Check, Download, Heart, Loader2, TriangleAlert } from "lucide-react";
import type { Track } from "@/lib/types";
import { formatBytes, formatTime } from "@/lib/format";
import { CoverArt } from "./CoverArt";

export function TrackRow({
  track,
  isCurrent = false,
  isPlaying = false,
  downloaded = false,
  downloading = false,
  favorite = false,
  onPlay,
  onToggleFavorite,
  onDownload,
}: {
  track: Track;
  isCurrent?: boolean;
  isPlaying?: boolean;
  downloaded?: boolean;
  downloading?: boolean;
  favorite?: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
}) {
  const subtitle = track.artist || track.album || track.fileName;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onPlay();
      }}
      className={`vm-row flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-white/5 ${
        isCurrent ? "bg-rose-500/10" : ""
      }`}
    >
      <CoverArt title={track.title} url={track.thumbnailLink} size="sm" />
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[14px] font-medium ${
            isCurrent ? "text-rose-300" : "text-zinc-100"
          }`}
        >
          {track.title}
          {!track.playable ? (
            <span className="ml-1 inline-flex align-middle text-amber-400">
              <TriangleAlert className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <div className="truncate text-[12px] text-zinc-400">
          {isCurrent && isPlaying ? "再生中 · " : ""}
          {subtitle}
        </div>
      </div>
      <div className="shrink-0 text-[11px] tabular-nums text-zinc-500">
        {track.durationSec > 0
          ? formatTime(track.durationSec)
          : track.sizeBytes > 0
            ? formatBytes(track.sizeBytes)
            : ""}
      </div>
      <button
        type="button"
        aria-label="お気に入り"
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        className={`shrink-0 rounded-full p-1.5 ${
          favorite ? "text-rose-400" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
      </button>
      <button
        type="button"
        aria-label={downloaded ? "保存済み" : "ダウンロード"}
        onClick={(event) => {
          event.stopPropagation();
          onDownload();
        }}
        className={`shrink-0 rounded-full p-1.5 ${
          downloaded ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : downloaded ? (
          <Check className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
