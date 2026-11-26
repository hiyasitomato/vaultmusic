"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { PlayerSnapshot, Track, UserData } from "@/lib/types";
import { naturalCompare } from "@/lib/format";
import { TrackRow } from "./TrackRow";
import { TrackGridCard } from "./TrackGridCard";

type SortKey = "title" | "added" | "artist" | "duration";
type FilterKey = "all" | "downloaded" | "unsaved";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "title", label: "曲名" },
  { key: "added", label: "追加日" },
  { key: "artist", label: "アーティスト" },
  { key: "duration", label: "長さ" },
];

export function TracksView({
  tracks,
  userData,
  downloads,
  downloading,
  snapshot,
  genres,
  genreList,
  onPlayTrack,
  onToggleFavorite,
  onDownload,
}: {
  tracks: Track[];
  userData: UserData;
  downloads: Set<string>;
  downloading: Set<string>;
  snapshot: PlayerSnapshot;
  genres: Record<string, string[]>;
  genreList: { name: string; count: number; color: string }[];
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onToggleFavorite: (track: Track) => void;
  onDownload: (track: Track) => void;
}) {
  const [sort, setSort] = useState<SortKey>("title");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [genreFilter, setGenreFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return window.localStorage.getItem("vaultmusic.tracksView") === "list" ? "list" : "grid";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("vaultmusic.tracksView", view);
    } catch {
      // 無視
    }
  }, [view]);

  const visible = useMemo(() => {
    const filtered = tracks.filter((track) => {
      if (genreFilter && !(genres[track.id] ?? []).includes(genreFilter)) return false;
      if (filter === "downloaded") return downloads.has(track.id);
      if (filter === "unsaved") return !downloads.has(track.id);
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "added") return (b.modifiedTime || "").localeCompare(a.modifiedTime || "");
      if (sort === "artist") {
        const byArtist = naturalCompare(a.artist || "不明", b.artist || "不明");
        return byArtist || naturalCompare(a.title, b.title);
      }
      if (sort === "duration") return b.durationSec - a.durationSec;
      return naturalCompare(a.title, b.title);
    });
  }, [tracks, sort, filter, genreFilter, genres, downloads]);

  return (
    <div>
      <div className="mt-3 flex items-center justify-between px-1">
        <h1 className="text-lg font-bold">曲</h1>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">{tracks.length} 曲</span>
          <div className="flex rounded-lg border border-white/10 p-0.5">
            <button
              type="button"
              aria-label="グリッド表示"
              onClick={() => setView("grid")}
              className={`rounded p-1 ${view === "grid" ? "bg-white text-black" : "text-zinc-500"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="リスト表示"
              onClick={() => setView("list")}
              className={`rounded p-1 ${view === "list" ? "bg-white text-black" : "text-zinc-500"}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
        {SORTS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSort(item.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] ${
              sort === item.key
                ? "bg-white text-black"
                : "border border-white/10 text-zinc-400"
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
        {(
          [
            ["all", "すべて"],
            ["downloaded", "保存済み"],
            ["unsaved", "未保存"],
          ] as [FilterKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] ${
              filter === key
                ? "bg-rose-600 text-white"
                : "border border-white/10 text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
        {genreList.length > 0 ? (
          <select
            value={genreFilter}
            onChange={(event) => setGenreFilter(event.target.value)}
            className="shrink-0 rounded-full border border-white/10 bg-[#17171c] px-2.5 py-1 text-[11px] text-zinc-300"
          >
            <option value="">ジャンル: すべて</option>
            {genreList.map((genre) => (
              <option key={genre.name} value={genre.name}>
                {genre.name} ({genre.count})
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {view === "grid" ? (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
          {visible.map((track) => (
            <TrackGridCard
              key={track.id}
              track={track}
              isCurrent={snapshot.trackId === track.id}
              isPlaying={snapshot.isPlaying}
              downloaded={downloads.has(track.id)}
              downloading={downloading.has(track.id)}
              favorite={userData.favorites.tracks.includes(track.id)}
              genres={genres[track.id] ?? []}
              onPlay={() => onPlayTrack(track, visible)}
              onToggleFavorite={() => onToggleFavorite(track)}
              onDownload={() => onDownload(track)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-2 divide-y divide-white/[0.04]">
          {visible.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              isCurrent={snapshot.trackId === track.id}
              isPlaying={snapshot.isPlaying}
              downloaded={downloads.has(track.id)}
              downloading={downloading.has(track.id)}
              favorite={userData.favorites.tracks.includes(track.id)}
              genres={genres[track.id] ?? []}
              onPlay={() => onPlayTrack(track, visible)}
              onToggleFavorite={() => onToggleFavorite(track)}
              onDownload={() => onDownload(track)}
            />
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-500">曲がありません</div>
      ) : null}
    </div>
  );
}
