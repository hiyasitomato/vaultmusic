import { describe, expect, it } from "vitest";
import {
  cleanTrackTitle,
  normalizeForMatch,
  scoreArtworkCandidate,
} from "../src/lib/artwork";
import type { Track } from "../src/lib/types";

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: "1",
    folderId: "f1",
    fileName: "再会.m4a",
    title: "再会",
    artist: "Vaundy",
    album: "",
    albumArtist: "Vaundy",
    trackNo: 0,
    discNo: 0,
    durationSec: 261,
    sizeBytes: 0,
    mimeType: "audio/mp4",
    modifiedTime: "",
    playable: true,
    ...overrides,
  };
}

describe("artwork matching", () => {
  it("prefers the same title, artist and duration", () => {
    const score = scoreArtworkCandidate(track(), {
      url: "https://example.com/a.jpg",
      source: "itunes",
      title: "再会",
      artist: "Vaundy",
      duration: 260,
    });
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it("rejects a same-title song by a different artist", () => {
    const score = scoreArtworkCandidate(track(), {
      url: "https://example.com/b.jpg",
      source: "itunes",
      title: "再会",
      artist: "LiSA & Uru",
      duration: 260,
    });
    expect(score).toBeLessThan(0.6);
  });

  it("accepts a containing title when the artist matches", () => {
    const score = scoreArtworkCandidate(track({ artist: "Vaundy" }), {
      url: "https://example.com/c.jpg",
      source: "deezer",
      title: "再会 (TVアニメ「光が死んだ夏」OP)",
      artist: "Vaundy",
      duration: 260,
    });
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it("removes YouTube ids and TV-size suffixes from the query title", () => {
    expect(cleanTrackTitle("再会 [4flRaFrBqFU] (TV size)")).toBe("再会");
    expect(normalizeForMatch("Ｒｅ：再会！")).toBe("re再会");
  });
});
