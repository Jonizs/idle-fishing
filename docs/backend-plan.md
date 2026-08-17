# Backend plan — the base

Written ahead of the work, not during it. Scope here is **the base only**:
accounts and a server-authoritative save. Guilds, events and parties are a
later update and are mentioned only where the base has to leave room for them.

Nothing in this document is built. The game today is unchanged: the client is
the sole authority and the save lives in `localStorage`.

## Why authority has to move

Leaderboards are planned. That is the whole argument. A cheater in a solo idle
game spoils their own save and nobody else's, so light validation would have
been enough — but a cheater on a leaderboard spoils everyone's ranking, and
later, guild contribution numbers are the same problem with a social cost
attached.

So the rule is: **the server computes, the client displays.** The client sends
intents — "I clicked", "buy upgrade 4", "equip this scroll" — and the server
recomputes the outcome from its own tables and returns the new state. The
client never asserts a number. There is no `POST /setSilver`.

This is close to an inversion of the current design, where `js/game/` decides
everything and `save()` writes down the result.

## Two decisions that are expensive to change later

Everything else in the base can be rewritten in an afternoon. These two cannot.

**1. Identity is its own entity.** An `account` that owns a save, not a save
with a name attached. Guilds, parties and leaderboards all hang off accounts;
if the account exists from the first commit they attach without a migration.

**2. The action log exists from the first commit.** Append-only, one row per
accepted action: account, timestamp, action, result, server seed. It buys three
things nothing else can:

- a leaderboard entry can be recomputed from scratch and verified
- an exploit can be rolled back without wiping innocent players
- a guild can be told who actually took what, later on

Current state alone cannot answer "how did you get here?". A log you did not
keep is history you can never reconstruct.

## The base milestone

Shippable and playable on its own, with no leaderboard in sight.

| Piece | Notes |
|---|---|
| Accounts + sessions | Magic email link or Google/Discord OAuth. Do not roll passwords — less code, and no password breach to own. |
| Server-authoritative state | Server holds the real save; client holds a display copy. |
| Action log | Append-only, as above. |
| Server-side clock | Server stores `lastSeen` and computes the gap itself. **Never read a timestamp from the client** — it is the easiest cheat in any idle game. |
| Server-rolled RNG | Catch rolls, struck/enchanted, mutations, crates, the 0.005% scroll drop. Seeded, and the seed goes in the log. If the client rolls, the client rerolls until it likes the answer. |
| Idempotency keys | Each action carries a unique id so a retry does not double-apply. Flaky mobile connections make this a real bug, not a theoretical one. |
| Schema-versioned saves | One row per player: state blob + `schema_version`. Keep the guarded per-key loading already used in `save()` — new fields default, never `Object.assign`. |
| Backups | Automated daily dumps, and restore one once to confirm it works. Losing the save database ends the game. |
| Server-delivered config | The client fetches what is active rather than hardcoding it, or every event later needs a redeploy. |
| Offline fallback | Keep `localStorage` as a cache so the game plays when the server is down, and reconcile on reconnect. Otherwise every deploy is an outage. |
| Rate limits | Cloudflare covers the volumetric layer; add per-account caps and a plausibility pass — given elapsed time and this player's upgrades, is the silver even reachable? Log outliers, don't auto-ban. |

## Shape of the API

Small on purpose. Note what is absent.

```
POST /auth/link      request a login link
POST /auth/verify    exchange it for a session token
GET  /state          the server's copy of your save
POST /action         one intent, with an idempotency key
GET  /config         what is currently active
```

`POST /action` is the whole game. It takes an intent and returns the new state
plus what happened, so the client can animate it.

## Where the code already helps, and where it does not

**Helps:** `js/data/*.js` attaches to `globalThis` rather than `window`
specifically so Node can `require()` it. The server can load the exact same
`FISH`, `UPGRADES` and `EARLY_XP` the browser uses — one set of tables, no
drift between client and server.

**Now also helps:** the catch formulas moved to `js/data/formulas.js`. They take
their inputs through a ctx object instead of closing over `state`, so a server
can wire them to its own state and get identical numbers. This was the actual
blocker — `02-stats.js` mixed the maths with the DOM and Node could not load
the interesting half.

**Still in the way:** the rest of `js/game/` is one shared lexical scope with
~170 names crossing file boundaries, and catch resolution still lives among the
rendering. More of it has to become ctx-shaped before a server can run a full
catch. That is open question 8, and it is the same work either way.

## Build order

Each step depends on the one before it.

1. Auth — accounts and sessions, no game logic.
2. Server-authoritative single player, with the action log from the start.
3. Leaderboard — canonical metric, snapshots, seasons, a review queue.
4. Guilds — the first *shared mutable* state, so real database transactions.
5. Events — server-side scheduling on top of the config endpoint.

Guilds before authority means recomputing everyone's contributions afterwards.

## Notes for the later update

Not now, but they constrain the base a little:

- **Leaderboard metric:** total XP is harder to fake than silver, which players
  spend and regain. Seasons, so the board does not ossify around whoever
  started first.
- **Public names:** the name gate in `11-boot.js` is local today. Public names
  need server-side uniqueness, a profanity filter, and rename support. Accounts
  also become farmable — cheap alts inflating guild contributions is the
  standard exploit.
- **Guild chat:** free text means moderation, reporting and a real abuse burden
  for a solo dev. Preset phrases or emotes would cover most coordination.
- **The storm** becomes global once it is server-side: everyone sees the same one.

## Hosting

Pages serves the static game and cannot run any of this. The API needs its own
home — a subdomain like `api.<domain>` pointed at Cloudflare Workers, Fly.io or
a small VPS — while Pages keeps serving the game itself. That split is normal.
