import type { GameMode, LogEntry, LeaderboardEntry } from "./types";
import { getLbKey } from "./categories";

export interface ScoreInput {
  log: LogEntry[];
  mode: GameMode;
  wordLength: number;
  playerName: string;
}

export interface ScoreResult {
  entry: LeaderboardEntry;
  key: string;
}

export function computeScore({ log, mode, wordLength, playerName }: ScoreInput): ScoreResult | null {
  const count = log.length;
  if (count === 0) return null;
  const sum = log.reduce((a, e) => a + e.time, 0);
  const isSentence = mode === "sentence";
  const wordCount = isSentence ? count * 4 : count;
  const wpm = parseFloat((wordCount / (sum / 60)).toFixed(1));
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const entry: LeaderboardEntry = {
    id,
    name: playerName.trim() || "Anon",
    wpm,
    count,
    date: new Date().toLocaleDateString(),
  };
  return { entry, key: getLbKey(mode, wordLength) };
}

export function insertScore(board: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  return [...board, entry].sort((a, b) => b.wpm - a.wpm).slice(0, 10);
}
