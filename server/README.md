# server — the API

Cloudflare Workers + D1. Step 1 and 2 of the build order in
[`docs/backend-plan.md`](../docs/backend-plan.md): accounts, and a
server-authoritative save with the action log from the start.

The game itself is untouched. Nothing in `js/` or `idle-fishing.html` talks to
this yet — wiring the client up is the next job, and doing it separately means
the game keeps working while the API is still moving.

## What is here

| File | Holds |
|---|---|
| `schema.sql` | accounts, sessions, login tokens, saves, action log, config, flags |
| `src/index.js` | the five endpoints and CORS |
| `src/auth.js` | accounts and sessions — no game logic |
| `src/state.js` | the save shape, guarded loading, formulas wired to a D1 row |
| `src/action.js` | `POST /action` — elapsed time, the catch rolls, the intents |
| `src/config.js` | what is active, and the world (storm, fog) |
| `src/rng.js` | seeded rolls, so a logged result can be replayed |
| `src/tables.js` | imports `js/data/*.js` — the same numbers the browser uses |

`tables.js` deliberately leaves out `map.js`, `scene.js` and `wade.js`. They
are base64 artwork and the server has nothing to draw.

## Setup

You need a Cloudflare account and, for the API's own subdomain, a domain on
Cloudflare's nameservers. Both of those are yours to do — buying a domain and
creating accounts are not things I can do for you.

```bash
cd server && npm install
```

```bash
npx wrangler login
```

```bash
npx wrangler d1 create idle-fishing
```

That prints a `database_id`. Put it in `wrangler.toml` in place of
`REPLACE_ME`, then create the tables:

```bash
npm run db:init
```

```bash
npx wrangler secret put TOKEN_PEPPER
```

Any long random string. It is mixed into token hashes so a leaked database is
not a pile of live sessions.

```bash
npm run deploy
```

For the subdomain: add the domain to Cloudflare, then uncomment the `routes`
line in `wrangler.toml` with `api.yourdomain.com` and deploy again. Cloudflare
creates the DNS record itself. GitHub Pages keeps serving the game — point the
apex or `www` at it with a `CNAME` file in the repo root.

## Running it locally

```bash
npm run db:init:local
```

```bash
npm run dev
```

`DEV_LOGIN` is on in `wrangler.toml`, so a login is a name and nothing else:

```bash
curl -X POST http://localhost:8787/auth/link -d '{"name":"jonas"}'
```

That returns a session token. Use it as `Authorization: Bearer <token>` on
`/state` and `/action`. **Turn `DEV_LOGIN` off before release** or every
account is free to take.

## What it does and does not do yet

**Does:** accounts and sessions; the save in D1; the action log with an
idempotency key on every row; the server clock (a client timestamp is never
read); server-rolled catches with the seed logged; buying upgrades, choosing
fish, equipping scrolls, selling, naming; the storm rolled once for everyone;
outliers flagged rather than auto-banned.

**Does not, yet:**

- **Crates, the museum, the forge, the dojo, mutations and the gem shop** have
  no intents. They still live in `js/game/` among the rendering, and moving
  them is open question 8 — the same work the plan already names.
- **Offline is capped at 12 hours** and long gaps are resolved by expected
  value rather than per-fish rolls, because rolling 200,000 catches inside one
  request hits the Worker CPU limit.
- **Fog crafting fish** are keyed off the fish that was caught rather than the
  client's own table, which is not yet ctx-shaped.
- **No email yet.** Magic-link is written and switches on the moment
  `RESEND_API_KEY` and a verified sending domain exist; until then requesting a
  link returns the token in the response so it stays testable.
- **Backups are a command, not a schedule.** `npm run db:backup` dumps the
  database. Run it once and restore it once to confirm it works before there
  are players to lose.

## Cost, at the size you are planning for

The Workers free tier is 100,000 requests a day. A tick every ten seconds is
8,640 requests per player per day, so it runs out at about eleven concurrent
players. The $5/month plan covers 10 million, which is roughly 1,100 players
ticking constantly — comfortably past 100–200.

That number is why the client should animate its own catches between ticks and
tick perhaps every 10–30 seconds, rather than sending one request per fish.
The server stays the authority either way: it recomputes the whole interval
from its own tables and the client's prediction is overwritten by whatever
comes back.
