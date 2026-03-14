export type GameMode = "word" | "sentence";
export type Screen = "welcome" | "game" | "results";

export interface LogEntry {
  word: string;
  time: number;
}

export interface FeedbackState {
  text: string;
  type: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  wpm: number;
  count: number;
  date: string;
}

export interface LeaderboardMap {
  [key: string]: LeaderboardEntry[];
}

export interface WordlistMap {
  [length: string]: string[];
}
