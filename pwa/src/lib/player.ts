import type { PlayerSnapshot, QueueState, RepeatMode, Track } from "./types";
import { cacheAudioBlob, getAudioBlob } from "./offline";
import { fetchFileBytes, swMediaUrl } from "./drive";
import { formatTime } from "./format";

const QUEUE_KEY = "vaultmusic.queue.v1";

export function buildOrder(
  length: number,
  shuffle: boolean,
  current = 0,
  seed = Date.now()
): number[] {
  const all = Array.from({ length }, (_, index) => index);
  if (!shuffle || length <= 1) return all;
  const rest = all.filter((index) => index !== current);
  const random = mulberry32(seed);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [current, ...rest];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const EMPTY: PlayerSnapshot = {
  trackId: null,
  isPlaying: false,
  loading: false,
  time: 0,
  duration: 0,
  shuffle: false,
  repeat: "off",
  sleepUntil: null,
  error: null,
  needData: null,
  queueLength: 0,
  queueIndex: -1,
  source: null,
};

class Player {
  private audio: HTMLAudioElement | null = null;
  private tracks: Track[] = [];
  private order: number[] = [];
  private position = -1;
  private shuffle = false;
  private repeat: RepeatMode = "off";
  private sleepUntil: number | null = null;
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(snapshot: PlayerSnapshot) => void>();
  private snapshot: PlayerSnapshot = { ...EMPTY };
  private objectUrl: string | null = null;
  private loadToken = 0;
  private pendingResume = 0;
  private forceStreamOnce = false;
  private lastPersist = 0;
  private lastTimeUpdateAt = 0;
  private downloadedIds = new Set<string>();
  private accessToken: string | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingStream: { track: Track; token: number } | null = null;
  private fallbackInProgress = false;
  private needsLoad = false;
  private deps: {
    getToken: () => Promise<string>;
    allowCellular: () => boolean;
    coverUrl: (track: Track) => string | null;
    onDuration?: (trackId: string, seconds: number) => void;
    getCacheLimit?: () => number;
    onCached?: (trackId: string) => void;
  } = {
    getToken: () => Promise.reject(new Error("ログインが必要です")),
    allowCellular: () => false,
    coverUrl: () => null,
  };

  configure(deps: Partial<Player["deps"]>): void {
    this.deps = { ...this.deps, ...deps };
  }

  setDownloadedIds(ids: Set<string>): void {
    this.downloadedIds = new Set(ids);
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  warmup(): void {
    this.ensureAudio();
  }

  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getState(): PlayerSnapshot {
    return this.snapshot;
  }

  getTrack(): Track | null {
    if (this.position < 0) return null;
    const index = this.order[this.position];
    return this.tracks[index] ?? null;
  }

  getQueue(): Track[] {
    return this.order.map((index) => this.tracks[index]).filter(Boolean);
  }

  getNextTrack(): Track | null {
    return this.getUpcomingTracks(1)[0] ?? null;
  }

  getUpcomingTracks(count: number): Track[] {
    if (this.position < 0 || this.order.length === 0) return [];
    const out: Track[] = [];
    for (let step = 1; step <= count; step += 1) {
      const pos = this.position + step;
      let index: number | null = null;
      if (pos < this.order.length) index = this.order[pos];
      else if (this.repeat === "all") index = this.order[pos % this.order.length];
      if (index === null) break;
      const track = this.tracks[index];
      if (track && !out.some((item) => item.id === track.id)) out.push(track);
    }
    return out;
  }

  setQueue(tracks: Track[], startIndex: number): void {
    this.tracks = tracks;
    this.shuffle = false;
    this.order = buildOrder(tracks.length, false);
    this.position = Math.max(0, Math.min(startIndex, tracks.length - 1));
    this.needsLoad = true;
    this.pendingResume = 0;
    this.update({
      queueLength: tracks.length,
      queueIndex: this.position,
      shuffle: false,
      repeat: this.repeat,
    });
    this.loadCurrent(true);
  }

  restore(tracks: Track[]): boolean {
    if (typeof window === "undefined" || tracks.length === 0) return false;
    let queue: QueueState | null = null;
    try {
      const raw = window.localStorage.getItem(QUEUE_KEY);
      queue = raw ? (JSON.parse(raw) as QueueState) : null;
    } catch {
      queue = null;
    }
    if (!queue || !Array.isArray(queue.trackIds) || queue.trackIds.length === 0) return false;

    const byId = new Map(tracks.map((track) => [track.id, track]));
    const restored = queue.trackIds
      .map((id) => byId.get(id))
      .filter((track): track is Track => Boolean(track));
    if (restored.length === 0) return false;

    this.tracks = restored;
    this.shuffle = Boolean(queue.shuffle);
    this.repeat = queue.repeat ?? "off";
    const currentIndex = Math.max(0, Math.min(queue.index ?? 0, restored.length - 1));
    this.order = buildOrder(restored.length, this.shuffle, currentIndex, Date.now());
    this.position = this.shuffle ? 0 : currentIndex;
    this.pendingResume = Math.max(0, queue.positionSec ?? 0);
    this.needsLoad = true;
    this.update({
      trackId: restored[currentIndex].id,
      time: this.pendingResume,
      duration: restored[currentIndex].durationSec,
      queueLength: restored.length,
      queueIndex: currentIndex,
      shuffle: this.shuffle,
      repeat: this.repeat,
      isPlaying: false,
    });
    return true;
  }

  async toggle(): Promise<void> {
    if (!this.audio) {
      await this.loadCurrent(true);
      return;
    }
    if (this.needsLoad) {
      await this.loadCurrent(true);
      return;
    }
    if (this.audio.paused) {
      await this.safePlay();
    } else {
      this.audio.pause();
    }
  }

  async play(): Promise<void> {
    if (this.needsLoad || !this.audio) await this.loadCurrent(true);
    else await this.safePlay();
  }

  pause(): void {
    this.audio?.pause();
  }

  async next(manual = true): Promise<void> {
    if (this.order.length === 0) return;
    if (!manual && this.repeat === "one") {
      if (this.audio) {
        this.audio.currentTime = 0;
        await this.safePlay();
      }
      return;
    }
    if (this.position + 1 < this.order.length) {
      await this.loadCurrent(true, this.position + 1);
      return;
    }
    if (this.repeat === "all") {
      await this.loadCurrent(true, 0);
      return;
    }
    this.update({ isPlaying: false, loading: false });
  }

  async prev(): Promise<void> {
    if (!this.audio) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      this.update({ time: 0 });
      return;
    }
    if (this.position > 0) {
      await this.loadCurrent(true, this.position - 1);
      return;
    }
    this.audio.currentTime = 0;
    this.update({ time: 0 });
  }

  seek(seconds: number): void {
    if (!this.audio || !Number.isFinite(seconds)) return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : this.snapshot.duration;
    const target = Math.max(0, Math.min(seconds, duration || seconds));
    this.audio.currentTime = target;
    this.update({ time: target });
  }

  setShuffle(on: boolean): void {
    if (this.shuffle === on) return;
    const currentIndex = this.position >= 0 ? this.order[this.position] : 0;
    this.shuffle = on;
    this.order = buildOrder(this.tracks.length, on, currentIndex, Date.now());
    this.position = on ? 0 : currentIndex;
    this.update({
      shuffle: on,
      queueIndex: currentIndex,
      queueLength: this.tracks.length,
    });
    this.persist(true);
  }

  setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
    this.update({ repeat: mode });
    this.persist(true);
  }

  setSleepMinutes(minutes: number): void {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.sleepTimer = null;
    this.fadeTimer = null;
    if (!minutes || minutes <= 0) {
      this.sleepUntil = null;
      this.update({ sleepUntil: null });
      return;
    }
    const ms = minutes * 60 * 1000;
    this.sleepUntil = Date.now() + ms;
    this.update({ sleepUntil: this.sleepUntil });
    this.sleepTimer = setTimeout(() => this.fadeOutAndPause(), ms);
  }

  forceStream(): void {
    this.forceStreamOnce = true;
    this.update({ needData: null });
    this.loadCurrent(true);
  }

  clearNeedData(): void {
    this.update({ needData: null });
  }

  flush(): void {
    this.persist(true);
  }

  private update(patch: Partial<PlayerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("x-webkit-airplay", "allow");
    audio.style.position = "fixed";
    audio.style.bottom = "-10px";
    audio.style.left = "-10px";
    audio.style.width = "1px";
    audio.style.height = "1px";
    audio.style.opacity = "0";
    audio.style.pointerEvents = "none";
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (this.pendingResume > 0 && duration > 0) {
        audio.currentTime = Math.min(this.pendingResume, Math.max(0, duration - 1));
        this.pendingResume = 0;
      }
      this.update({ duration, loading: false });
      if (this.snapshot.trackId && duration > 0) {
        this.deps.onDuration?.(this.snapshot.trackId, duration);
      }
      this.updateMediaSession();
    });
    audio.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - this.lastTimeUpdateAt < 500) return;
      this.lastTimeUpdateAt = now;
      this.update({ time: audio.currentTime });
      this.updatePositionState();
      this.persist();
    });
    audio.addEventListener("play", () => this.update({ isPlaying: true }));
    audio.addEventListener("pause", () => {
      this.update({ isPlaying: false, time: audio.currentTime });
      this.updatePositionState();
    });
    audio.addEventListener("waiting", () => this.update({ loading: true }));
    audio.addEventListener("playing", () => {
      this.clearStreamFallback();
      this.pendingStream = null;
      this.update({ loading: false });
    });
    audio.addEventListener("ended", () => {
      void this.next(false);
    });
    audio.addEventListener("error", () => {
      if (this.fallbackInProgress) return;
      if (this.pendingStream) {
        void this.fallbackToBlob(this.loadToken);
        return;
      }
      this.update({
        loading: false,
        isPlaying: false,
        error: "音声を読み込めませんでした",
      });
    });
    document.body.appendChild(audio);
    this.audio = audio;
    this.setupMediaSessionActions();
    return audio;
  }

  private async safePlay(): Promise<void> {
    if (!this.audio) return;
    try {
      await this.audio.play();
    } catch (error) {
      if (this.fallbackInProgress) return;
      if (this.pendingStream && error instanceof Error && error.name !== "NotAllowedError") {
        void this.fallbackToBlob(this.loadToken);
        return;
      }
      this.update({
        loading: false,
        error:
          error instanceof Error && error.name === "NotAllowedError"
            ? "再生ボタンをもう一度押してください"
            : "再生を開始できませんでした",
      });
    }
  }

  private async loadCurrent(autoplay: boolean, orderPosition?: number): Promise<void> {
    if (orderPosition !== undefined) this.position = orderPosition;
    if (this.position < 0 || this.tracks.length === 0) {
      this.order = buildOrder(this.tracks.length, this.shuffle);
      this.position = 0;
    }
    const trackIndex = this.order[this.position];
    const track = this.tracks[trackIndex];
    if (!track) return;

    if (!track.playable) {
      this.audio?.pause();
      this.update({
        trackId: track.id,
        queueIndex: trackIndex,
        loading: false,
        isPlaying: false,
        error: "この形式（opus など）は iPhone では再生できません",
      });
      return;
    }

    const token = ++this.loadToken;
    const resumeAt = this.needsLoad ? this.pendingResume : 0;
    this.pendingResume = resumeAt;
    if (this.snapshot.trackId && this.snapshot.trackId !== track.id) {
      this.audio?.pause();
    }
    this.update({
      trackId: track.id,
      queueIndex: trackIndex,
      loading: true,
      error: null,
      needData: null,
      time: resumeAt,
      duration: track.durationSec,
      queueLength: this.tracks.length,
    });

    this.clearStreamFallback();
    this.pendingStream = null;
    this.fallbackInProgress = false;

    let url = "";
    let objectUrl: string | null = null;
    let streaming = false;
    try {
      if (this.downloadedIds.has(track.id)) {
        const cached = await getAudioBlob(track.id).catch(() => null);
        if (cached) {
          objectUrl = URL.createObjectURL(this.withAudioType(track, cached));
          url = objectUrl;
        }
      }
      if (!url) {
        if (this.deps.allowCellular() || this.forceStreamOnce) {
          const accessToken = await this.deps.getToken();
          this.accessToken = accessToken;
          const canStream =
            typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);
          if (canStream) {
            url = swMediaUrl(track.id, accessToken);
            streaming = true;
          } else {
            const raw = await fetchFileBytes(track.id, accessToken);
            this.cacheBlob(track, raw);
            objectUrl = URL.createObjectURL(this.withAudioType(track, raw));
            url = objectUrl;
          }
        } else {
          this.audio?.pause();
          if (token === this.loadToken) {
            this.update({
              loading: false,
              isPlaying: false,
              needData: { trackId: track.id, sizeBytes: track.sizeBytes },
            });
          }
          return;
        }
      }
    } catch (error) {
      if (token !== this.loadToken) return;
      this.audio?.pause();
      this.update({
        loading: false,
        isPlaying: false,
        error:
          error instanceof Error ? error.message : "音源を取得できませんでした",
      });
      return;
    }

    this.forceStreamOnce = false;
    if (token !== this.loadToken) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return;
    }

    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = objectUrl;

    const audio = this.ensureAudio();
    if (streaming) this.pendingStream = { track, token };
    const startedAt = performance.now();
    audio.addEventListener(
      "playing",
      () => {
        console.info(`[VaultMusic] audio start ${Math.round(performance.now() - startedAt)}ms`);
      },
      { once: true }
    );
    audio.src = url;
    this.needsLoad = false;
    this.update({ source: streaming ? "stream" : "blob" });
    this.updateMediaSession();
    if (streaming) {
      // play() が返らないケースでも切り替えられるよう、待つ前にタイマーを張る
      this.fallbackTimer = setTimeout(() => {
        void this.fallbackToBlob(token);
      }, 1500);
    }
    if (autoplay) void this.safePlay();
    this.persist(true);
  }

  private clearStreamFallback(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private cacheBlob(track: Track, blob: Blob): void {
    const limit = this.deps.getCacheLimit?.() ?? 1.5 * 1024 ** 3;
    void cacheAudioBlob(track.id, blob, limit)
      .then(() => {
        this.downloadedIds.add(track.id);
        this.deps.onCached?.(track.id);
      })
      .catch(() => undefined);
  }

  private withAudioType(track: Track, blob: Blob): Blob {    if (blob.type.startsWith("audio/")) return blob;
    const name = track.fileName.toLowerCase();
    const type = track.mimeType.startsWith("audio/")
      ? track.mimeType
      : /\.(m4a|aac)$/.test(name)
        ? "audio/mp4"
        : /\.(opus|ogg)$/.test(name)
          ? "audio/ogg"
          : "audio/mpeg";
    return new Blob([blob], { type });
  }

  private async fallbackToBlob(loadToken: number): Promise<void> {
    const pending = this.pendingStream;
    if (!pending || pending.token !== loadToken || loadToken !== this.loadToken) return;
    if (this.audio && !this.audio.paused && this.audio.readyState >= 2) {
      this.pendingStream = null;
      return;
    }
    if (this.fallbackInProgress) return;
    this.fallbackInProgress = true;
    this.clearStreamFallback();
    this.pendingStream = null;
    this.update({ loading: true, error: null });
    try {
      const token = await this.deps.getToken();
      const raw = await fetchFileBytes(pending.track.id, token);
      if (loadToken !== this.loadToken) return;
      this.cacheBlob(pending.track, raw);
      const blob = this.withAudioType(pending.track, raw);
      const url = URL.createObjectURL(blob);
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = url;
      const audio = this.ensureAudio();
      audio.src = url;
      this.updateMediaSession();
      await this.safePlay();
    } catch {
      if (loadToken === this.loadToken) {
        this.update({
          loading: false,
          isPlaying: false,
          error: "音源を取得できませんでした",
        });
      }
    } finally {
      this.fallbackInProgress = false;
    }
  }

  private updateMediaSession(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const track = this.getTrack();
    if (!track) return;
    const artwork = this.deps.coverUrl(track);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || "不明なアーティスト",
        album: track.album || "",
        artwork: artwork ? [{ src: artwork, sizes: "512x512", type: "image/jpeg" }] : [],
      });
    } catch {
      // MediaMetadata 非対応でも再生は続ける
    }
  }

  private updatePositionState(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const audio = this.audio;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState?.({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch {
      // 無視
    }
  }

  private setupMediaSessionActions(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void this.play()],
      ["pause", () => this.pause()],
      ["previoustrack", () => void this.prev()],
      ["nexttrack", () => void this.next(true)],
      ["stop", () => this.pause()],
      ["seekbackward", () => this.seek((this.audio?.currentTime ?? 0) - 10)],
      ["seekforward", () => this.seek((this.audio?.currentTime ?? 0) + 10)],
      ["seekto", (details) => this.seek(Number(details.seekTime ?? 0))],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // 未対応アクションは無視
      }
    }
  }

  private fadeOutAndPause(): void {
    if (!this.audio) return;
    let volume = this.audio.volume;
    this.fadeTimer = setInterval(() => {
      volume = Math.max(0, volume - 0.08);
      if (this.audio) this.audio.volume = volume;
      if (volume <= 0 && this.audio) {
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        this.audio.pause();
        this.audio.volume = 1;
        this.sleepUntil = null;
        this.update({ sleepUntil: null });
      }
    }, 200);
  }

  private persist(force = false): void {
    if (typeof window === "undefined") return;
    const now = Date.now();
    if (!force && now - this.lastPersist < 5000) return;
    this.lastPersist = now;
    const currentIndex = this.position >= 0 ? this.order[this.position] : 0;
    const state: QueueState = {
      trackIds: this.tracks.map((track) => track.id),
      index: currentIndex,
      positionSec: Math.floor(this.audio?.currentTime ?? this.snapshot.time ?? 0),
      shuffle: this.shuffle,
      repeat: this.repeat,
    };
    try {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(state));
    } catch {
      // 無視
    }
  }
}

export const player = new Player();

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __vmPlayer?: Player }).__vmPlayer = player;
}

export function describeTime(seconds: number): string {
  return formatTime(seconds);
}
