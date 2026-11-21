# Spot It!

A browser matching game in the portfolio’s Game Design section at `../../#game-design`.

Each card has ten distinct objects from 32 inline SVG illustrations, with exactly one object shared with the table card. Drag the match onto its twin or select both using touch, mouse or keyboard. The first player to 20 points wins. The board appears immediately with a small Start button and no intro.

Solo play has three AI speeds and works locally. Pause and Escape suspend the solo match. The Canvas background samples the actual SVG object outlines into floating particles and refreshes its objects on each deal. Motion can be paused and respects reduced-motion preferences. The optional best-win record stays in browser local storage.

## Two-player test mode

On the hosted site, choose **2 players**, enter a name and select **Create link**. Copy the room link and send it to one friend. They enter their name and join on the same site. Both players select **Ready** to start. The server coordinates rounds and awards one point to the first correct guess it receives. Both can request a rematch. Leaving returns to solo play; disconnecting pauses the online match until the player reconnects.

The frontend connects to `https://spot-it-pvp.josephsanjari1996.workers.dev`; implementation and deployment notes are in `../../workers/spot-it-pvp/`. Names and game state are sent to that service. Rooms expire after two hours. Private session tokens stay in browser local storage so a refresh can recover the original seat, and are never put in invite links. Separate players need separate browser profiles or devices; another tab in the same profile recovers the same saved seat.

Run `node tests/spot-it.cjs` from the repository root for the portfolio entry and solo rules/controls. Run `node tests/spot-it-pvp.cjs` for two-player browser checks against the actual room service. Set `BASE_URL` to test the published portfolio; default checks start a temporary HTTP preview server.
