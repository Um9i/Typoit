import { useState, useCallback } from "react";
import type { GameMode, LeaderboardMap, LogEntry } from "../types";
import { computeScore, insertScore } from "../leaderboard";

const STORAGE_KEY = "typoit_lbs";

function loadBoards(): LeaderboardMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export interface UseLeaderboardResult {
  allBoards: LeaderboardMap;
  activeCategory: string;
  currentScoreId: string | null;
  leaderboard: LeaderboardMap[string];
  setActiveCategory: (k: string) => void;
  recordScore: (args: {
    log: LogEntry[];
    mode: GameMode;
    wordLength: number;
    playerName: string;
  }) => string | null;
}

export function useLeaderboard(): UseLeaderboardResult {
  const [allBoards, setAllBoards] = useState<LeaderboardMap>(loadBoards);
  const [activeCategory, setActiveCategory] = useState("word-0");
  const [currentScoreId, setCurrentScoreId] = useState<string | null>(null);

  const recordScore = useCallback<UseLeaderboardResult["recordScore"]>((args) => {
    const result = computeScore(args);
    if (!result) return null;
    const { entry, key } = result;
    setActiveCategory(key);
    setAllBoards((prev) => {
      const board = insertScore(prev[key] || [], entry);
      const updated = { ...prev, [key]: board };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setCurrentScoreId(entry.id);
    return entry.id;
  }, []);

  const leaderboard = allBoards[activeCategory] || [];

  return {
    allBoards,
    activeCategory,
    currentScoreId,
    leaderboard,
    setActiveCategory,
    recordScore,
  };
}
