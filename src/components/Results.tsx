import React from "react";
import type { LogEntry, GameMode, LeaderboardEntry } from "../types";
import { Leaderboard } from "./Leaderboard";
import "./Results.css";
import "./Results.css";

interface ResultsProps {
  log: LogEntry[];
  onReplay: () => void;
  gameMode: GameMode;
  playerName: string;
  leaderboard: LeaderboardEntry[];
  currentScoreId: string | null;
  categoryLabel: string;
}

export function Results({
  log,
  onReplay,
  gameMode,
  leaderboard,
  currentScoreId,
  categoryLabel,
}: ResultsProps) {
  const count = log.length;
  const isSentence = gameMode === "sentence";
  let avgTimeStr = "N/A",
    wpmStr = "N/A";
  if (count > 0) {
    const sum = log.reduce((a, e) => a + e.time, 0);
    avgTimeStr = (sum / count).toFixed(2);
    const wordCount = isSentence ? count * 4 : count;
    wpmStr = (wordCount / (sum / 60)).toFixed(1);
  }
  const label = isSentence ? "Sentences" : "Words";
  return (
    <div className="results">
      <h2>Game Over</h2>
      <p className="stat">
        {label} typed correctly: <span>{count}</span>
      </p>
      <p className="stat">
        Average time per {isSentence ? "sentence" : "word"}:{" "}
        <span>{avgTimeStr}s</span>
      </p>
      <p className="stat">
        Words per minute: <span>{wpmStr}</span>
      </p>
      <button className="btn" onClick={onReplay}>
        Play Again
      </button>
      <Leaderboard
        entries={leaderboard}
        currentId={currentScoreId}
        categoryLabel={categoryLabel}
      />
    </div>
  );
}
