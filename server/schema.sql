-- D1 schema for the base milestone: accounts, sessions, saves, action log.
--
-- Applied with:  npx wrangler d1 execute idle-fishing --file=schema.sql
-- Nothing here is destructive, so it is safe to re-run.

-- ── Identity ───────────────────────────────────────────────────────────────
-- An account owns a save, rather than a save carrying a name. Guilds, parties
-- and leaderboards all hang off account_id later, with no migration.
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,          -- uuid
  email       TEXT UNIQUE,               -- null until a real provider is wired
  provider    TEXT NOT NULL,             -- 'email' | 'discord' | 'dev'
  provider_id TEXT,                      -- provider's own user id, if any
  name        TEXT,                      -- public name, unique when set
  created_at  INTEGER NOT NULL,
  banned      INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider ON accounts(provider, provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_name     ON accounts(name);

-- Login links. Single use, short lived, stored hashed so a database leak is
-- not a pile of live login tokens.
CREATE TABLE IF NOT EXISTS login_tokens (
  hash       TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

-- Sessions. Also hashed: the client holds the only plaintext copy.
CREATE TABLE IF NOT EXISTS sessions (
  hash       TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);

-- ── The save ───────────────────────────────────────────────────────────────
-- One row per player. The blob is the server's copy and the only authority;
-- the browser's localStorage is a display cache.
--
-- last_seen is the server clock. A client timestamp is never read: it is the
-- easiest cheat in any idle game.
CREATE TABLE IF NOT EXISTS saves (
  account_id     TEXT PRIMARY KEY REFERENCES accounts(id),
  schema_version INTEGER NOT NULL,
  state          TEXT NOT NULL,          -- json
  last_seen      INTEGER NOT NULL,       -- ms, server clock
  rng_seed       INTEGER NOT NULL,       -- advances with every roll
  updated_at     INTEGER NOT NULL
);

-- ── The action log ─────────────────────────────────────────────────────────
-- Append-only, one row per accepted action, from the first commit. It is what
-- lets a leaderboard entry be recomputed, an exploit be rolled back without
-- wiping innocent players, and a guild be told who took what.
--
-- id is the client's idempotency key, so a retry over a flaky connection
-- replays the stored result instead of applying twice.
CREATE TABLE IF NOT EXISTS action_log (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  seq        INTEGER NOT NULL,
  at         INTEGER NOT NULL,           -- server clock
  action     TEXT NOT NULL,              -- intent type
  payload    TEXT NOT NULL,              -- json, as sent
  result     TEXT NOT NULL,              -- json, what the server decided
  seed       INTEGER NOT NULL            -- seed the rolls started from
);
CREATE INDEX IF NOT EXISTS action_log_account ON action_log(account_id, seq);

-- ── Server-delivered config ────────────────────────────────────────────────
-- What is currently active. Editing a row here changes the live game without
-- a redeploy, which is the whole point of it existing before events do.
CREATE TABLE IF NOT EXISTS config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,              -- json
  updated_at INTEGER NOT NULL
);

-- ── Plausibility outliers ──────────────────────────────────────────────────
-- Logged, never auto-banned. A false positive that bans a real player costs
-- more than a cheater who sits in a queue for a day.
CREATE TABLE IF NOT EXISTS flags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  at         INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  detail     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS flags_account ON flags(account_id, at);
