import { describe, expect, it } from "vitest";
import { extractYouTubeId, parseName } from "../src/lib/parseName";
import { normalizeText } from "../src/lib/format";

describe("parseName", () => {
  it("strips a leading track number", () => {
    expect(parseName("01. Title.mp3")).toEqual({ title: "Title", artist: "", trackNo: 1 });
    expect(parseName("12 - Title.mp3")).toEqual({ title: "Title", artist: "", trackNo: 12 });
  });

  it("splits 'Artist - Title' by default", () => {
    expect(parseName("Artist - Title.mp3")).toEqual({
      title: "Title",
      artist: "Artist",
      trackNo: 0,
    });
  });

  it("uses known artists to decide the order when the artist is on the right", () => {
    const known = new Set([normalizeText("Artist")]);
    expect(parseName("Title - Artist.mp3", known)).toEqual({
      title: "Title",
      artist: "Artist",
      trackNo: 0,
    });
  });

  it("handles number + artist + title", () => {
    expect(parseName("03 - Artist - Title.mp3")).toEqual({
      title: "Title",
      artist: "Artist",
      trackNo: 3,
    });
  });

  it("reads a bracketed artist", () => {
    expect(parseName("[Artist] Title.mp3")).toEqual({
      title: "Title",
      artist: "Artist",
      trackNo: 0,
    });
  });

  it("keeps an unsplittable name as the title", () => {
    expect(parseName("NoSeparator.mp3")).toEqual({
      title: "NoSeparator",
      artist: "",
      trackNo: 0,
    });
  });

  it("turns underscores into spaces", () => {
    expect(parseName("Some_Title.mp3").title).toBe("Some Title");
  });

  it("extracts and removes a YouTube video id", () => {
    expect(extractYouTubeId("GO GHOST [gT5XyAtc-Z8].mp3")).toBe("gT5XyAtc-Z8");
    expect(parseName("GO GHOST [gT5XyAtc-Z8].mp3").title).toBe("GO GHOST");
    expect(parseName("Artist - Song [gT5XyAtc-Z8].mp3")).toEqual({
      title: "Song",
      artist: "Artist",
      trackNo: 0,
    });
  });
});
