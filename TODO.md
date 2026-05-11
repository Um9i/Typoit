# TODO — Typoit Browser Version

## Done

- [x] Multiple songs with the current one as default
- [x] Songs reflect difficulty (short words → chill, sentence mode → boss)
- [x] Split `App.tsx` — extracted `useGameLoop`, `useLeaderboard`, `useWordlist` hooks plus `categories.ts` and `leaderboard.ts` pure modules
- [x] Vitest unit tests for `fmtMs`, `getSongForMode`/category keys, and leaderboard math (22 tests)
- [x] ESLint (`@typescript-eslint`, `react`, `react-hooks`) with `npm run lint`; CI workflow runs lint + typecheck + test + build
- [x] In-app error banner with retry replaces `alert()` on wordlist load failure
- [x] `dist/` removed from version control (gitignored); README updated to require `npm run build` before serving

## Priority 1 — Gameplay & UX

- [ ] Visible per-letter progress on the current word (highlight typed prefix, show next letter)
- [ ] Configurable round duration (30s / 60s / 120s) on the Welcome screen
- [ ] Configurable lives (1 / 3 / 5 / unlimited)
- [ ] Pause / resume during a round (e.g. `Esc`) without forfeiting the score
- [ ] Show accuracy % alongside WPM in Results and on the leaderboard
- [ ] Mobile / touch support — currently relies on a hardware keyboard

## Priority 2 — Content & Modes

- [ ] Sentence mode: use real sentences (or Markov-generated phrases) instead of 4 random words joined by spaces
- [ ] Punctuation / capitalization mode for advanced practice
- [ ] Numbers / symbols mode
- [ ] Per-user "weakest letters" tracking → adaptive practice mode

## Priority 3 — Music & Audio

- [ ] Per-song volume normalization (boss is noticeably louder than chill)
- [ ] Remember music on/off preference in `localStorage`
- [ ] Optional SFX toggle (correct/wrong key) separate from music

## Priority 4 — Leaderboard & Persistence

- [ ] Export / import leaderboard as JSON
- [ ] Clear-leaderboard button (per category and global) with confirmation
- [ ] Optional online leaderboard (out of scope for now — design only)

## Bugs / polish

- [ ] Music toggle click is suppressed by the global "first interaction starts music" listener — verify it still works on first paint
- [ ] On very fast typing, the 10 ms `setTimeout` that clears the input on `nextWord` can drop a keystroke — investigate
- [ ] HUD overlaps the word on narrow viewports — needs responsive tweaks
- [ ] Revisit `--legacy-peer-deps` once `eslint-plugin-react` officially supports ESLint 9 peer range
