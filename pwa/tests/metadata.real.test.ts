import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAudioMetadata } from "../src/lib/metadata";

const bytes = new Uint8Array(
  readFileSync(new URL("./fixtures/sample.mp3", import.meta.url))
);
const m4aBytes = new Uint8Array(
  readFileSync(new URL("./fixtures/sample.m4a", import.meta.url))
);

describe("parseAudioMetadata (real MPEG-4 file)", () => {
  const meta = parseAudioMetadata(m4aBytes);

  it("reads MP4 text atoms", () => {
    expect(meta.title).toBe("M4A Title");
    expect(meta.artist).toBe("M4A Artist");
    expect(meta.album).toBe("M4A Album");
    expect(meta.trackNo).toBe(4);
    expect(meta.year).toBe(2022);
    expect(meta.genre).toBe("Pop");
  });

  it("reads the MP4 cover", () => {
    expect(meta.cover?.mime).toBe("image/jpeg");
    expect(meta.cover?.bytes[0]).toBe(0xff);
  });
});


describe("parseAudioMetadata (real ID3v2.3 file)", () => {
  const meta = parseAudioMetadata(bytes);

  it("reads text tags", () => {
    expect(meta.title).toBe("Test Title");
    expect(meta.artist).toBe("Test Artist");
    expect(meta.album).toBe("Test Album");
    expect(meta.trackNo).toBe(3);
    expect(meta.year).toBe(2021);
    expect(meta.genre).toBe("Rock");
  });

  it("reads the embedded cover", () => {
    expect(meta.cover?.mime).toBe("image/jpeg");
    expect(meta.cover?.bytes[0]).toBe(0xff);
    expect(meta.cover?.bytes[1]).toBe(0xd8);
  });

  it("reports the ID3v2 tag size so the scanner can fetch the rest", () => {
    expect(meta.id3v2Size).toBeGreaterThan(10);
    expect(meta.id3v2Size).toBeLessThanOrEqual(bytes.length);
  });
});



