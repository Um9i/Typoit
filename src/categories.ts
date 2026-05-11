import type { GameMode } from "./types";
import type { SongId } from "./MusicEngine";

export function getSongForMode(mode: GameMode, wordLength: number): SongId {
  if (mode === "sentence") return "boss";
  if (wordLength >= 3 && wordLength <= 5) return "chill";
  if (wordLength >= 10 && wordLength <= 12) return "boss";
  return "default";
}

export function getLbKey(mode: GameMode, wordLength: number): string {
  return mode === "sentence" ? "sentence" : "word-" + wordLength;
}

export function getCategoryLabel(key: string): string {
  if (key === "sentence") return "Sentence Mode";
  const len = key.split("-")[1];
  return len === "0" ? "Word Mode (Any)" : "Word Mode (" + len + " letters)";
}
