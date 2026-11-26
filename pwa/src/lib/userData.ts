import type { Playlist, QueueState, UserData } from "./types";

const KEY = "vaultmusic.user.v1";

const listeners = new Set<() => void>();
let cache: UserData | null = null;

function emptyUserData(): UserData {
  return {
    version: 1,
    playlists: [],
    favorites: { tracks: [], albums: [] },
    history: [],
    playCounts: {},
    customGenres: [],
    trackGenres: {},
    queue: null,
    updatedAt: Date.now(),
  };
}

function sanitize(parsed: Partial<UserData>): UserData {
  const base = emptyUserData();
  return {
    ...base,
    ...parsed,
    favorites: {
      tracks: Array.isArray(parsed.favorites?.tracks) ? parsed.favorites.tracks : [],
      albums: Array.isArray(parsed.favorites?.albums) ? parsed.favorites.albums : [],
    },
    playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, 500) : [],
    playCounts: parsed.playCounts && typeof parsed.playCounts === "object" ? parsed.playCounts : {},
    customGenres: Array.isArray(parsed.customGenres)
      ? parsed.customGenres.filter((name): name is string => typeof name === "string")
      : [],
    trackGenres:
      parsed.trackGenres && typeof parsed.trackGenres === "object"
        ? parsed.trackGenres
        : {},
    queue: parsed.queue ?? null,
    version: 1,
  };
}

export function getUserData(): UserData {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = emptyUserData();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? sanitize(JSON.parse(raw) as Partial<UserData>) : emptyUserData();
  } catch {
    cache = emptyUserData();
  }
  return cache;
}

function persist(data: UserData): void {
  cache = data;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // 容量超過などは無視する
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeUserData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateUserData(mutator: (data: UserData) => void): UserData {
  const next: UserData = {
    ...getUserData(),
    favorites: {
      tracks: [...getUserData().favorites.tracks],
      albums: [...getUserData().favorites.albums],
    },
    playlists: getUserData().playlists.map((playlist) => ({ ...playlist })),
    history: [...getUserData().history],
    playCounts: { ...getUserData().playCounts },
    customGenres: [...getUserData().customGenres],
    trackGenres: { ...getUserData().trackGenres },
  };
  mutator(next);
  next.updatedAt = Date.now();
  persist(next);
  return next;
}

export function toggleFavoriteTrack(trackId: string): boolean {
  let added = false;
  updateUserData((data) => {
    const index = data.favorites.tracks.indexOf(trackId);
    if (index >= 0) data.favorites.tracks.splice(index, 1);
    else {
      data.favorites.tracks.push(trackId);
      added = true;
    }
  });
  return added;
}

export function toggleFavoriteAlbum(albumKey: string): boolean {
  let added = false;
  updateUserData((data) => {
    const index = data.favorites.albums.indexOf(albumKey);
    if (index >= 0) data.favorites.albums.splice(index, 1);
    else {
      data.favorites.albums.push(albumKey);
      added = true;
    }
  });
  return added;
}

export function createPlaylist(name: string): Playlist {
  const playlist: Playlist = {
    id: `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "新しいプレイリスト",
    trackIds: [],
    createdAt: Date.now(),
  };
  updateUserData((data) => {
    data.playlists.push(playlist);
  });
  return playlist;
}

export function renamePlaylist(id: string, name: string): void {
  updateUserData((data) => {
    const playlist = data.playlists.find((item) => item.id === id);
    if (playlist) playlist.name = name.trim() || playlist.name;
  });
}

export function deletePlaylist(id: string): void {
  updateUserData((data) => {
    data.playlists = data.playlists.filter((item) => item.id !== id);
  });
}

export function addToPlaylist(id: string, trackId: string): void {
  updateUserData((data) => {
    const playlist = data.playlists.find((item) => item.id === id);
    if (playlist && !playlist.trackIds.includes(trackId)) playlist.trackIds.push(trackId);
  });
}

export function removeFromPlaylist(id: string, trackId: string): void {
  updateUserData((data) => {
    const playlist = data.playlists.find((item) => item.id === id);
    if (playlist) playlist.trackIds = playlist.trackIds.filter((item) => item !== trackId);
  });
}

export function recordPlay(trackId: string, completed = false): void {
  updateUserData((data) => {
    data.playCounts[trackId] = (data.playCounts[trackId] ?? 0) + 1;
    data.history.unshift({ trackId, playedAt: Date.now(), completed });
    data.history = data.history.slice(0, 500);
  });
}

export function setTrackGenres(
  trackId: string,
  selected: string[],
  autoGenres: string[]
): void {
  updateUserData((data) => {
    data.trackGenres = {
      ...data.trackGenres,
      [trackId]: {
        added: selected.filter((genre) => !autoGenres.includes(genre)),
        removed: autoGenres.filter((genre) => !selected.includes(genre)),
      },
    };
  });
}

export function addGenresToTracks(trackIds: string[], genres: string[]): void {
  updateUserData((data) => {
    const next = { ...data.trackGenres };
    for (const id of trackIds) {
      const override = next[id] ?? { added: [], removed: [] };
      next[id] = {
        added: Array.from(new Set([...override.added, ...genres])),
        removed: override.removed.filter((genre) => !genres.includes(genre)),
      };
    }
    data.trackGenres = next;
  });
}

export function removeGenresFromTracks(trackIds: string[], genres: string[]): void {
  updateUserData((data) => {
    const next = { ...data.trackGenres };
    for (const id of trackIds) {
      const override = next[id] ?? { added: [], removed: [] };
      next[id] = {
        added: override.added.filter((genre) => !genres.includes(genre)),
        removed: Array.from(new Set([...override.removed, ...genres])),
      };
    }
    data.trackGenres = next;
  });
}

export function addCustomGenre(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  updateUserData((data) => {
    if (!data.customGenres.includes(trimmed)) data.customGenres.push(trimmed);
  });
  return trimmed;
}

export function saveQueueState(queue: QueueState): void {
  updateUserData((data) => {
    data.queue = queue;
  });
}

export function getQueueState(): QueueState | null {
  return getUserData().queue;
}
