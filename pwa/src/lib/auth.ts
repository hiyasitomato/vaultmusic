const GIS_SRC = "https://accounts.google.com/gsi/client";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export class AuthError extends Error {
  code: "AUTH_REQUIRED" | "AUTH_FAILED";
  constructor(code: "AUTH_REQUIRED" | "AUTH_FAILED", message: string) {
    super(message);
    this.code = code;
  }
}

const TOKEN_STORAGE_KEY = "vaultmusic.token.v1";

let gisPromise: Promise<void> | null = null;

interface CachedToken {
  token: string;
  expiresAt: number;
  clientId: string;
}

function loadStoredToken(): CachedToken | null {
  try {
    const raw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedToken;
    if (parsed.expiresAt > Date.now() + 60_000) return parsed;
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // 無視
  }
  return null;
}

function storeToken(token: CachedToken): void {
  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch {
    // 無視
  }
}

let cached: CachedToken | null =
  typeof window !== "undefined" ? loadStoredToken() : null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new AuthError("AUTH_FAILED", "ブラウザで開いてください"));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new AuthError("AUTH_FAILED", "Google の認証スクリプトを読み込めませんでした"));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export async function requestToken(
  clientId: string,
  silent = false
): Promise<{ token: string; expiresAt: number }> {
  if (!clientId.trim()) {
    throw new AuthError("AUTH_REQUIRED", "クライアント ID が未設定です");
  }
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new AuthError("AUTH_FAILED", "Google 認証を初期化できませんでした");

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (error: AuthError) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(error);
    };
    timer = setTimeout(() => {
      finish(
        new AuthError(
          "AUTH_FAILED",
          "ログインが完了しませんでした。ポップアップがブロックされていないか確認して、もう一度お試しください。"
        )
      );
    }, 60000);

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (settled) return;
        if (response.access_token) {
          const expiresAt = Date.now() + Math.max(60, Number(response.expires_in ?? 3600) - 30) * 1000;
          cached = { token: response.access_token, expiresAt, clientId };
          storeToken(cached);
          settled = true;
          if (timer) clearTimeout(timer);
          resolve({ token: response.access_token, expiresAt });
          return;
        }
        finish(new AuthError("AUTH_FAILED", response.error_description || "ログインに失敗しました"));
      },
      error_callback: (error) => {
        const message =
          error?.type === "popup_closed"
            ? "ログイン画面が閉じられました"
            : error?.message || "ログインに失敗しました";
        finish(new AuthError(silent ? "AUTH_REQUIRED" : "AUTH_FAILED", message));
      },
    });

    try {
      client.requestAccessToken({ prompt: silent ? "none" : "" });
    } catch (error) {
      finish(
        new AuthError(
          "AUTH_FAILED",
          error instanceof Error ? error.message : "ログインを開始できませんでした"
        )
      );
    }
  });
}

export async function getValidToken(clientId: string): Promise<string> {
  if (cached && cached.clientId === clientId && cached.expiresAt - Date.now() > 5 * 60 * 1000) {
    return cached.token;
  }
  const refreshed = await requestToken(clientId, true);
  return refreshed.token;
}

export function peekToken(): string | null {
  if (cached && cached.expiresAt > Date.now() + 60 * 1000) return cached.token;
  return null;
}

export function forgetToken(): void {
  cached = null;
  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // 無視
  }
}

export function revokeToken(): void {
  if (cached && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(cached.token, () => undefined);
  }
  forgetToken();
}
