"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home,
  Library,
  ListMusic,
  Loader2,
  Music4,
  RefreshCw,
  Search,
  Settings2,
  WifiOff,
} from "lucide-react";
import type { Library as LibraryData, Settings, Track, UserData } from "@/lib/types";
import { DEFAULT_SETTINGS, BASE_PATH, extractFolderId, loadSettings, saveSettings } from "@/lib/config";
import { forgetToken, getValidToken, peekToken, requestToken, revokeToken } from "@/lib/auth";
import { fetchFileBytes, findFolderByName, listMusicFolder } from "@/lib/drive";
import { buildLibrary } from "@/lib/library";
import {
  cacheCatalog,
  clearDownloads,
  downloadTrack as saveTrackToDb,
  getAllTrackTags,
  getAudioBlob,
  getCachedCatalog,
  getCachedCover,
  getDownloadedBytes,
  getDownloadedIds,
  putCachedCover,
  storageUsage,
} from "@/lib/offline";
import { coverToBlob, extractCover } from "@/lib/metadata";
import { estimateScanBytes, scanLibraryMetadata, type ScanProgress } from "@/lib/scan";
import { applyTagsToLibrary } from "@/lib/tags";
import { player } from "@/lib/player";
import { usePlayerUI } from "@/lib/usePlayer";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist as deletePlaylistData,
  getUserData,
  recordPlay,
  subscribeUserData,
  toggleFavoriteTrack,
} from "@/lib/userData";
import { HomeView } from "./HomeView";
import { TracksView } from "./TracksView";
import { LibraryView } from "./LibraryView";
import { SearchView } from "./SearchView";
import { DetailView, type DetailState } from "./DetailView";
import { PlayerBar } from "./PlayerBar";
import { FullPlayer } from "./FullPlayer";
import { SettingsView } from "./SettingsView";
import { SetupScreen } from "./SetupScreen";
import { PlaylistPicker } from "./PlaylistPicker";

