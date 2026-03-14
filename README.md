# Typo.it — Keyboard Training

A browser-based typing speed game. Type the displayed word (or sentence) as fast as you can before the 60-second timer runs out. One wrong keystroke costs a life — you have three.

## How to Play

1. Enter your name and choose a mode (**Word** or **Sentence**).
2. In Word mode you can also filter by word length (3–9 letters, or Any).
3. Press **Play** — type each word exactly as shown and hit the next letter to keep going.
4. A wrong key loses a life (3 total). Lose all lives and the game ends early.
5. When the timer hits zero your score is recorded to the per-category leaderboard.

## Features

- **60-second timed rounds** with a live countdown HUD.
- **Word & Sentence modes** — sentences are four random words.
- **Word-length filtering** in Word mode.
- **Procedural chiptune soundtrack** that gradually speeds up over the round.
- **Per-category leaderboards** saved in localStorage.
- **Per-word time log** shown during and after each game.
- Single self-contained `index.html` — no build step required.

## Running

Serve the project directory with any static file server, e.g.:

```
python3 -m http.server
```

Then open `http://localhost:8000` in a browser.
