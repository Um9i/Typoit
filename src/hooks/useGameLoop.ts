import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  FeedbackState,
  GameMode,
  LogEntry,
  Screen,
  WordlistMap,
} from "../types";
import MusicEngine from "../MusicEngine";
import { getSongForMode } from "../categories";

interface UseGameLoopArgs {
  wordlist: WordlistMap;
  gameMode: GameMode;
  wordLength: number;
  playerName: string;
  musicOn: boolean;
  recordScore: (args: {
    log: LogEntry[];
    mode: GameMode;
    wordLength: number;
    playerName: string;
  }) => string | null;
}

export interface UseGameLoopResult {
  screen: Screen;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  currentWord: string;
  lives: number;
  log: LogEntry[];
  feedback: FeedbackState;
  lastTime: string;
  wordTimerMs: number;
  countdownMs: number;
  exploding: boolean;
  setExploding: React.Dispatch<React.SetStateAction<boolean>>;
  inputRef: React.RefObject<HTMLInputElement>;
  startGame: () => void;
  handleInput: (e: React.FormEvent<HTMLInputElement>) => void;
  focusInput: () => void;
}

export const MAX_LIVES = 3;
export const GAME_DURATION = 60000;

export function useGameLoop(args: UseGameLoopArgs): UseGameLoopResult {
  const { wordlist, gameMode, wordLength, playerName, musicOn, recordScore } = args;

  const [screen, setScreen] = useState<Screen>("welcome");
  const [currentWord, setCurrentWord] = useState("");
  const [lives, setLives] = useState(MAX_LIVES);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ text: "", type: "" });
  const [lastTime, setLastTime] = useState("");
  const [wordTimerMs, setWordTimerMs] = useState(0);
  const [countdownMs, setCountdownMs] = useState(GAME_DURATION);
  const [exploding, setExploding] = useState(false);

  const gameModeRef = useRef<GameMode>(gameMode);
  const wordLengthRef = useRef(wordLength);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { wordLengthRef.current = wordLength; }, [wordLength]);

  const inputRef = useRef<HTMLInputElement>(null);
  const wordStartRef = useRef(0);
  const timerStartRef = useRef(0);
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRunningRef = useRef(false);
  const globalTimerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStartTimeRef = useRef(0);
  const gameEndedRef = useRef(false);
  const lockedRef = useRef(false);
  const livesRef = useRef(MAX_LIVES);
  const logRef = useRef<LogEntry[]>([]);
  const currentWordRef = useRef("");

  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { logRef.current = log; }, [log]);
  useEffect(() => { currentWordRef.current = currentWord; }, [currentWord]);

  const allWords = useCallback((): string[] => {
    return Object.values(wordlist).flat();
  }, [wordlist]);

  const pickWord = useCallback((): string => {
    const all = allWords();
    if (all.length === 0) return "";
    const pick = (pool: string[]) => pool[Math.floor(Math.random() * pool.length)];
    if (gameModeRef.current === "sentence") {
      const words: string[] = [];
      for (let i = 0; i < 4; i++) words.push(pick(all));
      return words.join(" ");
    }
    const pool = wordLength > 0 ? wordlist[String(wordLength)] || [] : all;
    if (pool.length === 0) return pick(all);
    return pick(pool);
  }, [wordlist, wordLength, allWords]);

  const stopWordTimer = useCallback(() => {
    timerRunningRef.current = false;
    if (timerIdRef.current) { clearInterval(timerIdRef.current); timerIdRef.current = null; }
  }, []);

  const resetWordTimer = useCallback(() => {
    stopWordTimer();
    setWordTimerMs(0);
  }, [stopWordTimer]);

  const startPerWordTimer = useCallback(() => {
    timerStartRef.current = performance.now();
    wordStartRef.current = performance.now();
    timerRunningRef.current = true;
    timerIdRef.current = setInterval(() => {
      setWordTimerMs(Math.floor(performance.now() - timerStartRef.current));
    }, 47);
  }, []);

  const stopGlobalTimer = useCallback(() => {
    if (globalTimerIdRef.current) { clearInterval(globalTimerIdRef.current); globalTimerIdRef.current = null; }
  }, []);

  const focusInput = useCallback(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const nextWord = useCallback(() => {
    const w = pickWord();
    setCurrentWord(w);
    currentWordRef.current = w;
    setFeedback({ text: "", type: "" });
    setLastTime("");
    setExploding(false);
    lockedRef.current = false;
    resetWordTimer();
    setTimeout(() => {
      if (inputRef.current) { inputRef.current.value = ""; inputRef.current.focus(); }
    }, 10);
  }, [pickWord, resetWordTimer]);

  const endGame = useCallback(
    (timerExpired: boolean) => {
      stopWordTimer();
      stopGlobalTimer();
      gameEndedRef.current = true;
      MusicEngine.stop();

      if (timerExpired) {
        recordScore({
          log: logRef.current,
          mode: gameModeRef.current,
          wordLength: wordLengthRef.current,
          playerName,
        });
      }

      setScreen("results");
    },
    [stopWordTimer, stopGlobalTimer, playerName, recordScore]
  );

  const endGameRef = useRef(endGame);
  useEffect(() => { endGameRef.current = endGame; }, [endGame]);

  const startGame = useCallback(() => {
    setLives(MAX_LIVES); livesRef.current = MAX_LIVES;
    setLog([]); logRef.current = [];
    setCountdownMs(GAME_DURATION);
    gameEndedRef.current = false;
    gameStartTimeRef.current = performance.now();
    globalTimerIdRef.current = setInterval(() => {
      const remaining = GAME_DURATION - Math.floor(performance.now() - gameStartTimeRef.current);
      if (remaining <= 0) {
        setCountdownMs(0);
        setTimeout(() => { if (!gameEndedRef.current) endGameRef.current(true); }, 0);
      } else {
        setCountdownMs(remaining);
      }
    }, 47);
    setScreen("game");
    const song = getSongForMode(gameMode, wordLength);
    if (musicOn) { MusicEngine.stop(); MusicEngine.start(song); }
    setTimeout(() => nextWord(), 0);
  }, [nextWord, gameMode, wordLength, musicOn]);

  const handleCorrect = useCallback(
    (elapsed: number) => {
      const entry: LogEntry = { word: currentWordRef.current, time: elapsed };
      const newLog = [...logRef.current, entry];
      setLog(newLog); logRef.current = newLog;
      setFeedback({ text: "Correct!", type: "correct" });
      setLastTime("Time: " + elapsed.toFixed(2) + "s");
      resetWordTimer();
      lockedRef.current = true;
      setTimeout(() => nextWord(), 900);
    },
    [nextWord, resetWordTimer]
  );

  const handleWrongKey = useCallback(() => {
    setExploding(true);
    MusicEngine.slowDown();
    const newLives = livesRef.current - 1;
    setLives(newLives); livesRef.current = newLives;
    lockedRef.current = true;
    if (newLives <= 0) {
      setFeedback({ text: "No lives left!", type: "incorrect" });
      setTimeout(() => endGame(false), 1000);
      return;
    }
    setFeedback({ text: "Wrong key! Lost a life.", type: "incorrect" });
    setTimeout(() => nextWord(), 1000);
  }, [endGame, nextWord]);

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const typed = (e.target as HTMLInputElement).value;
      if (typed === "" || lockedRef.current) return;
      if (!timerRunningRef.current) startPerWordTimer();
      const word = currentWordRef.current;
      if (typed === word) {
        const elapsed = (performance.now() - wordStartRef.current) / 1000;
        handleCorrect(elapsed);
        return;
      }
      if (typed !== word.substring(0, typed.length)) handleWrongKey();
    },
    [startPerWordTimer, handleCorrect, handleWrongKey]
  );

  return {
    screen,
    setScreen,
    currentWord,
    lives,
    log,
    feedback,
    lastTime,
    wordTimerMs,
    countdownMs,
    exploding,
    setExploding,
    inputRef,
    startGame,
    handleInput,
    focusInput,
  };
}
