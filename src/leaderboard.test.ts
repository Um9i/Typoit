import { describe, it, expect } from "vitest";
import { computeScore, insertScore } from "./leaderboard";
import type { LeaderboardEntry, LogEntry } from "./types";

describe("computeScore", () => {
  it("returns null for empty log", () => {
    expect(
      computeScore({ log: [], mode: "word", wordLength: 0, playerName: "x" })
    ).toBeNull();
  });

  it("computes WPM for word mode (count words / minutes)", () => {
    // 6 words in 60 seconds → 6 wpm
    const log: LogEntry[] = Array.from({ length: 6 }, () => ({
      word: "abc",
      time: 10,
    }));
    const r = computeScore({ log, mode: "word", wordLength: 3, playerName: "Rob" });
    expect(r).not.toBeNull();
    expect(r!.entry.wpm).toBe(6);
    expect(r!.entry.count).toBe(6);
    expect(r!.entry.name).toBe("Rob");
    expect(r!.key).toBe("word-3");
  });

  it("multiplies count by 4 in sentence mode", () => {
    const log: LogEntry[] = Array.from({ length: 3 }, () => ({ word: "a b c d", time: 10 }));
    // 3 sentences * 4 = 12 words in 30s → 24 wpm
    const r = computeScore({ log, mode: "sentence", wordLength: 0, playerName: "x" })!;
    expect(r.entry.wpm).toBe(24);
    expect(r.key).toBe("sentence");
  });

  it("falls back to 'Anon' for blank names", () => {
    const log: LogEntry[] = [{ word: "a", time: 1 }];
    const r = computeScore({ log, mode: "word", wordLength: 0, playerName: "   " })!;
    expect(r.entry.name).toBe("Anon");
  });

  it("uses word-<length> key including 0", () => {
    const log: LogEntry[] = [{ word: "a", time: 1 }];
    expect(computeScore({ log, mode: "word", wordLength: 0, playerName: "x" })!.key).toBe("word-0");
    expect(computeScore({ log, mode: "word", wordLength: 7, playerName: "x" })!.key).toBe("word-7");
  });
});

describe("insertScore", () => {
  const mk = (id: string, wpm: number): LeaderboardEntry => ({
    id, name: id, wpm, count: 1, date: "x",
  });

  it("sorts by wpm descending", () => {
    const out = insertScore([mk("a", 50), mk("b", 70)], mk("c", 60));
    expect(out.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("truncates to top 10", () => {
    const board = Array.from({ length: 10 }, (_, i) => mk("e" + i, 100 - i));
    const out = insertScore(board, mk("new", 1));
    expect(out).toHaveLength(10);
    expect(out.find((e) => e.id === "new")).toBeUndefined();
  });

  it("keeps a high new score and drops the lowest", () => {
    const board = Array.from({ length: 10 }, (_, i) => mk("e" + i, 100 - i));
    const out = insertScore(board, mk("top", 999));
    expect(out[0].id).toBe("top");
    expect(out).toHaveLength(10);
    expect(out.find((e) => e.id === "e9")).toBeUndefined();
  });
});
