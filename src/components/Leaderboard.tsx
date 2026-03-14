import React from "react";
import type { LeaderboardEntry } from "../types";
import "./Leaderboard.css";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentId: string | null;
  categoryLabel: string;
}

export function Leaderboard({ entries, currentId, categoryLabel }: LeaderboardProps) {
  if (entries.length === 0) return null;
  return (
    <div className="leaderboard">
      <h3>Leaderboard — {categoryLabel}</h3>
      <table className="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>WPM</th>
            <th>Words</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id} className={e.id === currentId ? "highlight" : ""}>
              <td>{i + 1}</td>
              <td>{e.name}</td>
              <td>{e.wpm}</td>
              <td>{e.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
