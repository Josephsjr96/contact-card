# Spot It!

A browser matching game in the portfolio’s Game Design section at `../../#game-design`.

Each card has ten distinct objects from 32 inline SVG illustrations, with exactly one object shared with the table card. Drag the match onto its twin or select both using touch, mouse or keyboard. The first player to 20 points wins. The board appears immediately with a small Start button and no intro.

Solo play has three AI speeds and works locally. Pause and Escape suspend the solo match. The Canvas background samples the actual SVG object outlines into floating particles and refreshes its objects on each deal. Motion can be paused and respects reduced-motion preferences. The optional best-win record stays in browser local storage.

Sound effects use rounded mallet and glass tones, brushed-air card movements and a short harmonic win flourish. The speaker button toggles sound and remembers the choice on this device. Audio starts only after an interaction, fades when muted and stops in background tabs. There is no music or downloaded audio. PvP cues follow confirmed server transitions; repeated updates, player previews and restored rounds stay quiet. `sound.js` generates the effects with Web Audio and leaves gameplay usable if audio is unavailable.

`node tests/spot-it-sound.cjs` checks solo cues, mute persistence, keyboard controls, background suspension, mobile layout, mocked PvP transitions and audio fallback. It also renders all ten cues offline, checking output levels and decaying tails; review WAVs and a level report are saved under ignored `qa/spot-it-sound/`. These checks do not assess subjective sound quality on every speaker or device.

## PvP test mode · 2–6 players

On the hosted site, choose **PvP**, enter a name and select **Create link**. Copy the room link and send it to up to five friends. They can open the link directly, or choose **PvP**, enter a name, paste the invite link and select **Join**. Everyone selects **Ready**, then the host selects **Start match**. The host can begin with any group of 2–6 players. The roster shows everyone’s scores and ready status; select a player to preview their card. The server coordinates rounds and awards one point to the first correct guess it receives. Everyone can request a rematch, then the host starts again. Leaving returns to solo play; disconnecting pauses the online match until the player reconnects.

The frontend connects to `https://spot-it-pvp.josephsanjari1996.workers.dev`; implementation and deployment notes are in `../../workers/spot-it-pvp/`. Names and game state are sent to that service. Rooms expire after two hours. Private session tokens stay in browser local storage so a refresh can recover the original seat, and are never put in invite links. Separate players need separate browser profiles or devices; another tab in the same profile recovers the same saved seat.

Run `node tests/spot-it.cjs` from the repository root for the portfolio entry and solo rules/controls. Run `node tests/spot-it-pvp.cjs` for six-player browser checks against the actual room service. Set `BASE_URL` to test the published portfolio; default checks start a temporary HTTP preview server.