type Tab = "home" | "tracks" | "library" | "search";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "処理に失敗しました";
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [userData, setUserData] = useState<UserData>(() => getUserData());
  const snapshot = usePlayerUI();
  const [downloads, setDownloads] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [savedBytes, setSavedBytes] = useState(0);
  const [usage, setUsage] = useState({ usage: 0, quota: 0 });
  const [online, setOnline] = useState(true);
  const [authState, setAuthState] = useState<"online" | "cached" | "offline">("offline");
  const [tab, setTab] = useState<Tab>("home");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullPlayer, setFullPlayer] = useState(false);
  const [playlistPicker, setPlaylistPicker] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [tagCount, setTagCount] = useState(0);
  const [metaScan, setMetaScan] = useState<(ScanProgress & { running: boolean }) | null>(null);

  const settingsRef = useRef<Settings | null>(null);
  const restoredRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverObjectUrl = useRef<string | null>(null);
  const lastRecorded = useRef<string | null>(null);
  const downloadBusy = useRef(false);
  const prefetched = useRef<Set<string>>(new Set());
  const stopScanRef = useRef(false);
  const scanRunningRef = useRef(false);

  function showToast(message: string): void {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function updateSettings(next: Settings): void {
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
  }

  function maybeRestore(lib: LibraryData): void {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (player.restore(lib.tracks)) {
      showToast("前回の続きから再開できます");
      const current = player.getTrack();
      if (current && settingsRef.current?.allowCellular && peekToken()) {
        void prefetchTrack(current);
      }
    }
  }

  async function refreshStorage(): Promise<void> {
    try {
      const [bytes, estimate] = await Promise.all([getDownloadedBytes(), storageUsage()]);
      setSavedBytes(bytes);
      setUsage(estimate);
    } catch {
      setSavedBytes(0);
    }
  }

  async function ensureToken(interactive: boolean): Promise<string> {
    const clientId = settingsRef.current?.clientId ?? "";
    if (!interactive) {
      const token = await getValidToken(clientId);
      player.setAccessToken(token);
      setAuthState("online");
      return token;
    }
    const existing = peekToken();
    if (existing) {
      player.setAccessToken(existing);
      setAuthState("online");
      return existing;
    }
    const refreshed = await requestToken(clientId, false);
    player.setAccessToken(refreshed.token);
    setAuthState("online");
    return refreshed.token;
  }

  async function loadLibrary(folderId: string, token: string): Promise<void> {
    player.setAccessToken(token);
    setBusyLabel("音楽フォルダを確認中…");
    let listing: Awaited<ReturnType<typeof listMusicFolder>>;
    try {
      listing = await listMusicFolder(folderId, token);
    } catch (error) {
      throw new Error(`Drive接続に失敗: ${errorMessage(error)}`);
    }
    const { files, folders } = listing;
    setBusyLabel(`${files.length}曲の情報を整理中…`);
    const built = buildLibrary(files, folders, folderId);
    if (built.tracks.length === 0) {
      throw new Error(
        "このフォルダに音声ファイルが見つかりませんでした。音楽フォルダの URL を確認してください。"
      );
    }
    const storedTags = await getAllTrackTags().catch(() => ({} as Record<string, never>));
    const hasStoredTags = Object.keys(storedTags).length > 0;
    const lib = hasStoredTags ? applyTagsToLibrary(built, storedTags) : built;
    setTagCount(Object.keys(storedTags).length);
    try {
      await cacheCatalog(lib);
    } catch {
      // キャッシュに失敗しても、今回のセッションでは表示できる
    }
    setLibrary(lib);
    setAuthState("online");
    maybeRestore(lib);
    setDownloads(await getDownloadedIds().catch(() => new Set<string>()));
    await refreshStorage();
    showToast(`${lib.tracks.length}曲を読み込みました`);
  }

  async function connect(clientId: string, folderId: string): Promise<void> {
    setConnectError(null);
    setBusy(true);
    try {
      const next: Settings = {
        ...(settingsRef.current ?? DEFAULT_SETTINGS),
        clientId: clientId.trim(),
        folderId,
      };
      updateSettings(next);
      const token = await ensureToken(true);
      await loadLibrary(folderId, token);
    } catch (error) {
      console.error("[VaultMusic] connect failed", error);
      setConnectError(errorMessage(error));
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  async function login(clientId: string): Promise<void> {
    setConnectError(null);
    const result = await requestToken(clientId.trim(), false);
    player.setAccessToken(result.token);
    const next: Settings = { ...(settingsRef.current ?? DEFAULT_SETTINGS), clientId: clientId.trim() };
    updateSettings(next);
    setAuthState("online");
  }

  async function detectFolder(clientId: string): Promise<{ id: string; name: string } | null> {
    if (clientId.trim() && clientId.trim() !== settingsRef.current?.clientId) {
      updateSettings({ ...(settingsRef.current ?? DEFAULT_SETTINGS), clientId: clientId.trim() });
    }
    const token = await ensureToken(true);
    for (const name of ["音楽", "Music"]) {
      const found = await findFolderByName(name, token);
      if (found) return found;
    }
    return null;
  }

  async function rescan(): Promise<void> {
    const current = settingsRef.current;
    const folderId = extractFolderId(current?.folderId ?? "");
    if (!folderId) {
      showToast("音楽フォルダが未設定です");
      return;
    }
    setBusy(true);
    try {
      const token = await ensureToken(true);
      await loadLibrary(folderId, token);
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  async function prefetchTrack(track: Track): Promise<void> {
    if (downloadBusy.current) return;
    if (downloads.has(track.id) || downloading.has(track.id)) return;
    if (prefetched.current.has(track.id)) return;
    prefetched.current.add(track.id);
    try {
      const token = peekToken() ?? (await ensureToken(false));
      await saveTrackToDb(
        track,
        token,
        settingsRef.current?.cacheLimitBytes ?? DEFAULT_SETTINGS.cacheLimitBytes
      );
      setDownloads(await getDownloadedIds().catch(() => new Set<string>()));
    } catch {
      prefetched.current.delete(track.id);
    }
  }

  async function scanTags(force = false): Promise<void> {
    if (!library || scanRunningRef.current) return;
    scanRunningRef.current = true;
    stopScanRef.current = false;
    const total = library.tracks.length;
    setMetaScan({ running: true, done: 0, total, bytes: 0, failed: 0 });
    showToast("タグとサムネイルを取得中…（中止できます）");
    try {
      const token = await ensureToken(true);
      await scanLibraryMetadata(library.tracks, token, {
        force,
        shouldStop: () => stopScanRef.current,
        onProgress: (progress) => setMetaScan({ ...progress, running: true }),
      });
      const tags = await getAllTrackTags().catch(() => ({} as Record<string, never>));
      setTagCount(Object.keys(tags).length);
      const enriched = applyTagsToLibrary(library, tags);
      setLibrary(enriched);
      await cacheCatalog(enriched).catch(() => undefined);
      showToast(
        stopScanRef.current ? "取得を中止しました" : "タグとサムネイルを取得しました"
      );
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      scanRunningRef.current = false;
      setMetaScan((prev) => (prev ? { ...prev, running: false } : prev));
    }
  }

  async function downloadOne(track: Track): Promise<void> {    if (downloads.has(track.id) || downloading.has(track.id)) return;
    setDownloading((prev) => new Set(prev).add(track.id));
    try {
      const token = await ensureToken(true);
      await saveTrackToDb(
        track,
        token,
        settingsRef.current?.cacheLimitBytes ?? DEFAULT_SETTINGS.cacheLimitBytes
      );
      setDownloads(await getDownloadedIds().catch(() => new Set<string>()));
      await refreshStorage();
      showToast(`保存しました：${track.title}`);
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  }

  async function downloadMany(tracks: Track[]): Promise<void> {
    if (downloadBusy.current) {
      showToast("保存中です");
      return;
    }
    const pending = tracks.filter((track) => !downloads.has(track.id));
    if (pending.length === 0) {
      showToast("すべて保存済みです");
      return;
    }
    let token = "";
    try {
      token = await ensureToken(true);
    } catch (error) {
      showToast(errorMessage(error));
      return;
    }
    downloadBusy.current = true;
    const limit = settingsRef.current?.cacheLimitBytes ?? DEFAULT_SETTINGS.cacheLimitBytes;
    let saved = 0;
    try {
      for (const track of pending) {
        setDownloading((prev) => new Set(prev).add(track.id));
        showToast(`保存中 ${saved + 1}/${pending.length}`);
        try {
          await saveTrackToDb(track, token, limit);
          setDownloads((prev) => new Set(prev).add(track.id));
          saved += 1;
        } catch (error) {
          showToast(`${track.title}：${errorMessage(error)}`);
          break;
        } finally {
          setDownloading((prev) => {
            const next = new Set(prev);
            next.delete(track.id);
            return next;
          });
        }
      }
    } finally {
      downloadBusy.current = false;
    }
    await refreshStorage();
    setDownloads(await getDownloadedIds().catch(() => new Set<string>()));
    if (saved > 0) showToast(`${saved}曲を保存しました`);
  }

  function playShuffleTracks(tracks: Track[]): void {
    if (tracks.length === 0) return;
    const start = Math.floor(Math.random() * tracks.length);
    player.setQueue(tracks, start);
    player.setShuffle(true);
  }

  function playTrack(track: Track, queue: Track[]): void {
    if (queue.length === 0) return;
    const index = Math.max(0, queue.findIndex((item) => item.id === track.id));
    player.setQueue(queue, index);
  }

  function playShuffleAll(): void {
    if (!library || library.tracks.length === 0) return;
    const start = Math.floor(Math.random() * library.tracks.length);
    player.setQueue(library.tracks, start);
    player.setShuffle(true);
  }

  function firstTrackForDetail(next: DetailState): Track | null {
    if (!library) return null;
    let ids: string[] = [];
    if (next.kind === "folders") {
      ids = library.folders.find((item) => item.folderId === next.id)?.trackIds ?? [];
    } else if (next.kind === "artists") {
      ids = library.artists.find((item) => item.name === next.id)?.trackIds ?? [];
    } else if (next.kind === "albums") {
      ids = library.albums.find((item) => item.key === next.id)?.trackIds ?? [];
    } else if (next.kind === "playlists") {
      ids = userData.playlists.find((item) => item.id === next.id)?.trackIds ?? [];
    } else if (next.kind === "favorites") {
      ids = next.id === "albums" ? [] : userData.favorites.tracks;
    } else if (next.kind === "history") {
      ids = userData.history.map((entry) => entry.trackId);
    }
    const firstId = ids[0];
    return firstId ? library.tracks.find((track) => track.id === firstId) ?? null : null;
  }

  function openDetail(next: DetailState): void {
    setDetail(next);
    if (!settingsRef.current?.allowCellular) return;
    const first = firstTrackForDetail(next);
    if (first) void prefetchTrack(first);
  }

  function saveNextForCommute(): void {
    if (!library) return;
    const queue = player.getQueue();
    const pool = queue.length > 0 ? queue : library.tracks;
    const pending = pool.filter((track) => !downloads.has(track.id));
    if (pending.length === 0) {
      showToast("保存する曲がありません");
      return;
    }
    void downloadMany(pending.slice(0, 20));
  }

  function promptCreatePlaylist(): string | null {
    const name = window.prompt("プレイリスト名", "通学");
    if (!name || !name.trim()) return null;
    const playlist = createPlaylist(name);
    showToast("プレイリストを作成しました");
    return playlist.id;
  }

  useEffect(() => {
    if (!snapshot.needData) return;
    showToast("未保存の曲です。設定で通信再生をONにするか、端末に保存してください");
    player.clearNeedData();
    player.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.needData]);

  useEffect(() => {
    const loaded = loadSettings();
    settingsRef.current = loaded;
    setSettings(loaded);
    const existingToken = peekToken();
    if (existingToken) player.setAccessToken(existingToken);
    player.warmup();
    setUserData(getUserData());
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    const unsubscribeUser = subscribeUserData(() => setUserData(getUserData()));

    void (async () => {
      try {
        const cached = await getCachedCatalog();
        if (cached) {
          const storedTags = await getAllTrackTags().catch(
            () => ({} as Record<string, never>)
          );
          const hasStoredTags = Object.keys(storedTags).length > 0;
          const enriched = hasStoredTags ? applyTagsToLibrary(cached, storedTags) : cached;
          setTagCount(Object.keys(storedTags).length);
          setLibrary(enriched);
          setAuthState(peekToken() ? "online" : "cached");
          maybeRestore(enriched);
          if (enriched !== cached) void cacheCatalog(enriched).catch(() => undefined);
        }
        setDownloads(await getDownloadedIds().catch(() => new Set<string>()));
        await refreshStorage();
      } catch {
        // キャッシュが読めなくても、オンライン接続は試せる
      }
    })();

    const handleOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOnline);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js?v=3`, { updateViaCache: "none" })
        .then((registration) => registration.update().catch(() => undefined))
        .catch(() => undefined);
    }

    return () => {
      unsubscribeUser();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOnline);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const flush = () => player.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") player.flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    player.setDownloadedIds(downloads);
  }, [downloads]);

  useEffect(() => {
    if (!settings?.clientId || !library) return;
    if (peekToken()) return;
    let cancelled = false;
    void getValidToken(settings.clientId)
      .then((token) => {
        if (cancelled) return;
        player.setAccessToken(token);
        setAuthState("online");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [settings?.clientId, library]);

  useEffect(() => {
    if (!settings?.allowCellular || !snapshot.isPlaying || !snapshot.trackId) return;
    const upcoming = player
      .getUpcomingTracks(2)
      .filter((track) => !downloads.has(track.id));
    if (upcoming.length === 0) return;
    const timer = setTimeout(() => {
      void (async () => {
        for (const track of upcoming) {
          await prefetchTrack(track);
        }
      })();
    }, 10000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.trackId, snapshot.isPlaying, settings?.allowCellular, downloads]);

  useEffect(() => {
    if (!settings) return;
    player.configure({
      getToken: () => getValidToken(settingsRef.current?.clientId ?? ""),
      allowCellular: () => settingsRef.current?.allowCellular ?? true,
      coverUrl: (track) => track.thumbnailLink ?? null,
      getCacheLimit: () =>
        settingsRef.current?.cacheLimitBytes ?? DEFAULT_SETTINGS.cacheLimitBytes,
      onCached: () => {
        void getDownloadedIds()
          .then((ids) => setDownloads(ids))
          .catch(() => undefined);
        void refreshStorage();
      },
      onDuration: (trackId, seconds) => {
        setLibrary((prev) => {
          if (!prev) return prev;
          const index = prev.tracks.findIndex((track) => track.id === trackId);
          if (index < 0) return prev;
          if (Math.abs(prev.tracks[index].durationSec - seconds) < 1) return prev;
          const tracks = prev.tracks.slice();
          tracks[index] = { ...tracks[index], durationSec: seconds };
          const next = { ...prev, tracks };
          void cacheCatalog(next).catch(() => undefined);
          return next;
        });
      },
    });
  }, [settings]);

  useEffect(() => {
    if (snapshot.trackId && snapshot.isPlaying && lastRecorded.current !== snapshot.trackId) {
      lastRecorded.current = snapshot.trackId;
      recordPlay(snapshot.trackId);
    }
  }, [snapshot.trackId, snapshot.isPlaying]);

  useEffect(() => {
    const track = snapshot.trackId ? player.getTrack() : null;
    if (coverObjectUrl.current) {
      URL.revokeObjectURL(coverObjectUrl.current);
      coverObjectUrl.current = null;
    }
    setCoverUrl(track?.coverThumb ?? track?.thumbnailLink ?? null);
    if (!track) return;
    const coverId = track.coverTrackId ?? track.id;
    let cancelled = false;
    void (async () => {
      try {
        const cached = await getCachedCover(coverId);
        if (cached) {
          const url = URL.createObjectURL(cached);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          coverObjectUrl.current = url;
          setCoverUrl(url);
          return;
        }
        if (track.coverThumb) return;
        const local = await getAudioBlob(track.id);
        let head: Blob | null = null;
        if (local) {
          head = local.slice(0, 512 * 1024);
        } else if (settingsRef.current?.allowCellular) {
          const token = await ensureToken(false);
          head = await fetchFileBytes(track.id, token, "bytes=0-524287");
        }
        if (!head) return;
        const cover = await extractCover(head);
        if (!cover) return;
        const blob = coverToBlob(cover);
        await putCachedCover(track.id, blob);
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        coverObjectUrl.current = url;
        setCoverUrl(url);
      } catch {
        // カバーは無くてもよい
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.trackId]);

  const currentTrack = snapshot.trackId ? player.getTrack() : null;
  const effectiveAuth = !online ? "offline" : authState;

  if (!settings) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!library && busy) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="h-7 w-7 animate-spin" />
        <div className="text-sm">{busyLabel ?? "準備中…"}</div>
      </div>
    );
  }

  if (!library) {
    return (
      <SetupScreen
        initialClientId={settings.clientId}
        initialFolderId={settings.folderId}
        busy={busy}
        error={connectError}
        onLogin={login}
        onDetect={detectFolder}
        onConnect={connect}
      />
    );
  }

  const content = detail ? (
    <DetailView
      detail={detail}
      library={library}
      userData={userData}
      downloads={downloads}
      downloading={downloading}
      snapshot={snapshot}
      onBack={() => setDetail(null)}
      onPlayTrack={playTrack}
      onShuffleTracks={playShuffleTracks}
      onToggleFavorite={(track) => toggleFavoriteTrack(track.id)}
      onDownload={(track) => void downloadOne(track)}
      onDownloadAll={(tracks) => void downloadMany(tracks)}
      onOpenAlbum={(key) => openDetail({ kind: "albums", id: key })}
      onDeletePlaylist={(id) => {
        if (window.confirm("このプレイリストを削除しますか？")) {
          deletePlaylistData(id);
          showToast("プレイリストを削除しました");
        }
      }}
    />
  ) : tab === "home" ? (
    <HomeView
      library={library}
      userData={userData}
      downloads={downloads}
      currentTrack={currentTrack}
      savedBytes={savedBytes}
      limitBytes={settings.cacheLimitBytes}
      onPlayTrack={playTrack}
      onPlayShuffle={playShuffleAll}
      onResume={() => void player.play()}
      onOpenDetail={(kind) => {
        if (kind === "favorites") openDetail({ kind: "favorites", id: "tracks" });
        else openDetail({ kind: "history" });
      }}
      onShowTracks={() => setTab("tracks")}
      onSaveNext={saveNextForCommute}
    />
  ) : tab === "tracks" ? (
    <TracksView
      tracks={library.tracks}
      userData={userData}
      downloads={downloads}
      downloading={downloading}
      snapshot={snapshot}
      onPlayTrack={playTrack}
      onToggleFavorite={(track) => toggleFavoriteTrack(track.id)}
      onDownload={(track) => void downloadOne(track)}
    />
  ) : tab === "library" ? (
    <LibraryView
      library={library}
      userData={userData}
      metaScan={metaScan}
      tagCount={tagCount}
      estimatedBytes={estimateScanBytes(library.tracks)}
      onScanTags={(force) => void scanTags(force)}
      onStopScan={() => {
        stopScanRef.current = true;
        showToast("取得を中止しています…");
      }}
      onCreatePlaylist={() => {
        promptCreatePlaylist();
      }}
      onDeletePlaylist={(id) => {
        if (window.confirm("このプレイリストを削除しますか？")) deletePlaylistData(id);
      }}
      onOpen={(kind, id) => openDetail({ kind: kind as DetailState["kind"], id })}
    />
  ) : (
    <SearchView
      library={library}
      userData={userData}
      downloads={downloads}
      downloading={downloading}
      snapshot={snapshot}
      onPlayTrack={playTrack}
      onToggleFavorite={(track) => toggleFavoriteTrack(track.id)}
      onDownload={(track) => void downloadOne(track)}
    />
  );

  return (
    <div className="min-h-dvh bg-[#0b0b0e] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0b0b0e]/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5">
          <div className="vm-cover flex h-7 w-7 items-center justify-center rounded-lg">
            <Music4 className="h-4 w-4 text-white" />
          </div>
          <div className="mr-1 text-[15px] font-bold">
            <span className="vm-gradient-text">VaultMusic</span>
          </div>
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
              effectiveAuth === "online"
                ? "border-emerald-500/30 text-emerald-300"
                : "border-amber-500/30 text-amber-300"
            }`}
          >
            {effectiveAuth === "online" ? "接続中" : effectiveAuth === "cached" ? "キャッシュ" : "オフライン"}
          </span>
          <button
            type="button"
            aria-label="更新"
            onClick={() => void rescan()}
            className="ml-auto rounded-full p-2 text-zinc-400"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            aria-label="設定"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full p-2 text-zinc-400"
          >
            <Settings2 className="h-4.5 w-4.5" />
          </button>
        </div>
        {!online ? (
          <div className="flex items-center justify-center gap-1.5 bg-amber-500/10 py-1 text-[10px] text-amber-300">
            <WifiOff className="h-3 w-3" />
            オフライン：保存済みの曲を再生できます
          </div>
        ) : null}
      </header>

      <main
        className={`mx-auto max-w-2xl px-4 ${
          currentTrack ? "pb-[calc(10.5rem+var(--vm-safe-bottom))]" : "pb-[calc(6rem+var(--vm-safe-bottom))]"
        }`}
      >
        {content}
      </main>

      {currentTrack ? (
        <PlayerBar
          track={currentTrack}
          onToggle={() => void player.toggle()}
          onNext={() => void player.next(true)}
          onOpen={() => setFullPlayer(true)}
        />
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-[#0b0b0e]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[var(--vm-safe-bottom)]">
          {(
            [
              ["home", "ホーム", Home],
              ["tracks", "曲", ListMusic],
              ["library", "ライブラリ", Library],
              ["search", "検索", Search],
            ] as [Tab, string, typeof Home][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setDetail(null);
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                tab === key && !detail ? "text-rose-400" : "text-zinc-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {fullPlayer && currentTrack ? (
        <FullPlayer
          track={currentTrack}
          coverUrl={coverUrl}
          favorite={userData.favorites.tracks.includes(currentTrack.id)}
          downloaded={downloads.has(currentTrack.id)}
          downloading={downloading.has(currentTrack.id)}
          onClose={() => setFullPlayer(false)}
          onToggle={() => void player.toggle()}
          onNext={() => void player.next(true)}
          onPrev={() => void player.prev()}
          onSeek={(seconds) => player.seek(seconds)}
          onSetShuffle={(on) => player.setShuffle(on)}
          onSetRepeat={(mode) => player.setRepeat(mode)}
          onSetSleep={(minutes) => player.setSleepMinutes(minutes)}
          onDownload={() => void downloadOne(currentTrack)}
          onToggleFavorite={() => toggleFavoriteTrack(currentTrack.id)}
          onAddToPlaylist={() => setPlaylistPicker(true)}
        />
      ) : null}

      {playlistPicker && currentTrack ? (
        <PlaylistPicker
          trackTitle={currentTrack.title}
          playlists={userData.playlists}
          onPick={(playlistId) => {
            addToPlaylist(playlistId, currentTrack.id);
            setPlaylistPicker(false);
            showToast("プレイリストに追加しました");
          }}
          onCreate={() => {
            const id = promptCreatePlaylist();
            if (id) addToPlaylist(id, currentTrack.id);
            setPlaylistPicker(false);
          }}
          onClose={() => setPlaylistPicker(false)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsView
          settings={settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
          onRescan={() => void rescan()}
          onClearDownloads={() => {
            if (!window.confirm("保存した曲をすべて削除しますか？")) return;
            void clearDownloads().then(async () => {
              setDownloads(new Set());
              await refreshStorage();
              showToast("保存した曲を削除しました");
            });
          }}
          onLogout={() => {
            revokeToken();
            forgetToken();
            player.setAccessToken(null);
            setAuthState("cached");
            showToast("ログアウトしました");
          }}
          savedBytes={savedBytes}
          savedCount={downloads.size}
          usage={usage.usage}
          quota={usage.quota}
          busy={busy}
          authState={effectiveAuth}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(11rem+var(--vm-safe-bottom))] z-50 flex justify-center px-4">
          <div className="rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[12px] text-zinc-100 shadow-xl backdrop-blur">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
