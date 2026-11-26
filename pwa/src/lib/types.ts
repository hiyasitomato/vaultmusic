export interface DriveAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  durationMillis?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

export interface DriveAudioFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  parents?: string[];
  audioMediaMetadata?: DriveAudioMetadata;
  thumbnailLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  parentId?: string;
}

export interface Track {
  id: string;
  folderId: string;
  fileName: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  trackNo: number;
  discNo: number;
  year?: number;
  durationSec: number;
  bitrate?: number;
  sizeBytes: number;
  mimeType: string;
  modifiedTime: string;
  thumbnailLink?: string;
  playable: boolean;
}

export interface FolderCollection {
  folderId: string;
  name: string;
  trackIds: string[];
}

export interface Album {
  key: string;
  title: string;
  artist: string;
  trackIds: string[];
}

export interface ArtistSummary {
  name: string;
  trackIds: string[];
}

export interface Library {
  tracks: Track[];
  folders: FolderCollection[];
  albums: Album[];
  artists: ArtistSummary[];
  folderId: string;
  builtAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface Favorites {
  tracks: string[];
  albums: string[];
}

export interface HistoryEntry {
  trackId: string;
  playedAt: number;
  completed: boolean;
}

export type RepeatMode = "off" | "all" | "one";

export interface QueueState {
  trackIds: string[];
  index: number;
  positionSec: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

export interface UserData {
  version: 1;
  playlists: Playlist[];
  favorites: Favorites;
  history: HistoryEntry[];
  playCounts: Record<string, number>;
  queue: QueueState | null;
  updatedAt: number;
}

export interface Settings {
  clientId: string;
  folderId: string;
  allowCellular: boolean;
  cacheLimitBytes: number;
}

export interface DownloadEntry {
  trackId: string;
  size: number;
  at: number;
}

export interface PlayerSnapshot {
  trackId: string | null;
  isPlaying: boolean;
  loading: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  sleepUntil: number | null;
  error: string | null;
  needData: { trackId: string; sizeBytes: number } | null;
  queueLength: number;
  queueIndex: number;
}
