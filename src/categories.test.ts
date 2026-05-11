import { describe, it, expect } from "vitest";
import { getSongForMode, getLbKey, getCategoryLabel } from "./categories";

describe("getSongForMode", () => {
  it("returns boss for sentence mode regardless of length", () => {
    expect(getSongForMode("sentence", 0)).toBe("boss");
    expect(getSongForMode("sentence", 4)).toBe("boss");
    expect(getSongForMode("sentence", 11)).toBe("boss");
  });

  it("returns chill for short words (3-5)", () => {
    expect(getSongForMode("word", 3)).toBe("chill");
    expect(getSongForMode("word", 4)).toBe("chill");
    expect(getSongForMode("word", 5)).toBe("chill");
  });

  it("returns boss for long words (10-12)", () => {
    expect(getSongForMode("word", 10)).toBe("boss");
    expect(getSongForMode("word", 11)).toBe("boss");
    expect(getSongForMode("word", 12)).toBe("boss");
  });

  it("returns default for the in-between range and Any", () => {
    expect(getSongForMode("word", 0)).toBe("default");
    expect(getSongForMode("word", 6)).toBe("default");
    expect(getSongForMode("word", 9)).toBe("default");
    expect(getSongForMode("word", 13)).toBe("default");
  });
});

describe("getLbKey", () => {
  it("uses 'sentence' for sentence mode", () => {
    expect(getLbKey("sentence", 0)).toBe("sentence");
    expect(getLbKey("sentence", 5)).toBe("sentence");
  });

  it("uses 'word-<len>' for word mode", () => {
    expect(getLbKey("word", 0)).toBe("word-0");
    expect(getLbKey("word", 7)).toBe("word-7");
  });
});

describe("getCategoryLabel", () => {
  it("labels sentence", () => {
    expect(getCategoryLabel("sentence")).toBe("Sentence Mode");
  });

  it("labels Any (length 0)", () => {
    expect(getCategoryLabel("word-0")).toBe("Word Mode (Any)");
  });

  it("labels specific lengths", () => {
    expect(getCategoryLabel("word-5")).toBe("Word Mode (5 letters)");
    expect(getCategoryLabel("word-12")).toBe("Word Mode (12 letters)");
  });
});
