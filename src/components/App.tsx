import React, { useState, useRef, useCallback, useEffect } from "react";
import type { GameMode, Screen, LogEntry, FeedbackState, LeaderboardEntry, LeaderboardMap, WordlistMap } from "../types";
import MusicEngine from "../MusicEngine";
import type { SongId } from "../MusicEngine";
import { HUD } from "./HUD";
import { Welcome } from "./Welcome";
import { Game } from "./Game";
import { Results } from "./Results";
import { WordLog } from "./WordLog";

const MAX_LIVES = 3;
const GAME_DURATION = 60000;

export function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [wordlist, setWordlist] = useState<WordlistMap>({});
  const [currentWord, setCurrentWord] = useState("");
  const [lives, setLives] = useState(MAX_LIVES);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ text: "", type: "" });
  const [lastTime, setLastTime] = useState("");
  const [wordTimerMs, setWordTimerMs] = useState(0);
  const [countdownMs, setCountdownMs] = useState(GAME_DURATION);
  const [exploding, setExploding] = useState(false);
  const [wordLength, setWordLength] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("word");
  const gameModeRef = useRef<GameMode>("word");
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem("typoit_name") || ""
  );
  const [allBoards, setAllBoards] = useState<LeaderboardMap>(() => {
    try { return JSON.parse(localStorage.getItem("typoit_lbs") || "{}"); } catch { return {}; }
  });
  const [currentScoreId, setCurrentScoreId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("word-0");
  const wordLengthRef = useRef(0);
  useEffect(() => { wordLengthRef.current = wordLength; }, [wordLength]);

  function getSongForMode(mode: GameMode, wl: number): SongId {
    if (mode === "sentence") return "boss";
    if (wl >= 3 && wl <= 5) return "chill";
    if (wl >= 10 && wl <= 12) return "boss";
    return "default";
  }

  function getLbKey(mode: GameMode, wl: number): string {
    return mode === "sentence" ? "sentence" : "word-" + wl;
  }
  function getCategoryLabel(key: string): string {
    if (key === "sentence") return "Sentence Mode";
    const len = key.split("-")[1];
    return len === "0" ? "Word Mode (Any)" : "Word Mode (" + len + " letters)";
  }

  const leaderboard = allBoards[activeCategory] || [];
  const [musicOn, setMusicOn] = useState(true);
  const musicStartedRef = useRef(false);

  useEffect(() => {
    if (!musicOn || musicStartedRef.current) return;
    const tryStart = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest && target.closest(".music-toggle")) return;
      if (!MusicEngine.isPlaying()) MusicEngine.start(getSongForMode(gameMode, wordLength));
      musicStartedRef.current = true;
      document.removeEventListener("click", tryStart);
      document.removeEventListener("keydown", tryStart);
    };
    document.addEventListener("click", tryStart);
    document.addEventListener("keydown", tryStart);
    return () => {
      document.removeEventListener("click", tryStart);
      document.removeEventListener("keydown", tryStart);
    };
  }, [musicOn]);

  useEffect(() => {
    const root = document.getElementById("root")!;
    if (screen === "game" || screen === "results") root.classList.add("playing");
    else root.classList.remove("playing");
  }, [screen]);

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

  const availableLengths = Object.keys(wordlist).map(Number).sort((a, b) => a - b);

  useEffect(() => {
    fetch("wordlist.json")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: WordlistMap) => setWordlist(data))
      .catch(() => alert("Could not load wordlist.json. Serve with: python3 -m http.server"));
  }, []);

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
  }, [wordlist, wordLength, gameMode, allWords]);

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

      const count = logRef.current.length;
      if (count > 0 && timerExpired) {
        const sum = logRef.current.reduce((a, e) => a + e.time, 0);
        const isSentence = gameModeRef.current === "sentence";
        const wordCount = isSentence ? count * 4 : count;
        const wpm = (wordCount / (sum / 60)).toFixed(1);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const entry: LeaderboardEntry = {
          id, name: playerName.trim() || "Anon", wpm: parseFloat(wpm), count, date: new Date().toLocaleDateString(),
        };
        const key = getLbKey(gameModeRef.current, wordLengthRef.current);
        setActiveCategory(key);
        setAllBoards((prev) => {
          const board = [...(prev[key] || []), entry].sort((a, b) => b.wpm - a.wpm).slice(0, 10);
          const updated = { ...prev, [key]: board };
          localStorage.setItem("typoit_lbs", JSON.stringify(updated));
          return updated;
        });
        setCurrentScoreId(id);
      }

      setScreen("results");
    },
    [stopWordTimer, stopGlobalTimer, playerName]
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
  }, [nextWord, stopWordTimer, stopGlobalTimer, musicOn]);

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

  return (
    <>
      <button
        className={"music-toggle" + (musicOn ? " playing" : "")}
        onClick={(e) => {
          e.stopPropagation();
          if (musicOn) { MusicEngine.stop(); setMusicOn(false); }
          else { MusicEngine.start(getSongForMode(gameMode, wordLength)); musicStartedRef.current = true; setMusicOn(true); }
        }}
        title={musicOn ? "Mute music" : "Play music"}
      >
        {musicOn ? "\u266B" : "\u266A"}
      </button>
      <HUD lives={lives} countdownMs={countdownMs} visible={screen === "game"} />
      {screen === "welcome" && (
        <Welcome
          onStart={startGame}
          wordLength={wordLength}
          setWordLength={setWordLength}
          gameMode={gameMode}
          setGameMode={setGameMode}
          playerName={playerName}
          setPlayerName={(n: string) => { setPlayerName(n); localStorage.setItem("typoit_name", n); }}
          availableLengths={availableLengths}
        />
      )}
      {screen === "game" && (
        <Game
          currentWord={currentWord}
          gameMode={gameMode}
          exploding={exploding}
          feedback={feedback}
          lastTime={lastTime}
          wordTimerMs={wordTimerMs}
          inputRef={inputRef}
          onInput={handleInput}
          onAnimationEnd={() => setExploding(false)}
          focusInput={focusInput}
        />
      )}
      {screen === "results" && (
        <Results
          log={log}
          onReplay={() => setScreen("welcome")}
          gameMode={gameMode}
          playerName={playerName}
          leaderboard={leaderboard}
          currentScoreId={currentScoreId}
          categoryLabel={getCategoryLabel(activeCategory)}
        />
      )}
      {(screen === "game" || screen === "results") && (
        <div className="log-wrap">
          <WordLog log={log} />
        </div>
      )}
    </>
  );
}
