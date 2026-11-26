import { describe, expect, it } from "vitest";
import { buildGenreCounts, buildGenreMap, inferGenres } from "../src/lib/genres";
import type { Library, Track, UserData } from "../src/lib/types";

function track(id: string, title: string, genre?: string): Track {
  return {
    id,
    folderId: "f1",
    fileName: `${title}.mp3`,
    title,
    artist: "",
    album: "",
    albumArtist: "",
    trackNo: 0,
    discNo: 0,
    durationSec: 0,
    sizeBytes: 0,
    mimeType: "audio/mpeg",
    modifiedTime: "",
    genre,
    playable: true,
  };
}

const library: Library = {
  tracks: [track("1", "交響曲 第9番"), track("2", "GO GHOST")],
  folders: [{ folderId: "f1", name: "クラシック", trackIds: ["1", "2"] }],
  albums: [],
  artists: [],
  folderId: "root",
  builtAt: 0,
};

const userData: UserData = {
  version: 1,
  playlists: [],
  favorites: { tracks: [], albums: [] },
  history: [],
  playCounts: {},
  customGenres: [],
  trackGenres: {},
  queue: null,
  updatedAt: 0,
};

describe("genres", () => {
  it("infers classical from the title and folder", () => {
    const genres = inferGenres(library.tracks[0], "クラシック");
    expect(genres).toContain("クラシック");
  });

  it("does not mistake GO GHOST for a soundtrack (ost substring)", () => {
    const genres = inferGenres(library.tracks[1], "");
    expect(genres).not.toContain("サウンドトラック");
  });

  it("applies manual additions and removals", () => {
    const map = buildGenreMap(library, {
      ...userData,
      trackGenres: {
        "1": { added: ["作業用"], removed: ["クラシック"] },
      },
    });
    expect(map["1"]).toContain("作業用");
    expect(map["1"]).not.toContain("クラシック");
  });

  it("counts genres", () => {
    const counts = buildGenreCounts(buildGenreMap(library, userData));
    const classical = counts.find((item) => item.name === "クラシック");
    expect(classical?.count).toBe(1);
    expect(classical?.color).toMatch(/^#/);
  });
});
