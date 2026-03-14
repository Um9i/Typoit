import React, { useRef, useCallback } from "react";
import type { GameMode, FeedbackState } from "../types";
import { fmtMs } from "../utils";
import "./Game.css";

interface GameProps {
  currentWord: string;
  gameMode: GameMode;
  exploding: boolean;
  feedback: FeedbackState;
  lastTime: string;
  wordTimerMs: number;
  inputRef: React.RefObject<HTMLInputElement>;
  onInput: (e: React.FormEvent<HTMLInputElement>) => void;
  onAnimationEnd: () => void;
  focusInput: () => void;
}

export function Game({
  currentWord,
  gameMode,
  exploding,
  feedback,
  lastTime,
  wordTimerMs,
  inputRef,
  onInput,
  onAnimationEnd,
  focusInput,
}: GameProps) {
  return (
    <div className="game" onClick={focusInput}>
      <h1>Typo.it</h1>
      <div
        className={
          "word-display" + (gameMode === "sentence" ? " sentence" : "")
        }
      >
        {currentWord}
      </div>
      <input
        ref={inputRef}
        className={"word-input" + (exploding ? " explode" : "")}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoFocus
        placeholder={
          gameMode === "sentence" ? "Type the sentence…" : "Type the word…"
        }
        onInput={onInput}
        onAnimationEnd={onAnimationEnd}
        onBlur={() => {
          setTimeout(focusInput, 10);
        }}
      />
      <div className="word-timer">
        {wordTimerMs > 0 ? fmtMs(wordTimerMs) : ""}
      </div>
      <div className={"feedback " + feedback.type}>{feedback.text}</div>
      <div className="time-display">{lastTime}</div>
    </div>
  );
}
