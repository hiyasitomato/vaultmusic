"use client";

import {
  ChevronRight,
  Download,
  HardDrive,
  Heart,
  History,
  ListMusic,
  Play,
  Shuffle,
  Sparkles,
} from "lucide-react";
import type { Library, PlayerSnapshot, Track, UserData } from "@/lib/types";
import { formatBytes, formatTime } from "@/lib/format";
import { CoverArt } from "./CoverArt";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold tracking-wide text-zinc-300">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TrackCard({
  track,
  onPlay,
}: {
  track: Track;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="w-28 shrink-0 text-left active:opacity-70"
    >
      <CoverArt title={track.title} url={track.thumbnailLink} size="card" />
      <div className="mt-1.5 truncate text-[12px] font-medium text-zinc-100">{track.title}</div>
      <div className="truncate text-[11px] text-zinc-400">
        {track.artist || "不明なアーティスト"}
      </div>
    </button>
  );
}

export function HomeView({
  library,
  userData,
  downloads,
  snapshot,
  currentTrack,
  savedBytes,
  limitBytes,
  onPlayTrack,
  onPlayShuffle,
  onResume,
  onOpenDetail,
  onShowTracks,
  onSaveNext,
}: {
  library: Library;
  userData: UserData;
  downloads: Set<string>;
  snapshot: PlayerSnapshot;
  currentTrack: Track | null;
  savedBytes: number;
  limitBytes: number;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onPlayShuffle: () => void;
  onResume: () => void;
  onOpenDetail: (kind: "favorites" | "history") => void;
  onShowTracks: () => void;
  onSaveNext: () => void;
}) {
  const byModified = [...library.tracks].sort((a, b) =>
    (b.modifiedTime || "").localeCompare(a.modifiedTime || "")
  );
  const recent = byModified.slice(0, 10);
  const topPlayed = [...library.tracks]
    .filter((track) => (userData.playCounts[track.id] ?? 0) > 0)
    .sort((a, b) => (userData.playCounts[b.id] ?? 0) - (userData.playCounts[a.id] ?? 0))
    .slice(0, 10);
  const favoriteTracks = userData.favorites.tracks
    .map((id) => library.tracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track))
    .slice(0, 10);

  const downloadedCount = downloads.size;
  const total = library.tracks.length;
  const progress = limitBytes > 0 ? Math.min(100, (savedBytes / limitBytes) * 100) : 0;
  const remaining = Math.max(0, total - downloadedCount);

  return (
    <div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onPlayShuffle}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[13px] font-semibold text-black"
        >
          <Shuffle className="h-4 w-4" />
          全曲シャッフル
        </button>
        <button
          type="button"
          onClick={onShowTracks}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-[13px] text-zinc-200"
        >
          <ListMusic className="h-4 w-4" />
          曲一覧
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/25 via-rose-600/15 to-amber-500/10 p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-rose-200/80">
          <Sparkles className="h-3.5 w-3.5" />
          通学セット
        </div>
        <div className="mt-1 flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-white">
              {downloadedCount}
              <span className="ml-1 text-sm font-medium text-zinc-400">/ {total} 曲 保存済み</span>
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-400">
              {formatBytes(savedBytes)} 使用 · 残り {formatBytes(Math.max(0, limitBytes - savedBytes))}
            </div>
          </div>
          <HardDrive className="h-8 w-8 text-white/20" />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSaveNext}
            disabled={remaining === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-black disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {remaining === 0 ? "すべて保存済み" : "オフライン用に保存"}
          </button>
          <button
            type="button"
            onClick={onPlayShuffle}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-[13px] font-medium text-zinc-100"
          >
            <Shuffle className="h-4 w-4" />
            全曲
          </button>
        </div>
      </div>

      {currentTrack ? (
        <button
          type="button"
          onClick={onResume}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left active:bg-white/[0.07]"
        >
          <CoverArt title={currentTrack.title} url={currentTrack.thumbnailLink} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
              続きから
            </div>
            <div className="truncate text-sm font-medium">{currentTrack.title}</div>
            <div className="truncate text-[11px] text-zinc-400">
              {currentTrack.artist || "不明なアーティスト"}
              {snapshot.time > 0 ? ` · ${formatTime(snapshot.time)} から` : ""}
            </div>
          </div>
          <Play className="h-5 w-5 fill-current text-white" />
        </button>
      ) : null}

      <Section
        title="最近追加"
        action={
          <button
            type="button"
            onClick={() => onShowTracks()}
            className="flex items-center text-[11px] text-zinc-500"
          >
            もっと見る <ChevronRight className="h-3.5 w-3.5" />
          </button>
        }
      >
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {recent.map((track) => (
            <TrackCard key={track.id} track={track} onPlay={() => onPlayTrack(track, recent)} />
          ))}
        </div>
      </Section>

      {topPlayed.length > 0 ? (
        <Section title="よく聴く">
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {topPlayed.map((track) => (
              <TrackCard key={track.id} track={track} onPlay={() => onPlayTrack(track, topPlayed)} />
            ))}
          </div>
        </Section>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenDetail("favorites")}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
        >
          <Heart className="h-4 w-4 text-rose-400" />
          <div>
            <div className="text-[13px] font-medium">お気に入り</div>
            <div className="text-[10px] text-zinc-500">
              {userData.favorites.tracks.length} 曲
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onOpenDetail("history")}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
        >
          <History className="h-4 w-4 text-violet-400" />
          <div>
            <div className="text-[13px] font-medium">再生履歴</div>
            <div className="text-[10px] text-zinc-500">{userData.history.length} 件</div>
          </div>
        </button>
      </div>

      {favoriteTracks.length > 0 ? (
        <Section title="お気に入りの曲">
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {favoriteTracks.map((track) => (
              <TrackCard key={track.id} track={track} onPlay={() => onPlayTrack(track, favoriteTracks)} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
