# Roadmap — Typo.it

> A living wishlist on the way to **the best typing game on the web**. Items are roughly ordered by impact and reach: gameplay first, then content depth, then polish.

## ✅ Shipped

- Multiple procedural chiptune tracks; default song on `Any`/medium difficulty.
- Difficulty-matched soundtrack — short words → `chill`, long words & sentence mode → `boss`.
- Architecture refactor — `App.tsx` split into `useGameLoop`, `useLeaderboard`, `useWordlist`, plus pure `categories.ts` / `leaderboard.ts` modules.
- Vitest test suite (22 tests) covering time formatting, song selection, leaderboard keys, WPM math, and top-10 truncation.
- ESLint (`@typescript-eslint` + `react` + `react-hooks`) with a `lint` script and CI gate.
- CI workflow runs **lint + typecheck + test + build** on every PR and push.
- In-app retry banner replaces the legacy `alert()` when `wordlist.json` fails to load.
- `dist/` removed from version control; build is performed locally and in CI.

---

## 🎯 P1 — Game feel

The features players will notice first.

- [ ] **Live per-letter feedback** — highlight the typed prefix, ghost the next letter, color the cursor.
- [ ] **Configurable round length** (30 / 60 / 120 s) on the Welcome screen.
- [ ] **Configurable lives** (1 / 3 / 5 / unlimited) for accessibility and casual play.
- [ ] **Pause / resume** with `Esc` — pauses timer, music, and HUD without forfeiting the run.
- [ ] **Accuracy %** alongside WPM in Results and on the leaderboard.
- [ ] **Mobile & touch support** — virtual keyboard handling, larger tap targets, responsive layout.

## 📚 P2 — Content depth

Make the words themselves more interesting.

- [ ] **Real sentences** in Sentence mode — curated corpus and/or Markov-generated phrases instead of four random words spliced together.
- [ ] **Punctuation & capitalization** mode for realistic prose practice.
- [ ] **Numbers & symbols** mode for power users.
- [ ] **Adaptive practice** — track each player's slowest / most-missed letters and bias upcoming prompts toward them.
- [ ] **Quote mode** — type famous one-liners; lean into bragging rights.

## 🎵 P3 — Audio

Procedural music is the soul of this game; tighten it.

- [ ] **Per-song loudness normalization** — `boss` is currently louder than `chill`.
- [ ] **Persist music on/off preference** in `localStorage`.
- [ ] **Volume slider** in the music toggle.
- [ ] **Optional SFX channel** (correct / wrong keystroke) independent of music.

## 🏆 P4 — Leaderboards & sharing

- [ ] **Export / import leaderboards** as JSON for backup or device migration.
- [ ] **Clear leaderboard** (per category + global) with confirmation.
- [ ] **Shareable result cards** — copy-to-clipboard or PNG snapshot of your run.
- [ ] **Online leaderboard** (design spike only for now — likely Cloudflare KV or a tiny serverless endpoint).

## 🧪 P5 — Engineering polish

- [ ] **Component tests** (React Testing Library) for `Welcome`, `Game`, `Results`.
- [ ] **End-to-end smoke test** (Playwright) covering welcome → game → results in both modes.
- [ ] **Pre-commit hook** (husky + lint-staged) for lint + typecheck on staged files.
- [ ] **Bundle size budget** in CI — fail PRs that bloat `dist/game.js`.
- [ ] **Source maps** in the deployed build for easier debugging.

## 🐛 Bugs & rough edges

- [ ] Music toggle click occasionally races the global "first interaction starts music" listener on first paint — verify.
- [ ] The 10 ms `setTimeout` that clears the input on `nextWord` can swallow a keystroke from very fast typers — investigate replacing with a controlled input or `requestAnimationFrame` gate.
- [ ] HUD overlaps the current word on narrow viewports — responsive tweaks needed.
- [ ] Revisit `--legacy-peer-deps` once `eslint-plugin-react` officially supports ESLint 9.

---

*Have an idea that should be here? Open an issue or a PR.*
