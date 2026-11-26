export interface CoverImage {
  mime: string;
  bytes: Uint8Array;
}

export interface ParsedAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNo?: number;
  discNo?: number;
  year?: number;
  genre?: string;
  cover?: CoverImage;
  id3v2Size?: number;
}

function syncsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function sniffMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "image/webp";
  }
  return "image/jpeg";
}

function decodeText(body: Uint8Array): string {
  if (body.length === 0) return "";
  const encoding = body[0];
  const raw = body.slice(1);
  try {
    let text = "";
    if (encoding === 1) text = new TextDecoder("utf-16").decode(raw);
    else if (encoding === 2) text = new TextDecoder("utf-16be").decode(raw);
    else if (encoding === 3) text = new TextDecoder("utf-8").decode(raw);
    else text = new TextDecoder("latin1").decode(raw);
    return text.replace(/\u0000/g, "").replace(/\uFEFF/g, "").trim();
  } catch {
    return "";
  }
}

function parseNumber(value: string): number | undefined {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function parseYear(value: string): number | undefined {
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function parseApic(body: Uint8Array, isV22: boolean): CoverImage | null {
  if (body.length < 8) return null;
  let cursor = 1;
  if (isV22) {
    cursor += 3;
  } else {
    while (cursor < body.length && body[cursor] !== 0) cursor += 1;
    cursor += 1;
  }
  if (cursor >= body.length) return null;
  cursor += 1; // picture type
  const encoding = body[0];
  if (encoding === 1 || encoding === 2) {
    while (cursor + 1 < body.length && !(body[cursor] === 0 && body[cursor + 1] === 0)) {
      cursor += 2;
    }
    cursor += 2;
  } else {
    while (cursor < body.length && body[cursor] !== 0) cursor += 1;
    cursor += 1;
  }
  const image = body.slice(cursor);
  if (image.length < 100) return null;
  return { mime: sniffMime(image), bytes: image };
}

function parseId3v2(bytes: Uint8Array): ParsedAudioMetadata | null {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null;
  }
  const version = bytes[3];
  const flags = bytes[5];
  const total = syncsafe(bytes, 6);
  let pos = 10;
  if (flags & 0x40) {
    if (version === 4) pos += syncsafe(bytes, pos);
    else pos += 4 + readU32(bytes, pos);
  }
  const end = Math.min(bytes.length, 10 + total);
  const headerSize = version === 2 ? 6 : 10;
  const meta: ParsedAudioMetadata = { id3v2Size: 10 + total };

  while (pos + headerSize <= end) {
    const id = String.fromCharCode(
      ...bytes.slice(pos, pos + (version === 2 ? 3 : 4))
    );
    if (!id.trim() || id.charCodeAt(0) === 0) break;
    const size =
      version === 2
        ? (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5]
        : version === 4
          ? syncsafe(bytes, pos + 4)
          : readU32(bytes, pos + 4);
    if (size <= 0 || pos + headerSize + size > bytes.length) break;
    const body = bytes.slice(pos + headerSize, pos + headerSize + size);

    if (id === "TIT2" || id === "TT2") meta.title = decodeText(body);
    else if (id === "TPE1" || id === "TP1") meta.artist = decodeText(body);
    else if (id === "TALB" || id === "TAL") meta.album = decodeText(body);
    else if (id === "TPE2" || id === "TP2") meta.albumArtist = decodeText(body);
    else if (id === "TRCK" || id === "TRK") meta.trackNo = parseNumber(decodeText(body));
    else if (id === "TPOS" || id === "TPA") meta.discNo = parseNumber(decodeText(body));
    else if (id === "TDRC" || id === "TYER" || id === "TYE") {
      meta.year = parseYear(decodeText(body));
    } else if (id === "TCON" || id === "TCO") meta.genre = decodeText(body);
    else if (id === "APIC" || id === "PIC") {
      const cover = parseApic(body, id === "PIC");
      if (cover) meta.cover = cover;
    }
    pos += headerSize + size;
  }
  return meta;
}

function decodeId3v1(bytes: Uint8Array): string {
  const slice = bytes.filter((value) => value !== 0);
  const buffer = new Uint8Array(slice);
  try {
    return new TextDecoder("shift_jis").decode(buffer).trim();
  } catch {
    return new TextDecoder("latin1").decode(buffer).trim();
  }
}

function parseId3v1(tail: Uint8Array): ParsedAudioMetadata | null {
  const bytes = tail.length > 128 ? tail.slice(tail.length - 128) : tail;
  if (bytes.length < 128) return null;
  if (bytes[0] !== 0x54 || bytes[1] !== 0x41 || bytes[2] !== 0x47) return null;
  const meta: ParsedAudioMetadata = {};
  const title = decodeId3v1(bytes.slice(3, 33));
  const artist = decodeId3v1(bytes.slice(33, 63));
  const album = decodeId3v1(bytes.slice(63, 93));
  const year = decodeId3v1(bytes.slice(93, 97));
  if (title) meta.title = title;
  if (artist) meta.artist = artist;
  if (album) meta.album = album;
  if (year) meta.year = parseYear(year);
  return meta;
}

function findMp4Data(bytes: Uint8Array, marker: number[]): Uint8Array | null {
  for (let i = 0; i + 8 < bytes.length; i += 1) {
    let match = true;
    for (let k = 0; k < marker.length; k += 1) {
      if (bytes[i + k] !== marker[k]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    const atomStart = i - 4;
    if (atomStart < 0) continue;
    const atomSize = readU32(bytes, atomStart);
    if (atomSize <= 8 || atomStart + atomSize > bytes.length) continue;
    const inner = bytes.slice(i + 4, atomStart + atomSize);
    for (let j = 0; j + 4 <= inner.length; j += 1) {
      if (
        inner[j] === 0x64 &&
        inner[j + 1] === 0x61 &&
        inner[j + 2] === 0x74 &&
        inner[j + 3] === 0x61
      ) {
        const dataStart = j - 4;
        if (dataStart < 0) continue;
        const dataSize = readU32(inner, dataStart);
        if (dataSize <= 16 || dataStart + dataSize > inner.length) continue;
        return inner.slice(dataStart + 16, dataStart + dataSize);
      }
    }
  }
  return null;
}

function parseMp4(bytes: Uint8Array): ParsedAudioMetadata {
  const meta: ParsedAudioMetadata = {};
  const text = (marker: number[]): string => {
    const payload = findMp4Data(bytes, marker);
    if (!payload) return "";
    return new TextDecoder("utf-8").decode(payload).trim();
  };
  const title = text([0xa9, 0x6e, 0x61, 0x6d]);
  const artist = text([0xa9, 0x41, 0x52, 0x54]);
  const album = text([0xa9, 0x61, 0x6c, 0x62]);
  const albumArtist = text([0x61, 0x41, 0x52, 0x54]);
  const genre = text([0xa9, 0x67, 0x65, 0x6e]);
  const day = text([0xa9, 0x64, 0x61, 0x79]);
  if (title) meta.title = title;
  if (artist) meta.artist = artist;
  if (album) meta.album = album;
  if (albumArtist) meta.albumArtist = albumArtist;
  if (genre) meta.genre = genre;
  if (day) meta.year = parseYear(day);

  const trkn = findMp4Data(bytes, [0x74, 0x72, 0x6b, 0x6e]);
  if (trkn && trkn.length >= 4) meta.trackNo = (trkn[2] << 8) | trkn[3];
  const disk = findMp4Data(bytes, [0x64, 0x69, 0x73, 0x6b]);
  if (disk && disk.length >= 4) meta.discNo = (disk[2] << 8) | disk[3];

  const cover = findMp4Data(bytes, [0x63, 0x6f, 0x76, 0x72]);
  if (cover && cover.length > 100) {
    meta.cover = { mime: sniffMime(cover), bytes: cover };
  }
  return meta;
}

/** 音声ファイルの一部（先頭または末尾）からタグとカバーを取り出す。 */
export function parseAudioMetadata(bytes: Uint8Array, tail?: Uint8Array): ParsedAudioMetadata {
  const id3 = parseId3v2(bytes);
  let meta: ParsedAudioMetadata = id3 ?? {};
  if (tail) {
    const v1 = parseId3v1(tail);
    if (v1) {
      meta = {
        ...v1,
        ...meta,
        title: meta.title || v1.title,
        artist: meta.artist || v1.artist,
        album: meta.album || v1.album,
        year: meta.year || v1.year,
      };
    }
  }
  if (!meta.title && !meta.cover && !id3) {
    const mp4 = parseMp4(bytes);
    meta = { ...mp4, ...meta };
  }
  return meta;
}

/** 音声ファイルの先頭部分からアルバムアートを取り出す。 */
export async function extractCover(blob: Blob): Promise<CoverImage | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return parseAudioMetadata(bytes).cover ?? null;
}

export function coverToBlob(cover: CoverImage): Blob {
  const copy = new Uint8Array(cover.bytes);
  return new Blob([copy], { type: cover.mime });
}

/** 一覧用の小さなサムネイル（data URL）を作る。 */
export async function makeCoverThumb(cover: CoverImage, size = 192): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const blob = coverToBlob(cover);
  let source: ImageBitmap | HTMLImageElement | null = null;
  try {
    source = await createImageBitmap(blob);
  } catch {
    source = await new Promise<HTMLImageElement | null>((resolve) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      image.src = url;
    });
  }
  if (!source) return null;
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const scale = Math.max(size / width, size / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.drawImage(source, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.82);
}
