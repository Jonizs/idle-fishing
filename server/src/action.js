// POST /action — the whole game.
//
// The client sends an intent and the server recomputes the outcome from its
// own tables. The client never asserts a number: there is no setSilver here,
// and adding one would undo the point of the rewrite.
//
// Every accepted action is appended to action_log with the seed its rolls
// started from, so any result can be replayed and checked later.

import { D, FISH_BY_ID, UPG_BY_ID } from "./tables.js";
import { one, run, now } from "./db.js";
import { rng } from "./rng.js";
import { loadSave, writeSave, formulasFor, rodCount } from "./state.js";

// Offline earnings stop here. Without a cap a save left for a year pays a
// year, and one clock mistake becomes an unbounded one.
const OFFLINE_CAP = 12 * 3600e3;
// Above this many catches in one tick the server stops rolling each fish and
// takes the expected value instead. Rolling 200k times inside one request is
// how a Worker hits its CPU limit.
const ROLL_LIMIT = 4000;

export const applyAction = async (env, account, body, world) => {
  const id = String(body.id || "");
  if (!id) return { status: 400, body: { error: "missing_idempotency_key" } };

  // A retry over a flaky connection replays the stored result rather than
  // applying twice. On mobile this is a real bug, not a theoretical one.
  const seen = await one(env.DB, "SELECT result FROM action_log WHERE id = ?", id);
  if (seen) return { status: 200, body: { ...JSON.parse(seen.result), replayed: true } };

  const save = await loadSave(env, account.id);
  const seed = save.seed;
  const r = rng(seed);
  const type = String(body.type || "");
  const payload = body.payload || {};

  const handler = HANDLERS[type];
  if (!handler) return { status: 400, body: { error: "unknown_action" } };

  // Elapsed time is always resolved first, so a purchase cannot be used to
  // dodge the catches that happened before it.
  const events = tick(save, world, r);
  const out = handler(save, payload, world, r);
  if (out?.error) return { status: 400, body: { error: out.error } };

  save.seed = r.seed();
  save.lastSeen = now();
  await writeSave(env, account.id, save);

  const result = { state: save.state, events: events.concat(out?.events || []) };
  const seq = (await one(env.DB,
    "SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM action_log WHERE account_id = ?", account.id)).n;
  await run(env.DB,
    `INSERT INTO action_log (id, account_id, seq, at, action, payload, result, seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, account.id, seq, now(), type, JSON.stringify(payload),
    JSON.stringify({ events: result.events }), seed);

  await plausibility(env, account, events);
  return { status: 200, body: result };
};

// ── Elapsed time ───────────────────────────────────────────────────────────
// The server holds lastSeen and works out the gap itself. A timestamp from
// the client is never read; it is the easiest cheat in any idle game.
function tick(save, world, r) {
  const s = save.state;
  const elapsed = Math.min(Math.max(now() - save.lastSeen, 0), OFFLINE_CAP);
  if (elapsed < 250) return [];

  const F = formulasFor(s, world);
  const secs = elapsed / 1000;
  // The game loop scales dt by beerMul, so beer is game speed rather than a
  // catch buff. Same here: it stretches the elapsed time, it does not change
  // what a catch is worth. state.speed is the dev slider and is always 1.
  const gameSecs = secs * F.beerMul();
  const events = [];

  for (let rod = 0; rod < rodCount(s); rod++) {
    const fish = FISH_BY_ID[s.picks?.[rod]];
    if (!fish || fish.lvl > s.player.level) continue;

    // Whole catches, plus the fraction of one rolled rather than rounded, so
    // short ticks are not free and are not lost either.
    const exact = gameSecs / catchTime(s, fish, F);
    let n = Math.floor(exact);
    if (r.chance(exact - n)) n++;
    if (!n) continue;

    events.push(resolve(s, fish, n, world, F, r));
  }

  s.stats.play += secs;
  return events;
}

// Mutation swaps a fish's xp and price but not its time — mirrors isMut/fishXp
// in js/game/01-core.js, including that quirk.
const fishXp    = (s, f) => (s.mutated?.[f.id] && D.MUT[f.id] ? D.MUT[f.id].xp : f.xp);
const fishPrice = (s, f) => (s.mutated?.[f.id] && D.MUT[f.id] ? D.MUT[f.id].price : f.price);

const catchTime = (s, f, F) => {
  const lvl = id => s.upgrades?.[id] || 0;
  const dojo = id => s.dojo?.tiers?.[id] || 0;
  const base = f.time
    * (1 - 0.025 * lvl("machine") - 0.025 * dojo("shoSkills") - 0.025 * dojo("sanWeight"))
    * (1 - F.scrollBuff("sword"));
  return base / F.speedMul();
};

// n catches of one fish, resolved in one go.
//
// The roll order is the client's, from fishLine() in js/game/11-boot.js:
// raven, fog fish, skull scroll, double, then struck-or-enchanted (exclusive,
// bolt first, storm second, enchanted last), then gold per fish, then
// resonance, then the Gifted multiplier. Catches pay XP; silver comes from
// selling the fish, never from landing them.
function resolve(s, fish, n, world, F, r) {
  const boltP  = F.boltChance();
  const encP   = F.encChance();
  const goldP  = F.goldChance(fish);
  const dblP   = F.dblChance();
  const ravenP = F.ravenChance();
  const resonP = F.resonChance();
  const skull  = 1 + F.scrollBuff("skull");
  const gifted = s.gemBuf?.gifted ? 1.25 : 1;
  const fogP   = world.fog ? 0.02 * fish.idx : 0;
  const baseXp = fishXp(s, fish);

  const out = { kind: "catch", fish: fish.id, n: 0, struck: 0, ench: 0,
                gold: 0, ravens: 0, fog: 0, xp: 0 };

  // Above the limit each roll is replaced by its expected count, with the
  // fractional remainder rolled once so rounding is not a free gain. Only a
  // long offline gap gets there, and the alternative is a Worker CPU timeout.
  const bulk = n > ROLL_LIMIT;
  const take = (p, base) => {
    const e = base * p, k = Math.floor(e);
    return k + (r.chance(e - k) ? 1 : 0);
  };

  if (bulk) {
    const ravens = take(ravenP, n);
    const fog    = take(fogP, n);
    const dbl    = take(dblP, n);
    const count  = n + dbl;
    const bolt   = take(boltP, n);
    const storm  = world.storm ? take(0.05, n - bolt) : 0;
    const struck = bolt + storm;
    const ench   = take(encP, n - struck);
    const gold   = take(goldP, count);
    const reson  = take(resonP, n);

    // XP is the base summed over n catches, plus what each multiplier that
    // landed added on top: raven, double and resonance each add another
    // catch's worth, a fog fish adds 19 and a struck one 7.
    out.xp = baseXp * skull * gifted *
             (n + ravens + fog * 19 + dbl * 2 + struck * 7 + reson);
    out.n = count; out.struck = struck; out.ench = ench;
    out.gold = gold; out.ravens = ravens; out.fog = fog;
    bag(s, "struck")[fish.id] = (bag(s, "struck")[fish.id] || 0) + struck;
    bag(s, "ench")[fish.id]   = (bag(s, "ench")[fish.id]   || 0) + ench;
    bag(s, "")[fish.id]       = (bag(s, "")[fish.id]       || 0) + (count - struck - ench);
    if (fog) { const ff = fogCatch(fish); s.fogFish[ff] = (s.fogFish[ff] || 0) + fog; }
  } else {
    for (let i = 0; i < n; i++) {
      let count = 1, gain = baseXp;
      if (r.chance(ravenP))  { gain *= 2; s.ravens++; out.ravens++; }
      if (fogP && r.chance(fogP)) {
        gain *= 20;
        const ff = fogCatch(fish);
        s.fogFish[ff] = (s.fogFish[ff] || 0) + 1;
        out.fog++;
      }
      gain *= skull;
      if (r.chance(dblP)) { count = 2; gain *= 2; }

      let kind = "";
      if (r.chance(boltP))                       { kind = "struck"; gain *= 8; }
      else if (world.storm && r.chance(0.05))    { kind = "struck"; gain *= 8; }
      else if (r.chance(encP))                     kind = "ench";

      const b = bag(s, kind);
      b[fish.id] = (b[fish.id] || 0) + count;
      if (kind === "struck") out.struck += count;
      else if (kind === "ench") out.ench += count;

      for (let j = 0; j < count; j++)
        if (r.chance(goldP)) { s.gold++; s.stats.goldEarned++; out.gold++; }

      if (r.chance(resonP)) gain *= 2;
      out.xp += gain * gifted;
      out.n += count;
    }
  }

  s.stats.caught += out.n;
  s.stats.xpEarned += out.xp;
  if (bulk) { s.ravens += out.ravens; s.gold += out.gold; s.stats.goldEarned += out.gold; }
  grantXp(s, out.xp);
  return out;
}

const bag = (s, kind) => (kind === "ench" ? s.ench : kind === "struck" ? s.struck : s.owned);

// Bread and Market Experience lift the shelf price, rounded per fish so
// silver stays whole. Enchanted sells for 4x, struck for 8x.
const priceOf = (s, f, kind) => {
  const lvl = id => s.upgrades?.[id] || 0;
  const mult = kind === "ench" ? 4 : kind === "struck" ? 8 : 1;
  return Math.round(fishPrice(s, f) * (1 + 0.025 * lvl("bread") + 0.05 * lvl("marketExp"))) * mult;
};

// The fog's crafting fish. The client picks from its own table; until that
// table is ctx-shaped the server keys them off the fish that was caught.
const fogCatch = fish => `fog:${fish.id}`;

function grantXp(s, xp) {
  s.player.xp += xp;
  let need = D.xpToNext(s.player.level);
  while (s.player.xp >= need) {
    s.player.xp -= need;
    s.player.level++;
    s.stats.levelAt[s.player.level] = Math.round(s.stats.play);
    need = D.xpToNext(s.player.level);
  }
}

// ── Intents ────────────────────────────────────────────────────────────────
// Small on purpose. Anything not listed here is still client-side and still
// has to move before the leaderboard can be trusted.
const HANDLERS = {
  // The client's heartbeat. Does nothing but let tick() run.
  tick: () => ({ events: [] }),

  buyUpgrade(s, p) {
    const u = UPG_BY_ID[String(p.id || "")];
    if (!u) return { error: "unknown_upgrade" };
    const lvl = s.upgrades[u.id] || 0;
    if (lvl >= u.max) return { error: "maxed" };
    if (u.lvl > s.player.level) return { error: "locked" };
    const cost = u.costs[lvl];
    if (s.silver < cost) return { error: "too_poor" };
    s.silver -= cost;
    s.upgrades[u.id] = lvl + 1;
    return { events: [{ kind: "bought", id: u.id, level: lvl + 1, cost }] };
  },

  setPick(s, p) {
    const rod = Number(p.rod);
    const fish = FISH_BY_ID[String(p.fish || "")];
    if (!(rod >= 0 && rod < rodCount(s))) return { error: "bad_rod" };
    if (!fish) return { error: "unknown_fish" };
    if (fish.lvl > s.player.level) return { error: "locked" };
    s.picks[rod] = fish.id;
    s.picksBy[s.area] = s.picks.slice();
    return { events: [{ kind: "picked", rod, fish: fish.id }] };
  },

  equipScroll(s, p) {
    const slot = Number(p.slot);
    const key = String(p.key || "");
    if (!(slot >= 0 && slot < 9)) return { error: "bad_slot" };
    if (key && !(s.scrolls[key] > 0)) return { error: "not_owned" };
    // One of each type equippable, so an equipped type blocks its own kind.
    const type = key.split(":")[0];
    if (key && s.scrollEq.some((k, i) => i !== slot && k.startsWith(type + ":")))
      return { error: "type_equipped" };
    s.scrollEq[slot] = key;
    return { events: [{ kind: "equipped", slot, key }] };
  },

  // Silver enters the game here and nowhere else. Sea ravens and fog fish
  // have no price, so they stay out of it exactly as they do in
  // sellAllValue() on the client.
  sellAll(s) {
    let silver = 0;
    for (const kind of ["", "ench", "struck"]) {
      const b = bag(s, kind);
      for (const [id, n] of Object.entries(b)) {
        const f = FISH_BY_ID[id];
        if (!f || !(n > 0)) continue;
        silver += priceOf(s, f, kind) * n;
        b[id] = 0;
      }
    }
    s.silver += silver;
    s.stats.silverEarned += silver;
    return { events: [{ kind: "sold", silver }] };
  },

  setName(s, p) {
    const name = String(p.name || "").trim().slice(0, 16);
    if (!/^[A-Za-z0-9 _-]{2,16}$/.test(name)) return { error: "bad_name" };
    s.player.name = name;
    return { events: [{ kind: "named", name }] };
  },
};

// ── Plausibility ───────────────────────────────────────────────────────────
// Logged, never auto-banned: a false positive that bans a real player costs
// more than a cheater sitting in a review queue for a day.
async function plausibility(env, account, events) {
  const xp = events.reduce((n, e) => n + (e.xp || 0), 0);
  if (xp < 1e9) return;
  await run(env.DB,
    "INSERT INTO flags (account_id, at, kind, detail) VALUES (?, ?, ?, ?)",
    account.id, now(), "xp_spike", JSON.stringify({ xp }));
}
