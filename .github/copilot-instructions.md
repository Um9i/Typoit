# Copilot Instructions — Typoit

A browser-based typing speed game. Single-page React + TypeScript app bundled with esbuild, deployed as a static site to GitHub Pages.

## Tech stack

- **React 18** with `react-jsx` runtime (no React imports needed for JSX, but existing files import it explicitly — keep that style consistent within a file).
- **TypeScript** in `strict` mode, target ES2020, `moduleResolution: bundler`. Source root is `src/`.
- **esbuild** bundles `src/game.tsx` → `dist/game.js` (and bundles imported CSS → `dist/game.css`).
- **No framework router, no state library** — state is plain `useState`/`useRef` in `src/components/App.tsx`.
- **Web Audio API** drives the procedural chiptune (`src/MusicEngine.ts`, ~870 lines, no dependencies).
- **No tests**. There is no test runner configured — do not add one unless explicitly asked.
- **No linter/formatter** is configured.

## Commands

- `npm run build` — production bundle.
- `npm run watch` — esbuild watch mode while developing.
- `npm run typecheck` — `tsc --noEmit`. **Always run this after TS changes.**
- Serve locally with any static server from the repo root, e.g. `python3 -m http.server`, then open `http://localhost:8000`. The app `fetch`es `wordlist.json` from the same origin, so opening `index.html` via `file://` will not work.

## Project layout

```
index.html              loads dist/game.css + dist/game.js, mounts #root
wordlist.json           { "3": [...], "4": [...], ... } grouped by length
wordlist.txt            source list (newline-delimited); JSON is what ships
src/
  game.tsx              entry — createRoot + <App /> + imports global.css
  MusicEngine.ts        IIFE singleton, default export, exports SongId type
  types.ts              shared TS types (GameMode, Screen, LogEntry, etc.)
  utils.ts              fmtMs formatter
  styles/global.css     global resets + body/root styling
  components/
    App.tsx             all game state + screen routing (welcome|game|results)
    Welcome.tsx         start screen (name, mode, word length)
    Game.tsx            playfield (current word, input, feedback, per-word timer)
    HUD.tsx             lives + countdown
    Results.tsx         end-of-round summary + leaderboard
    Leaderboard.tsx     leaderboard rendering (used inside Results)
    WordLog.tsx         per-word time log
    *.css               co-located component styles, imported by the .tsx
dist/                   build output (committed; also rebuilt in CI)
.github/workflows/      deploy.yml — builds and publishes to GitHub Pages on push to main
```

## Conventions

- **All game state lives in `App.tsx`.** Children are presentational and receive callbacks/props. Don't introduce context or stores unless the prop drilling becomes truly painful.
- **Refs mirror state for closures.** Many handlers (timers, key handlers) capture stale state, so the code keeps `xxxRef.current` in sync via `useEffect`. Follow this pattern when adding new state read from inside intervals/listeners.
- **CSS is co-located with components** (`Welcome.tsx` ↔ `Welcome.css`) and imported from the `.tsx` file. Global styles go in `src/styles/global.css`. esbuild bundles all CSS imports into `dist/game.css`.
- **Constants** like `MAX_LIVES = 3` and `GAME_DURATION = 60000` live at the top of `App.tsx`. Reuse them; don't sprinkle magic numbers.
- **Leaderboard categories** are keyed `"sentence"` or `"word-<length>"` (`0` = any length). Persisted in `localStorage` under `typoit_lbs`; player name under `typoit_name`.
- **Music selection** is centralized in `getSongForMode(mode, wordLength)` in `App.tsx`: `sentence` → `boss`, length 3–5 → `chill`, length 10–12 → `boss`, else `default`. Update both `App.tsx` and `MusicEngine.ts` when adding songs (extend the `SongId` union and the engine's section data).
- **Timing uses `performance.now()`** — keep it that way for monotonic accuracy. Intervals tick at ~47 ms to feel smooth without jank.
- **Strict TypeScript.** No `any`. Prefer typed props interfaces; reuse types from `src/types.ts`.
- **Keep comments minimal** — only where intent isn't obvious from the code.

## Build / deploy notes

- The `dist/` folder is committed so the site can be served without a build step locally; CI rebuilds it before deploy. If you change source, run `npm run build` and commit the resulting `dist/` files when the change is meant to ship.
- `wordlist.json` is fetched at runtime — it must be served at the site root. The deploy workflow copies `index.html`, `wordlist.json`, and `dist/` into `_site/`.

## When adding features

1. Add/extend types in `src/types.ts`.
2. Wire state into `App.tsx`; pass to children as props.
3. Add a co-located CSS file and import it from the component.
4. Run `npm run typecheck` and `npm run build`.
5. Manually smoke-test at `http://localhost:8000` (welcome → game → results, both modes, music toggle, lose-all-lives path, timer-expiry path).
