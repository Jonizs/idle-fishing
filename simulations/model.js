// Income model, Lv 32 -> 40, using the game's own formulas.
// Baseline: existing tree fully maxed, T4 hat + T3 rod/line/lure/bait (Standard),
// two rods (Bass + Trout), Focus cycled on cooldown (25% uptime at 1.5x).

const FISH = {
  trout: { xp: 30, time: 22.5, price: 75, idx: 8 },
  bass:  { xp: 50, time: 34.2, price: 140, idx: 9 },
};

const path = require("path");
const DATA = path.join(__dirname, "..", "js", "data");
for (const f of ["fish", "progression", "upgrades", "mutations", "pond"])
  require(path.join(DATA, f + ".js"));
const G = globalThis.GAME_DATA;
const xpToNext = globalThis.GAME_DATA.xpToNext;

// maxed post-split tiers
const M = { fishingSpeed: 10, betterLure: 10, coffee: 20, doubleDrop: 20,
            tooShiny: 10, machine: 10, beer: 6, hardLiquor: 10 };
const T = { rod: 3, line: 3, lure: 3, bait: 3, hat: 4 };
const FOCUS = 1.125;              // 1 min on / 3 min cd at 1.5x

function rates(p) {              // p = pond upgrade levels
  const buffs = 0.0175 * (M.fishingSpeed + M.betterLure) + 0.02 * M.coffee + 0.05 * T.lure;
  const speed = (1 + buffs * Math.pow(1.01, p.fert)) * FOCUS;
  const game  = 1 + 0.05 * M.beer + 0.04 * M.hardLiquor + 0.01 * T.rod;
  const dbl   = 0.005 * M.doubleDrop + 0.025 * T.bait + 0.01 * p.worms;
  const enc   = 0.05 + 0.01 * M.tooShiny + 0.025 * T.hat + 0.01 * p.plankton;
  const bread = 1 + 0.025 * p.bread;

  let xps = 0, sps = 0;
  for (const f of [FISH.bass, FISH.trout]) {
    const t = (f.time * (1 - 0.025 * M.machine) / speed) / game;   // real seconds per catch
    const count = 1 + dbl;
    xps += (f.xp * count) / t;
    sps += (Math.round(f.price * bread) * count * (1 + 3 * enc)) / t;
  }
  return { xps, sps };
}

// Purchase order: Bread -> Plankton -> Worms -> Fertilization.
function run(costs) {
  const p = { bread: 0, plankton: 0, worms: 0, fert: 0 };
  const queue = [];
  for (let i = 0; i < 10; i++) queue.push(["bread", costs.bread[i]]);
  for (let i = 0; i < 10; i++) queue.push(["plankton", costs.plankton[i]]);
  for (let i = 0; i < 10; i++) queue.push(["worms", costs.worms[i]]);
  for (let i = 0; i < 8; i++)  queue.push(["fert", costs.fert[i]]);

  let lvl = 32, xp = 0, silver = 0, t = 0, qi = 0;
  const maxedAt = {}, reached = { 32: 0 };
  const dt = 1;
  while (lvl < 45 && t < 200 * 3600) {
    const r = rates(p);
    xp += r.xps * dt; silver += r.sps * dt; t += dt;
    while (xp >= xpToNext(lvl)) { xp -= xpToNext(lvl); lvl++; reached[lvl] = t; }
    while (qi < queue.length && silver >= queue[qi][1]) {
      silver -= queue[qi][1];
      p[queue[qi][0]]++;
      qi++;
      const k = queue[qi - 1][0];
      const cap = k === "fert" ? 8 : 10;
      if (p[k] === cap) maxedAt[k] = lvl;
    }
  }
  return { reached, maxedAt, p, t };
}

const hm = s => Math.floor(s / 3600) + "h " + String(Math.round(s % 3600 / 60)).padStart(2, "0") + "m";

// Baseline pacing with no pond upgrades at all
{
  const p = { bread: 0, plankton: 0, worms: 0, fert: 0 };
  const r = rates(p);
  console.log("Lv32 baseline:", r.xps.toFixed(1), "xp/s ", r.sps.toFixed(0), "silver/s ",
              (r.sps * 3600 / 1000).toFixed(0) + "k silver/hr");
  const rf = rates({ bread: 10, plankton: 10, worms: 10, fert: 8 });
  console.log("all pond maxed:", rf.xps.toFixed(1), "xp/s ", rf.sps.toFixed(0), "silver/s");
}

console.log("\nXP per level:");
for (let L = 32; L < 40; L++) console.log("  " + L + " ->" + (L + 1), xpToNext(L).toLocaleString());

module.exports = { run, rates, hm, xpToNext };

// ── Golden fish contribution ────────────────────────────────────────────
// Payout is 1% of LIFETIME silverEarned, and popGolden does NOT add to
// silverEarned, so there is no compounding loop.
function goldenSilverPerSec(lifetime, infest, dbl, clickRate) {
  const speedFull = rates({bread:10,plankton:10,worms:10,fert:8});
  // spawn attempts: one roll per catch, per rod
  const game = 1 + 0.05*6 + 0.04*10 + 0.01*3;
  const buffs = 0.0175*20 + 0.02*20 + 0.05*3;
  const spd = (1 + buffs) * 1.125;
  let attempts = 0;
  for (const f of [{time:34.2,idx:9},{time:22.5,idx:8}]) {
    const t = (f.time * 0.75 / spd) / game;
    attempts += (f.idx / (100 - 5*infest)) / t;
  }
  const life = 10;                       // GOLD_LIFE, one on screen at a time
  const rate = Math.min(attempts, 1/life);   // guard: one at a time
  const perPop = 0.5 * 0.01 * lifetime * (1 + 0.05*dbl);
  return { spawnsPerHr: rate*3600, silverPerSec: rate * perPop * clickRate };
}
for (const life of [600000, 1500000, 3000000]) {
  const a = goldenSilverPerSec(life, 0, 0, 1);
  const b = goldenSilverPerSec(life, 10, 8, 1);
  console.log("lifetime " + (life/1e6).toFixed(1) + "M:",
    a.spawnsPerHr.toFixed(0) + " spawns/hr,",
    "silver/s " + a.silverPerSec.toFixed(0) + " -> " + b.silverPerSec.toFixed(0) + " (maxed)",
    "| base fishing is 75/s");
}
