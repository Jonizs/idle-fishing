// GET /config — what is currently active.
//
// The client fetches this rather than hardcoding it, so an event can be turned
// on by editing a row in D1 instead of redeploying the game.
//
// It also carries the world: the storm, the fog. Server-side means everyone
// sees the same one, which is a change from the client rolling its own.

import { all, one, run, now } from "./db.js";

// Rolled every 300s, 1/10 rising to 1/3 after 50 dry minutes, and it runs for
// everybody at once. Held in the config table so a restart does not lose it.
const STORM_LEN = 120e3;

export const world = async env => {
  const row = await one(env.DB, "SELECT value FROM config WHERE key = 'world'");
  const w = row ? JSON.parse(row.value) : { storm: 0, fog: 0, lastRoll: 0, dry: 0 };
  const t = now();

  if (t - w.lastRoll >= 300e3) {
    w.lastRoll = t;
    const chance = Math.min(0.1 + 0.0046 * (w.dry / 60e3), 1 / 3);
    if (Math.random() < chance) { w.storm = t + STORM_LEN; w.dry = 0; }
    else w.dry += 300e3;
    await run(env.DB,
      `INSERT INTO config (key, value, updated_at) VALUES ('world', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      JSON.stringify(w), t);
  }
  // Booleans for the formulas; the expiries stay internal.
  return { storm: w.storm > t, fog: w.fog > t, focus: false, rush: false,
           stormEnds: w.storm, fogEnds: w.fog };
};

export const config = async env => {
  const rows = await all(env.DB, "SELECT key, value FROM config WHERE key != 'world'");
  const out = {};
  for (const row of rows) out[row.key] = JSON.parse(row.value);
  return { ...out, world: await world(env), serverTime: now() };
};
