import { useEffect, useRef, useState } from "react";
import type { GameMode } from "../types";
import MusicEngine from "../MusicEngine";
import { getSongForMode, getCategoryLabel } from "../categories";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useGameLoop } from "../hooks/useGameLoop";
import { useWordlist } from "../hooks/useWordlist";
import { HUD } from "./HUD";
import { Welcome } from "./Welcome";
import { Game } from "./Game";
import { Results } from "./Results";
import { WordLog } from "./WordLog";
import { WordlistError } from "./WordlistError";

export function App() {
  const { wordlist, error: wordlistError, reload: reloadWordlist } = useWordlist();
  const [wordLength, setWordLength] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("word");
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem("typoit_name") || ""
  );
  const [musicOn, setMusicOn] = useState(true);
  const musicStartedRef = useRef(false);

  const { activeCategory, currentScoreId, leaderboard, recordScore } = useLeaderboard();

  const game = useGameLoop({
    wordlist,
    gameMode,
    wordLength,
    playerName,
    musicOn,
    recordScore,
  });

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
  }, [musicOn, gameMode, wordLength]);

  useEffect(() => {
    const root = document.getElementById("root")!;
    if (game.screen === "game" || game.screen === "results") root.classList.add("playing");
    else root.classList.remove("playing");
  }, [game.screen]);

  const availableLengths = Object.keys(wordlist).map(Number).sort((a, b) => a - b);

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
      <HUD lives={game.lives} countdownMs={game.countdownMs} visible={game.screen === "game"} />
      {game.screen === "welcome" && (
        <Welcome
          onStart={game.startGame}
          wordLength={wordLength}
          setWordLength={setWordLength}
          gameMode={gameMode}
          setGameMode={setGameMode}
          playerName={playerName}
          setPlayerName={(n: string) => { setPlayerName(n); localStorage.setItem("typoit_name", n); }}
          availableLengths={availableLengths}
        />
      )}
      {game.screen === "game" && (
        <Game
          currentWord={game.currentWord}
          gameMode={gameMode}
          exploding={game.exploding}
          feedback={game.feedback}
          lastTime={game.lastTime}
          wordTimerMs={game.wordTimerMs}
          inputRef={game.inputRef}
          onInput={game.handleInput}
          onAnimationEnd={() => game.setExploding(false)}
          focusInput={game.focusInput}
        />
      )}
      {game.screen === "results" && (
        <Results
          log={game.log}
          onReplay={() => game.setScreen("welcome")}
          gameMode={gameMode}
          playerName={playerName}
          leaderboard={leaderboard}
          currentScoreId={currentScoreId}
          categoryLabel={getCategoryLabel(activeCategory)}
        />
      )}
      {(game.screen === "game" || game.screen === "results") && (
        <div className="log-wrap">
          <WordLog log={game.log} />
        </div>
      )}
      {wordlistError && (
        <WordlistError message={wordlistError} onRetry={reloadWordlist} />
      )}
    </>
  );
}
