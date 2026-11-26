export interface CoverImage {
  mime: string;
  bytes: Uint8Array;
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
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  );
}

function sniffMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

function extractId3Cover(bytes: Uint8Array): CoverImage | null {
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

  while (pos + headerSize <= end) {
    const id = String.fromCharCode(...bytes.slice(pos, pos + (version === 2 ? 3 : 4)));
    const size =
      version === 2
        ? (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5]
        : version === 4
          ? syncsafe(bytes, pos + 4)
          : readU32(bytes, pos + 4);
    if (size <= 0 || pos + headerSize + size > bytes.length) break;
    const body = bytes.slice(pos + headerSize, pos + headerSize + size);

    if (id === "APIC" || id === "PIC") {
      let cursor = 1; // encoding
      if (id === "PIC") {
        cursor += 3; // image format
      } else {
        while (cursor < body.length && body[cursor] !== 0) cursor += 1;
        cursor += 1;
      }
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
      if (image.length > 100) {
        return { mime: sniffMime(image), bytes: image };
      }
    }
    pos += headerSize + size;
  }
  return null;
}

function extractMp4Cover(bytes: Uint8Array): CoverImage | null {
  const marker = [0x63, 0x6f, 0x76, 0x72]; // covr
  for (let i = 0; i + 8 < bytes.length; i += 1) {
    if (
      bytes[i] !== marker[0] ||
      bytes[i + 1] !== marker[1] ||
      bytes[i + 2] !== marker[2] ||
      bytes[i + 3] !== marker[3]
    ) {
      continue;
    }
    const atomStart = i - 4;
    if (atomStart < 0) continue;
    const atomSize = readU32(bytes, atomStart);
    if (atomSize <= 8 || atomStart + atomSize > bytes.length) continue;
    const inner = bytes.slice(atomStart + 8, atomStart + atomSize);
    for (let j = 0; j + 16 < inner.length; j += 1) {
      if (inner[j] === 0x64 && inner[j + 1] === 0x61 && inner[j + 2] === 0x74 && inner[j + 3] === 0x61) {
        const dataStart = j - 4;
        if (dataStart < 0) continue;
        const dataSize = readU32(inner, dataStart);
        if (dataSize <= 16 || dataStart + dataSize > inner.length) continue;
        const image = inner.slice(dataStart + 16, dataStart + dataSize);
        if (image.length > 100) {
          return { mime: sniffMime(image), bytes: image };
        }
      }
    }
  }
  return null;
}

/** 音声ファイルの先頭部分からアルバムアートを取り出す。 */
export async function extractCover(blob: Blob): Promise<CoverImage | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return extractId3Cover(bytes) ?? extractMp4Cover(bytes);
}

export function coverToBlob(cover: CoverImage): Blob {
  const copy = new Uint8Array(cover.bytes);
  return new Blob([copy], { type: cover.mime });
}
