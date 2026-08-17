// The server's copy of a save: what it looks like, how it is read back, and
// how the game's own formulas get wired to it.

import { D } from "./tables.js";
import { one, run, now } from "./db.js";
import { newSeed } from "./rng.js";

export const SCHEMA_VERSION = 1;

// Mirrors `state` in js/game/02-stats.js, minus everything that is presentation
// (layout, tabs, demo, the dev flags) or derived per frame. Those stay client
// side; the server has no screen.
export const blank = () => ({
  player: { name: "", level: 1, xp: 0 },
  silver: 0, gold: 0,
  gems: 0, gemSecs: 0,
  gemBuf: { speed: 0, premium: 0, gifted: 0 },
  upgrades: {}, owned: {}, ench: {},
  picks: ["lanternfish"],
  picksBy: { pond: ["lanternfish"], wade: ["swampfish"] },
  area: "pond",
  mutated: {}, struck: {}, museum: {},
  scrolls: {}, scrollEq: ["", "", "", "", "", "", "", "", ""],
  ravens: 0, fogFish: {}, spyglass: 0, meals: 0,
  rods: {}, lines: {}, lures: {}, baits: {}, hats: {}, crates: {},
  equip: { rod: "", line: "", lure: "", bait: "", hat: "" },
  dojo: { tiers: {}, active: null },
  stats: { play: 0, silverEarned: 0, goldEarned: 0, caught: 0, xpEarned: 0, levelAt: {} },
});

// Per-key, like the browser's loader. Object.assign would leave every key
// added after a save was written undefined, and old saves must never break.
export const hydrate = raw => {
  const s = blank();
  if (!raw || typeof raw !== "object") return s;
  const copy = (k, isObj) => {
    if (raw[k] === undefined || raw[k] === null) return;
    if (isObj && typeof raw[k] !== "object") return;
    s[k] = raw[k];
  };
  ["silver", "gold", "gems", "gemSecs", "ravens", "spyglass", "meals", "area"]
    .forEach(k => copy(k));
  ["player", "gemBuf", "upgrades", "owned", "ench", "picksBy", "mutated",
   "struck", "museum", "scrolls", "fogFish", "rods", "lines", "lures", "baits",
   "hats", "crates", "equip", "dojo", "stats"].forEach(k => copy(k, true));
  if (Array.isArray(raw.picks))    s.picks    = raw.picks;
  if (Array.isArray(raw.scrollEq)) s.scrollEq = raw.scrollEq;
  // Nested defaults, same reasoning one level down.
  s.player = { name: "", level: 1, xp: 0, ...s.player };
  s.stats  = { ...blank().stats, ...s.stats };
  s.dojo   = { tiers: {}, active: null, ...s.dojo };
  return s;
};

export const loadSave = async (env, accountId) => {
  const row = await one(env.DB, "SELECT * FROM saves WHERE account_id = ?", accountId);
  if (row) return { state: hydrate(JSON.parse(row.state)), lastSeen: row.last_seen, seed: row.rng_seed };
  const fresh = { state: blank(), lastSeen: now(), seed: newSeed() };
  await run(env.DB,
    `INSERT INTO saves (account_id, schema_version, state, last_seen, rng_seed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    accountId, SCHEMA_VERSION, JSON.stringify(fresh.state), fresh.lastSeen, fresh.seed, now());
  return fresh;
};

export const writeSave = async (env, accountId, { state, lastSeen, seed }) =>
  run(env.DB,
    `UPDATE saves SET schema_version = ?, state = ?, last_seen = ?, rng_seed = ?, updated_at = ?
     WHERE account_id = ?`,
    SCHEMA_VERSION, JSON.stringify(state), lastSeen, seed, now(), accountId);

// ── Wiring the game's formulas to a server-side save ───────────────────────
// makeFormulas reads everything through calls, never destructuring, so this
// is the whole adapter. The browser passes a ctx backed by the live game; this
// passes one backed by a row in D1, and both get identical numbers.
export const ctxFor = (s, world) => {
  const eqTier = kind => {
    const key = s.equip?.[kind];
    return key ? Number(key.split(":")[1]) || 0 : 0;
  };
  const rarSum = rar => ["rod", "line", "lure", "bait", "hat"]
    .reduce((n, k) => n + (String(s.equip?.[k] || "").startsWith(rar + ":") ? eqTier(k) : 0), 0);
  const scrollR = id => {
    const eq = (s.scrollEq || []).find(k => k && k.startsWith(id + ":"));
    return eq ? Number(eq.split(":")[1]) || 0 : 0;
  };
  // Museum: sum of the *tiers* of every completed set of a rarity, so ten
  // sets sum to 55 and every buff is linear in that. Five worn slots fill a
  // set. Thunder is an event rarity and only exists at tier 5.
  // Kept identical to museumSum() in js/game/08-museum.js.
  const museumSum = rar => {
    let n = 0;
    const tiers = rar === "thunder" ? [5] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const t of tiers) if ((s.museum?.[`${rar}:${t}`] || []).length === 5) n += t;
    return n;
  };
  const mus = {
    speed: () => 0.02 * museumSum("std"),
    game:  () => 0.02 * museumSum("refined"),
    dbl:   () => 0.01 * museumSum("enchanted"),
    enc:   () => 0.01 * museumSum("awakened"),
    bolt:  () => (museumSum("thunder") ? 0.02 : 0),
  };
  return {
    lvl:  id => s.upgrades?.[id] || 0,
    dojo: id => s.dojo?.tiers?.[id] || 0,
    wornT: eqTier,
    rarSum, scrollR, mus,
    // Never true server-side: demo is a dev showcase and is not saved.
    demo: () => false,
    // World state is the server's, not the client's — one storm for everyone.
    stormOn: () => !!world.storm,
    fogOn:   () => !!world.fog,
    focusOn: () => !!world.focus,
    rushOn:  () => !!world.rush,
    // gemBuf holds an epoch-ms expiry, except Gifted which is permanent.
    // Server clock, as everywhere else.
    gem: k => k === "gifted" ? !!s.gemBuf?.gifted : (s.gemBuf?.[k] || 0) > Date.now(),
  };
};

export const formulasFor = (s, world) => D.makeFormulas(ctxFor(s, world));

// Rods: 1, 2 with Two Rods, 3 with Trifecta. Same rule as the client.
export const rodCount = s =>
  1 + (s.upgrades?.twoRods ? 1 : 0) + (s.upgrades?.trifecta ? 1 : 0);
