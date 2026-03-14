import React from "react";
import type { GameMode } from "../types";
import "./Welcome.css";

interface WelcomeProps {
  onStart: () => void;
  wordLength: number;
  setWordLength: (n: number) => void;
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  playerName: string;
  setPlayerName: (n: string) => void;
  availableLengths: number[];
}

export function Welcome({
  onStart,
  wordLength,
  setWordLength,
  gameMode,
  setGameMode,
  playerName,
  setPlayerName,
  availableLengths,
}: WelcomeProps) {
  const lengths = [0, ...availableLengths];
  return (
    <div className="welcome">
      <h1>Typo.it</h1>
      <div className="subtitle">Keyboard Training</div>
      <p>Type the word shown as fast as you can.</p>
      <p>Miss a letter and you lose a life — 3 lives total.</p>
      <label className="name-label">Your name:</label>
      <input
        className="name-input"
        type="text"
        maxLength={16}
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Enter name…"
      />
      <div className="mode-select">
        <label>Mode:</label>
        <button
          className={"len-btn" + (gameMode === "word" ? " active" : "")}
          onClick={() => setGameMode("word")}
        >
          Word
        </button>
        <button
          className={"len-btn" + (gameMode === "sentence" ? " active" : "")}
          onClick={() => setGameMode("sentence")}
        >
          Sentence
        </button>
      </div>
      {gameMode === "word" && (
        <div className="length-select">
          <label>Word length:</label>
          {lengths.map((n) => (
            <button
              key={n}
              className={"len-btn" + (wordLength === n ? " active" : "")}
              onClick={() => setWordLength(n)}
            >
              {n === 0 ? "Any" : n}
            </button>
          ))}
        </div>
      )}
      <button className="btn" onClick={onStart} disabled={!playerName.trim()}>
        Play
      </button>
    </div>
  );
}
