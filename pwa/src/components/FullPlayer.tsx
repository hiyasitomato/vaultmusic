"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Heart,
  ListPlus,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Tags,
  Timer,
} from "lucide-react";
import type { RepeatMode, Track } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { genreColor } from "@/lib/genres";
import { usePlayerLive } from "@/lib/usePlayer";
import { CoverArt } from "./CoverArt";

const SLEEP_OPTIONS = [0, 15, 30, 45, 60];

export function FullPlayer({
  track,
  coverUrl,
  genres,
  favorite,
  downloaded,
  downloading,
  onClose,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onSetShuffle,
  onSetRepeat,
  onSetSleep,
  onDownload,
  onToggleFavorite,
  onAddToPlaylist,
  onEditGenres,
}: {
  track: Track;
  coverUrl: string | null;
  genres: string[];
  favorite: boolean;
  downloaded: boolean;
  downloading: boolean;
  onClose: () => void;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSetShuffle: (on: boolean) => void;
  onSetRepeat: (mode: RepeatMode) => void;
  onSetSleep: (minutes: number) => void;
  onDownload: () => void;
  onToggleFavorite: () => void;
  onAddToPlaylist: () => void;
  onEditGenres: () => void;
}) {
  const snapshot = usePlayerLive();
  const [sleepOpen, setSleepOpen] = useState(false);
  const duration = snapshot.duration || track.durationSec || 0;
  const progress = duration > 0 ? Math.min(100, (snapshot.time / duration) * 100) : 0;

  const cycleRepeat = () => {
    if (snapshot.repeat === "off") onSetRepeat("all");
    else if (snapshot.repeat === "all") onSetRepeat("one");
    else onSetRepeat("off");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0e]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[calc(1.5rem+var(--vm-safe-bottom))] pt-2">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="閉じる" onClick={onClose} className="rounded-full p-2 text-zinc-400">
            <ChevronDown className="h-5 w-5" />
          </button>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            再生中
          </div>
          <button
            type="button"
            aria-label="プレイリストに追加"
            onClick={onAddToPlaylist}
            className="rounded-full p-2 text-zinc-400"
          >
            <ListPlus className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-1 flex-col items-center justify-center">
          <CoverArt
            title={track.title}
            url={coverUrl ?? track.coverThumb ?? track.artworkUrl ?? track.thumbnailLink}
            size="hero"
            className="mx-auto max-w-[300px] shadow-2xl"
          />
          <div className="mt-6 w-full">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-white">{track.title}</h1>
                <div className="mt-0.5 truncate text-[13px] text-zinc-400">
                  {track.artist || "不明なアーティスト"}
                </div>
                <div className="truncate text-[11px] text-zinc-600">
                  {[track.album, track.year].filter(Boolean).join(" · ")}
                </div>
                {genres.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {genres.slice(0, 3).map((genre) => (
                      <span
                        key={genre}
                        className="rounded px-1.5 py-0.5 text-[9px]"
                        style={{
                          backgroundColor: `${genreColor(genre)}22`,
                          color: genreColor(genre),
                        }}
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
                className={`shrink-0 p-2 ${favorite ? "text-rose-400" : "text-zinc-500"}`}
              >
                <Heart className={`h-6 w-6 ${favorite ? "fill-current" : ""}`} />
              </button>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={Math.min(snapshot.time, Math.max(1, duration))}
              onChange={(event) => onSeek(Number(event.target.value))}
              className="mt-5 w-full"
              style={{
                background: `linear-gradient(to right,#f43f5e ${progress}%, #3f3f46 ${progress}%)`,
              }}
            />
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-500">
              <span>{formatTime(snapshot.time)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {snapshot.error ? (
              <div className="mt-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-center text-[11px] text-rose-300">
                {snapshot.error}
              </div>
            ) : (
              <div className="mt-2 h-[18px] text-center text-[10px] text-zinc-600">
                {snapshot.loading
                  ? "読み込み中…"
                  : `${snapshot.source === "stream" ? "ストリーミング" : snapshot.source === "blob" ? "取得済み" : ""} · ${track.fileName}`}
              </div>
            )}

            <div className="mt-3 flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="シャッフル"
                onClick={() => onSetShuffle(!snapshot.shuffle)}
                className={snapshot.shuffle ? "text-rose-400" : "text-zinc-500"}
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button type="button" aria-label="前へ" onClick={onPrev} className="text-zinc-200">
                <SkipBack className="h-7 w-7 fill-current" />
              </button>
              <button
                type="button"
                aria-label={snapshot.isPlaying ? "一時停止" : "再生"}
                onClick={onToggle}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg"
              >
                {snapshot.loading ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                ) : snapshot.isPlaying ? (
                  <Pause className="h-7 w-7 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-7 w-7 fill-current" />
                )}
              </button>
              <button type="button" aria-label="次へ" onClick={onNext} className="text-zinc-200">
                <SkipForward className="h-7 w-7 fill-current" />
              </button>
              <button
                type="button"
                aria-label="リピート"
                onClick={cycleRepeat}
                className={snapshot.repeat !== "off" ? "text-rose-400" : "text-zinc-500"}
              >
                {snapshot.repeat === "one" ? (
                  <Repeat1 className="h-5 w-5" />
                ) : (
                  <Repeat className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onDownload}
                disabled={downloaded}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] ${
                  downloaded
                    ? "border-emerald-500/30 text-emerald-300"
                    : "border-white/15 text-zinc-300"
                }`}
              >
                {downloading ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                ) : downloaded ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {downloaded ? "保存済み" : downloading ? "保存中" : "端末に保存"}
              </button>
              <button
                type="button"
                onClick={() => setSleepOpen((open) => !open)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] ${
                  snapshot.sleepUntil ? "border-amber-400/40 text-amber-300" : "border-white/15 text-zinc-300"
                }`}
              >
                <Timer className="h-3.5 w-3.5" />
                スリープ
              </button>
              <button
                type="button"
                onClick={onEditGenres}
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-zinc-300"
              >
                <Tags className="h-3.5 w-3.5" />
                ジャンル
              </button>
            </div>

            {sleepOpen ? (
              <div className="mt-3 flex justify-center gap-1.5">
                {SLEEP_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      onSetSleep(minutes);
                      setSleepOpen(false);
                    }}
                    className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300"
                  >
                    {minutes === 0 ? "オフ" : `${minutes}分`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
