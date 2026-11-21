# Spot It PvP room service

The game stays on GitHub Pages at `/contact-card/samples/spot-it/`. This separate Cloudflare Worker uses one SQLite Durable Object per random 96-bit room ID and hibernating WebSockets for 2–6 player synchronization.

- `POST /rooms` creates a room and a private host session from `{name}`.
- `POST /rooms/:room/join` reserves the next available seat from `{name}`. A seventh player receives 409; joining after the host starts is rejected.
- `GET /rooms/:room/socket` upgrades with WebSocket protocols `spot-it` and the private session token. Tokens stay out of invite links and query strings. Only token hashes are stored on the server.
- `GET /health` reports service readiness.

Everyone chooses Ready, then the host sends Start when 2–6 players have joined. The server starts a two-second countdown, deals ten distinct objects per card with exactly one table match, validates guesses and round numbers, and awards one point per round. First to 20 wins. Everyone requests a rematch, then the host starts it. A disconnect pauses an active match; reconnecting the same private session restores its seat and score, followed by a countdown. Reconnecting in another tab replaces the older connection. Play is ordered by server receipt; this test service does not compensate for network latency.

Rooms, player names and session hashes expire two hours after creation. Private sessions are stored in each player’s browser local storage for reconnection. Anyone with the invite link may take one of the six available seats; there is no account or password. Names are rendered as text. Request/message lengths, message rate, room capacity and origins are checked. Only the portfolio origin and local HTTP previews are accepted.

The deployed service is `https://spot-it-pvp.josephsanjari1996.workers.dev`. Deploy through the Cloudflare connector, or set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your environment and run `node workers/spot-it-pvp/deploy.mjs`. The script creates the SQLite namespace only on the first deployment. No credentials belong in this repository.

Verification:

```sh
node --test workers/spot-it-pvp/rules.test.mjs
node tests/spot-it.cjs
node tests/spot-it-pvp.cjs
```

The PvP browser check connects six independent browser contexts to the actual Cloudflare runtime. It covers creating/joining a room, clipboard copying, pasting invite links, link validation, the six-player roster, host-controlled start, escaped names, private session authentication, capacity, simultaneous six-player and stale guesses, refresh/reconnect, mobile layout, a complete 20-point match, rematch, leaving, and returning to solo play. Set `BASE_URL=https://josephsjr96.github.io/contact-card/` to check the published frontend.
