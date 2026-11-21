# Spot It!

A standalone browser matching game. Open `index.html` directly, or play through the portfolio’s Game Design section at `../../#game-design`.

Each player card has ten distinct objects from 32 inline SVG illustrations, with exactly one object shared with the table card. Drag the match onto its twin or select both using touch, mouse or keyboard. The first player to 20 points wins. The timer-driven AI has three speeds; Pause and Escape suspend play. The board appears immediately with a small Start button and no intro.

The Canvas background samples the actual SVG object outlines into floating particles and refreshes its objects on each deal. Background motion can be paused and respects reduced-motion preferences. Everything runs locally without external assets or services. The optional best-win record stays in browser local storage.

Run `node tests/spot-it.cjs` from the repository root to check the portfolio entry, game rules, controls, restart lifecycle, mobile layout and particles. Set `BASE_URL` to test a hosted portfolio; local checks start a temporary HTTP preview server.
