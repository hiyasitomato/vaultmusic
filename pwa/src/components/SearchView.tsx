"use client";

import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import type { Library, PlayerSnapshot, Track, UserData } from "@/lib/types";
import { searchTracks } from "@/lib/library";
import { TrackRow } from "./TrackRow";

export function SearchView({
  library,
  userData,
  downloads,
  downloading,
  snapshot,
  onPlayTrack,
  onToggleFavorite,
  onDownload,
}: {
  library: Library;
  userData: UserData;
  downloads: Set<string>;
  downloading: Set<string>;
  snapshot: PlayerSnapshot;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onToggleFavorite: (track: Track) => void;
  onDownload: (track: Track) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const results = deferredQuery.trim() ? searchTracks(library, deferredQuery) : [];

  return (
    <div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="曲名・アーティスト・アルバム"
          autoFocus
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
        />
      </div>

      <div className="mt-2 text-[11px] text-zinc-500">
        {query.trim() ? `${results.length} 件` : "ファイル名でも検索できます"}
      </div>

      <div className="mt-1 divide-y divide-white/[0.04]">
        {results.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            isCurrent={snapshot.trackId === track.id}
            isPlaying={snapshot.isPlaying}
            downloaded={downloads.has(track.id)}
            downloading={downloading.has(track.id)}
            favorite={userData.favorites.tracks.includes(track.id)}
            onPlay={() => onPlayTrack(track, results)}
            onToggleFavorite={() => onToggleFavorite(track)}
            onDownload={() => onDownload(track)}
          />
        ))}
      </div>
    </div>
  );
}
