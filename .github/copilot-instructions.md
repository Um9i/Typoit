# Copilot Instructions — Typo.it

A single-page typing-speed game. React 18 + TypeScript, bundled by esbuild into a static site deployed to GitHub Pages.

> Read this once before touching the code. It encodes architectural choices that the codebase actively relies on — straying from them tends to break things subtly.

## Stack at a glance

| Concern        | Choice                                                    |
| -------------- | --------------------------------------------------------- |
| UI             | React 18 (`react-jsx` runtime)                            |
| Language       | TypeScript, `strict: true`, target ES2020                 |
| Bundler        | esbuild (`src/game.tsx` → `dist/game.{js,css}`)           |
| State          | Local React state + custom hooks. **No Redux/Zustand/Context.** |
| Audio          | Web Audio API singleton (`src/MusicEngine.ts`)            |
| Tests          | Vitest, Node environment, files: `src/**/*.test.ts`       |
| Lint           | ESLint 9 flat config (`@typescript-eslint`, `react`, `react-hooks`) |
| CI             | `.github/workflows/ci.yml` — lint + typecheck + test + build |
| Deploy         | `.github/workflows/deploy.yml` — GitHub Pages on push to `main` |

## Commands

```bash
npm run watch        # esbuild watch (dev loop)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm test             # vitest run
npm run test:watch   # vitest interactive
npm run build        # minified production bundle
```

Serve locally with any static server from the repo root (e.g. `python3 -m http.server`) and open <http://localhost:8000>. The app `fetch`es `wordlist.json`; `file://` will not work.

**Always run** `npm run typecheck && npm run lint && npm test` after non-trivial changes. The CI workflow gates merges on the same four commands plus `build`.

## Project layout

```
index.html                  loads dist/game.css + dist/game.js, mounts #root
wordlist.json               { "3": [...], "4": [...] }, words grouped by length
wordlist.txt                source list (newline-delimited); JSON is what ships
eslint.config.js            flat config, ignores dist/ + node_modules/
vitest.config.ts            node env, *.test.ts(x) in src/

src/
  game.tsx                  entry — createRoot + <App /> + imports global.css
  MusicEngine.ts            Web Audio singleton (default export, exports SongId)
  types.ts                  shared TS types (GameMode, Screen, LogEntry, ...)
  utils.ts                  fmtMs formatter
  categories.ts             pure: getSongForMode, getLbKey, getCategoryLabel
  leaderboard.ts            pure: computeScore, insertScore
  styles/global.css         global resets + body/#root styling

  hooks/
    useGameLoop.ts          timers, lives, log, input handling, end-of-round
    useLeaderboard.ts       allBoards + activeCategory + recordScore (localStorage)
    useWordlist.ts          fetch + error/retry state

  components/
    App.tsx                 thin orchestrator — wires hooks to UI
    Welcome.tsx             start screen (name, mode, word length)
    Game.tsx                playfield (current word, input, feedback, timer)
    HUD.tsx                 lives + countdown
    Results.tsx             end-of-round summary + leaderboard
    Leaderboard.tsx         leaderboard rendering (used inside Results)
    WordLog.tsx             per-word time log
    WordlistError.tsx       retry banner for failed wordlist fetch
    *.css                   co-located component styles

dist/                       build output — gitignored; rebuilt locally + in CI
.github/workflows/
  ci.yml                    lint + typecheck + test + build on PR/push
  deploy.yml                builds and publishes to GitHub Pages on push to main
```

## Conventions

### State & hooks

- **Logic lives in hooks under `src/hooks/`.** `App.tsx` is a thin orchestrator that wires hooks together and renders screens. Resist adding new business logic to `App.tsx` — extend an existing hook or create a new one.
- **Refs mirror state inside long-lived closures.** `useGameLoop` deliberately keeps `livesRef`, `logRef`, `currentWordRef`, etc. in sync via `useEffect` because timer callbacks and event listeners capture stale closures otherwise. **Follow the same pattern** for any new state read from inside `setInterval`, `setTimeout`, or DOM listeners.
- **Children are presentational.** They receive props and callbacks; they don't reach for `localStorage` or start timers.

### Pure modules

- `categories.ts` and `leaderboard.ts` are intentionally side-effect-free and **fully covered by unit tests**. When changing scoring or song selection, update the tests in the same commit. Prefer adding pure helpers here over inlining logic into a hook.

### Types

- **Strict TS, no `any`.** When interop with browser APIs forces a cast (e.g. `webkitAudioContext`), narrow the cast as tightly as possible — see `MusicEngine.ts` for the pattern.
- Shared types live in `src/types.ts`. Reuse them.

### Styling

- **CSS is co-located.** `Foo.tsx` imports `./Foo.css`. esbuild bundles every imported CSS file into a single `dist/game.css`. Global resets live in `src/styles/global.css`.
- Don't introduce CSS-in-JS or a styling library.

### Constants & magic numbers

- `MAX_LIVES = 3` and `GAME_DURATION = 60000` live at the top of `src/hooks/useGameLoop.ts` and are **re-exported**. Reuse them; don't sprinkle literals.

### Leaderboard

- Keys: `"sentence"` or `"word-<length>"` (`0` = *Any*).
- Storage: `localStorage["typoit_lbs"]` (board map), `localStorage["typoit_name"]` (last player name).
- Boards are top-10 by WPM. **Sentence mode multiplies word count by 4** when computing WPM — see `computeScore` and its tests.

### Music

- `getSongForMode(mode, wordLength)` in `categories.ts` is the single source of truth: `sentence` → `boss`, length 3–5 → `chill`, length 10–12 → `boss`, else `default`.
- Adding a new song? Extend the `SongId` union in `MusicEngine.ts`, add its section data inside the engine, update `getSongForMode`, and add cases to `categories.test.ts`.

### Timing

- Use `performance.now()` for monotonic timing. Intervals tick at ~47 ms — fast enough to feel live, slow enough to keep CPU low. Don't switch to `Date.now()`.

### Comments

- Comment intent, not mechanism. The code is small; let it speak for itself unless something is genuinely surprising.

## Build & deploy

- `dist/` is **not** committed. Run `npm run build` before serving locally; CI rebuilds before deploy.
- `wordlist.json` is fetched at runtime and must be served at the site root. The deploy workflow copies `index.html`, `wordlist.json`, and `dist/` into `_site/`.
- `npm ci` uses `--legacy-peer-deps` until `eslint-plugin-react` declares ESLint 9 in its peer range. The CI and deploy workflows pass this flag explicitly; mirror it locally.

## Feature workflow

1. **Types** — extend `src/types.ts` if needed.
2. **Logic** — add or extend a hook in `src/hooks/`, or a pure module if the logic is side-effect-free.
3. **UI** — add/update a presentational component with a co-located `.css`.
4. **Wire** — connect through `App.tsx` (props only).
5. **Test** — add unit tests for any new pure logic; update existing tests if behavior changed.
6. **Verify** — `npm run lint && npm run typecheck && npm test && npm run build`.
7. **Smoke test** — serve locally and walk welcome → game (both modes) → results, including the wrong-key and timer-expiry paths and the music toggle.

## What *not* to do

- Don't add a state-management library, router, or CSS framework. The game is small; keep it that way.
- Don't reintroduce `alert()` / `confirm()` / `prompt()` — surface errors in-app (see `WordlistError`).
- Don't commit `dist/`.
- Don't use `any`. If you truly need it, leave a comment explaining why and consider whether the type can be narrowed via a `Window & {...}` intersection or a `unknown` + type guard.
- Don't move logic *out of* hooks and back into `App.tsx`.
