import type { Settings } from "./types";

const KEY = "vaultmusic.settings.v1";
const GIB = 1024 ** 3;

export const DEFAULT_SETTINGS: Settings = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  folderId: "",
  allowCellular: false,
  cacheLimitBytes: Math.round(1.5 * GIB),
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      cacheLimitBytes:
        typeof parsed.cacheLimitBytes === "number" && parsed.cacheLimitBytes > 0
          ? parsed.cacheLimitBytes
          : DEFAULT_SETTINGS.cacheLimitBytes,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // プライベートモード等で保存できなくても動作は続ける
  }
}

export function extractFolderId(input: string): string {
  const text = input.trim();
  if (!text) return "";
  const fromUrl = text.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (fromUrl) return fromUrl[1];
  const fromQuery = text.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (fromQuery) return fromQuery[1];
  return text.replace(/\s+/g, "");
}
