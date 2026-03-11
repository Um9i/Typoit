# TODO — Typoit Browser Version

## Setup & Scaffolding
- [x] Create `index.html` with basic page structure (game container, word display, text input, stats area)
- [x] Create `style.css` for layout and styling (centered game area, readable font, feedback colors)
- [x] Create `game.js` for game logic

## Game Logic (JavaScript)
- [x] Embed the wordlist (inline array or fetched from `wordlist.txt`)
- [x] Implement random word selection
- [x] Implement spell check (compare user input to displayed word)
- [x] Track per-word timer using `performance.now()`
- [x] Calculate and display running average time on quit
- [x] Handle "q" input to end the game and show results

## UI / UX
- [x] Display the random word prominently on screen
- [x] Auto-focus the text input field after each word
- [x] Show correct/incorrect feedback with color (green/red)
- [x] Show time taken per word after a correct answer
- [x] Show final average time on the results screen
- [x] Add a "Play Again" button on the results screen

## Testing & Polish
- [ ] Test in browser (open `index.html` directly or via local server)
- [ ] Verify wordlist loads correctly
- [ ] Verify timer accuracy
- [ ] Test quit flow and edge cases (empty input, rapid submissions)
