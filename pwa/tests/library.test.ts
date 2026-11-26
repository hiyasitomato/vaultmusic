import { describe, expect, it } from "vitest";
import { buildLibrary, searchTracks } from "../src/lib/library";
import type { DriveAudioFile } from "../src/lib/types";

function file(
  id: string,
  name: string,
  meta: DriveAudioFile["audioMediaMetadata"] = {},
  parent = "f1"
): DriveAudioFile {
  return {
    id,
    name,
    mimeType: "audio/mpeg",
    size: "8000000",
    modifiedTime: "2026-01-01T00:00:00Z",
    parents: [parent],
    audioMediaMetadata: meta,
    thumbnailLink: undefined,
  };
}

describe("buildLibrary", () => {
  const files: DriveAudioFile[] = [
    file("1", "one.mp3", { title: "One", artist: "Artist A", album: "Album X" }),
    file("2", "two.mp3", { title: "Two", artist: "Artist A", album: "Album X" }),
    file("3", "three.mp3", { title: "Three", artist: "Artist A", album: "Only One" }),
    file("4", "Artist B - Four.mp3"),
    file("5", "five.opus", { title: "Five" }),
  ];

  const library = buildLibrary(files, [{ id: "f1", name: "Music" }], "root");

  it("keeps every file as a track", () => {
    expect(library.tracks).toHaveLength(5);
  });

  it("prefers tag metadata, then the filename", () => {
    expect(library.tracks.find((t) => t.id === "2")?.title).toBe("Two");
    expect(library.tracks.find((t) => t.id === "4")?.title).toBe("Four");
    expect(library.tracks.find((t) => t.id === "4")?.artist).toBe("Artist B");
  });

  it("only builds albums with two or more tracks", () => {
    expect(library.albums).toHaveLength(1);
    expect(library.albums[0].title).toBe("Album X");
    expect(library.albums[0].trackIds.sort()).toEqual(["1", "2"]);
  });

  it("groups folders by parent id", () => {
    expect(library.folders).toHaveLength(1);
    expect(library.folders[0].name).toBe("Music");
    expect(library.folders[0].trackIds).toHaveLength(5);
  });

  it("marks opus as not playable", () => {
    expect(library.tracks.find((t) => t.id === "5")?.playable).toBe(false);
  });

  it("searches by artist, title and filename", () => {
    expect(searchTracks(library, "artist a")).toHaveLength(3);
    expect(searchTracks(library, "four")).toHaveLength(1);
    expect(searchTracks(library, "nothing")).toHaveLength(0);
  });
});
