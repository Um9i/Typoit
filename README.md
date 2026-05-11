# Typo.it

> **60 seconds. 3 lives. One keyboard.**
> A browser-based typing trial with a procedural chiptune soundtrack that races your pulse.

🎮 **Play it:** <https://um9i.github.io/Typoit/>

---

## The pitch

Typo.it is a typing speed game with the feel of an arcade cabinet. The clock starts the moment your fingers do; every wrong keystroke costs a life; and a self-composing chiptune ratchets up the tension while you race. When the timer hits zero your run lands on a leaderboard tuned to exactly the challenge you picked — short words, long words, or full sentences.

## How to play

1. **Enter your name** and pick a mode — **Word** or **Sentence**.
2. In Word mode, choose a **letter length** (3–9, or *Any*).
3. Hit **Play**. Type each prompt exactly as shown.
4. Wrong key? Lose a life. Run out and the game ends early.
5. Survive to the buzzer and your **WPM** is recorded on the per-category leaderboard.

## Features

- ⏱️ **60-second timed rounds** with a live HUD (lives + countdown).
- 📝 **Word & Sentence modes**, with length filtering for word mode.
- 🎵 **Procedural chiptune soundtrack** — three songs (`chill` / `default` / `boss`) chosen automatically to match difficulty, accelerating through the round and stumbling on a wrong key.
- 🏆 **Per-category leaderboards** persisted in `localStorage` — top 10 per challenge.
- ⌛ **Per-word time log** rendered live during the round and saved into the results screen.
- 🛑 **Graceful failure** — if the wordlist can't load, you see a retry banner instead of a console error.

## Run it locally

```bash
git clone https://github.com/Um9i/Typoit.git
cd Typoit
npm install --legacy-peer-deps
npm run build
python3 -m http.server
```

Open <http://localhost:8000>. The app `fetch`es `wordlist.json` from the same origin, so opening `index.html` directly via `file://` will not work.

> The `--legacy-peer-deps` flag is needed while `eslint-plugin-react` catches up to ESLint 9's peer range.

## Development

| Command            | What it does                                       |
| ------------------ | -------------------------------------------------- |
| `npm run watch`    | esbuild in watch mode — rebuilds on every save     |
| `npm run typecheck`| `tsc --noEmit`                                     |
| `npm run lint`     | ESLint over `src/`                                 |
| `npm test`         | Vitest unit tests (one shot)                       |
| `npm run test:watch` | Vitest in watch mode                             |
| `npm run build`    | Minified production bundle into `dist/`            |

Pull requests run **lint + typecheck + tests + build** via [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Merges to `main` are auto-deployed to GitHub Pages by [`deploy.yml`](.github/workflows/deploy.yml).

## Architecture (the 30-second tour)

- **React 18 + TypeScript** in strict mode, bundled by **esbuild** into a single `dist/game.js`.
- **All game logic lives in three hooks**:
  - `useGameLoop` — timers, lives, input handling, end-of-round.
  - `useLeaderboard` — score computation + `localStorage` persistence.
  - `useWordlist` — `fetch` + retry/error state.
- **Pure modules** `categories.ts` and `leaderboard.ts` hold the math; both are covered by unit tests.
- **Music engine** is a self-contained Web Audio singleton in `src/MusicEngine.ts` — zero dependencies, every note synthesized live.

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for the developer-oriented deep dive.

## Roadmap

See [`TODO.md`](TODO.md). Highlights: per-letter typing feedback, configurable round length, accuracy %, real sentence corpus, mobile/touch support.

## License

No license has been declared yet. If you'd like to use, fork, or remix this, please open an issue.
