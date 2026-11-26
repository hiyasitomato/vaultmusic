import { describe, expect, it } from "vitest";
import { extractCover } from "../src/lib/metadata";

function ascii(text: string): number[] {
  return Array.from(text).map((char) => char.charCodeAt(0));
}

function syncsafe(value: number): number[] {
  return [
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ];
}

function frame(id: string, body: number[]): number[] {
  const size = body.length;
  return [
    ...ascii(id),
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    0,
    0,
    ...body,
  ];
}

function id3WithCover(): Uint8Array {
  const jpeg = [0xff, 0xd8, 0xff, 0xe0, ...new Array(200).fill(7)];
  const apic = [0, ...ascii("image/jpeg"), 0, 3, 0, ...jpeg];
  const frames = frame("APIC", apic);
  return new Uint8Array([...ascii("ID3"), 3, 0, 0, ...syncsafe(frames.length), ...frames]);
}

describe("extractCover", () => {
  it("reads an APIC image from an ID3v2 tag", async () => {
    const bytes = id3WithCover();
    const cover = await extractCover(new Blob([bytes.buffer as ArrayBuffer]));
    expect(cover?.mime).toBe("image/jpeg");
    expect(cover?.bytes[0]).toBe(0xff);
    expect(cover?.bytes[1]).toBe(0xd8);
    expect(cover!.bytes.length).toBeGreaterThan(200);
  });

  it("returns null when there is no cover", async () => {
    const cover = await extractCover(new Blob([new Uint8Array([0, 1, 2, 3])]));
    expect(cover).toBeNull();
  });
});
