"use client";

import { Check, Download, Heart, Loader2, Play, TriangleAlert } from "lucide-react";
import type { Track } from "@/lib/types";
import { formatBytes, formatTime } from "@/lib/format";
import { genreColor } from "@/lib/genres";
import { CoverArt } from "./CoverArt";

export function TrackGridCard({
  track,
  isCurrent = false,
  isPlaying = false,
  downloaded = false,
  downloading = false,
  favorite = false,
  genres = [],
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
  genres?: string[];
  onPlay: () => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="vm-card group">
      <button
        type="button"
        onClick={onPlay}
        className={`relative block w-full overflow-hidden rounded-2xl ${
          isCurrent ? "ring-2 ring-rose-500/70" : ""
        }`}
      >
        <CoverArt
          title={track.title}
          url={track.coverThumb ?? track.artworkUrl ?? track.thumbnailLink}
          size="fill"
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
          {track.durationSec > 0 ? formatTime(track.durationSec) : formatBytes(track.sizeBytes)}
        </span>
        {isCurrent ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {isPlaying ? "再生中" : "選択中"}
          </span>
        ) : null}
        {!track.playable ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500/90 p-1 text-black">
            <TriangleAlert className="h-3 w-3" />
          </span>
        ) : null}
      </button>

      <div className="mt-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-[12px] font-medium ${
              isCurrent ? "text-rose-300" : "text-zinc-100"
            }`}
          >
            {track.title}
          </div>
          <div className="truncate text-[10px] text-zinc-500">
            {track.artist || track.album || "不明なアーティスト"}
          </div>
          {genres.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {genres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="rounded px-1 py-0.5 text-[9px]"
                  style={{ backgroundColor: `${genreColor(genre)}22`, color: genreColor(genre) }}
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="お気に入り"
          onClick={onToggleFavorite}
          className={`shrink-0 rounded-full p-1 ${
            favorite ? "text-rose-400" : "text-zinc-600 hover:text-zinc-300"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${favorite ? "fill-current" : ""}`} />
        </button>
        <button
          type="button"
          aria-label={downloaded ? "保存済み" : "ダウンロード"}
          onClick={onDownload}
          className={`shrink-0 rounded-full p-1 ${
            downloaded ? "text-emerald-400" : "text-zinc-600 hover:text-zinc-300"
          }`}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : downloaded ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
