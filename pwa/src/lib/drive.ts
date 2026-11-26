import type { DriveAudioFile, DriveFolder } from "./types";

const API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";const AUDIO_EXT = /\.(mp3|m4a|aac|opus|flac|wav|ogg)$/i;
const FILE_FIELDS =
  "id,name,mimeType,size,modifiedTime,createdTime,parents,audioMediaMetadata,thumbnailLink";

export class DriveError extends Error {
  status: number;
  code: "AUTH_EXPIRED" | "DRIVE_ERROR";
  constructor(code: "AUTH_EXPIRED" | "DRIVE_ERROR", status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function driveFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(30000)
      : undefined;
  const response = await fetch(url, { ...init, headers, signal });
  if (response.status === 401) {
    throw new DriveError("AUTH_EXPIRED", 401, "Google のログインが切れました");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      detail = "";
    }
    throw new DriveError(
      "DRIVE_ERROR",
      response.status,
      detail || `Drive API エラー (${response.status})`
    );
  }
  return response;
}

function isAudio(file: DriveAudioFile): boolean {
  return file.mimeType.startsWith("audio/") || AUDIO_EXT.test(file.name);
}

export async function listFolderChildren(
  folderId: string,
  token: string
): Promise<DriveAudioFile[]> {
  const out: DriveAudioFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await driveFetch(`${API}/files?${params.toString()}`, token);
    const body = (await response.json()) as {
      nextPageToken?: string;
      files?: DriveAudioFile[];
    };
    out.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return out;
}

export async function listMusicFolder(
  folderId: string,
  token: string
): Promise<{ files: DriveAudioFile[]; folders: DriveFolder[] }> {
  const files: DriveAudioFile[] = [];
  const folders: DriveFolder[] = [];
  const queue: { id: string; parentId?: string }[] = [{ id: folderId }];
  const seen = new Set<string>();

  const metaResponse = await driveFetch(
    `${API}/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
    token
  );
  const meta = (await metaResponse.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
  };
  if (meta.mimeType && meta.mimeType !== FOLDER_MIME) {
    throw new DriveError(
      "DRIVE_ERROR",
      400,
      "指定した URL はフォルダではありません。音楽フォルダの URL を貼り付けてください。"
    );
  }
  folders.push({ id: folderId, name: meta.name ?? "音楽" });

  while (queue.length > 0 && seen.size < 2000) {
    const current = queue.shift();
    if (!current || seen.has(current.id)) continue;
    seen.add(current.id);

    const children = await listFolderChildren(current.id, token);
    for (const child of children) {
      if (child.mimeType === FOLDER_MIME) {
        folders.push({ id: child.id, name: child.name, parentId: current.id });
        queue.push({ id: child.id, parentId: current.id });
      } else if (isAudio(child)) {
        files.push(child);
      }
    }
  }

  return { files, folders };
}

export async function findFolderByName(
  name: string,
  token: string
): Promise<{ id: string; name: string } | null> {
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `name = '${escaped}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id,name,parents)",
    pageSize: "20",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const response = await driveFetch(`${API}/files?${params.toString()}`, token);
  const body = (await response.json()) as { files?: { id: string; name: string }[] };
  const first = body.files?.[0];
  return first ? { id: first.id, name: first.name } : null;
}

export function mediaUrl(fileId: string, token: string): string {
  return `${API}/files/${encodeURIComponent(fileId)}?alt=media&access_token=${encodeURIComponent(
    token
  )}`;
}

export async function fetchFileBytes(
  fileId: string,
  token: string,
  range?: string
): Promise<Blob> {
  const headers: HeadersInit = range ? { Range: range } : {};
  const response = await driveFetch(
    `${API}/files/${encodeURIComponent(fileId)}?alt=media`,
    token,
    { headers }
  );
  return response.blob();
}
