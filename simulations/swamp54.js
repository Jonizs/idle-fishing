// Swamp run: the game from Lv 54 (the moment Wade opens) to Lv 96. Answers how
// long each level takes there, and what the xp, silver and gold rates look
// like once the pond is finished.
//
// The build it starts from — the state the owner asked about:
//   - every pond upgrade maxed: UPGRADES and POND_UPG. Mutations are bought
//     too but never show up here: they only touch pond fish, and the swamp is
//     fished with swamp fish.
//   - Museum tiers 1, 2 and 3 complete for every rarity, so each museum buff
//     is linear in 1+2+3 = 6. Thunder only has a tier 5 set, so musBolt is 0.
//   - the Thunder set worn in all five slots (tier 5 each): +5% strike chance,
//     and tier 5 in every wornT slot
//   - the swamp's own tree unbought, and bought here as silver allows
//   - no scrolls, and no museum tier 4+
//
// Formulas are resynced with idle-fishing.html, including the two things the
// older sims get loose: the storm is +100% catch speed (not 1.5x), and every
// timer runs on game time, so beerMul makes storms and Focus cycles arrive
// 2.12x faster in real seconds than their nominal length.
//
// Run: node simulations/swamp54.js   (LATE_XP=1.12 TOP=82 to redial and retarget)
const path = require("path");
const DATA = path.join(__dirname, "..", "js", "data");
for (const f of ["fish", "progression", "upgrades", "mutations", "pond", "wadeup"])
  require(path.join(DATA, f + ".js"));
const G = globalThis.GAME_DATA;
const WADE = G.WADE_FISH, WADE_UPG = G.WADE_UPG;

const LATE = +process.env.LATE_XP || G.LATE_XP;
const xpToNext = L =>
  Math.round(9 * Math.pow(L, 1.85) * Math.pow(1.02, L) * (G.EARLY_XP[L] || 1)
             * (L > G.LATE_FROM ? Math.pow(LATE, L - G.LATE_FROM) : 1));

// Arapaima is the last swamp fish at 82, so from there on the rates are flat
// and only the xp curve moves. TOP=82 stops at the last unlock instead.
const START = 54, TOP = +process.env.TOP || 96;
const START_SILVER = +process.env.START_SILVER || 0;

// ── The finished pond build ────────────────────────────────────────────────
// Pond upgrade levels, at max. UPGRADES is already split on load, so u.max is
// the in-play tier count.
const P = {};
for (const u of G.UPGRADES) P[u.id] = u.max;
for (const u of G.POND_UPG)  P[u.id] = u.max;

const MUS = 1 + 2 + 3;                        // museum tiers 1-3, every rarity
const MUS_SPEED = 0.02 * MUS, MUS_GAME = 0.02 * MUS;
const MUS_DBL   = 0.01 * MUS, MUS_ENC  = 0.01 * MUS;
const MUS_BOLT  = 0;                          // Thunder's only set is tier 5

const GEAR_T = 5;                             // Thunder set, tier 5 in all slots
const THUNDER_SUM = 5 * GEAR_T;               // rarSum("thunder")

const STORM_ROLL = 300, STORM_BASE = 300, STORM_DRY = 3000;
const FOCUS_ON = 60, FOCUS_CD = 180;
const STRUCK_MULT = 8, ENCH_MULT = 4, GOLD_PAY = 64;

function sim(opts) {
  const { golden, focusOn } = opts;
  const W = {};                                // swamp upgrade levels
  const wv = id => W[id] || 0;
  const lv = id => P[id] || 0;

  // gold: what the player holds. hooked: only coins pulled off a fish, which
  // is what stats.goldEarned counts — a golden fish pop does not feed it, so
  // the 0.05% pop does not compound.
  let lvl = START, xp = 0, bank = START_SILVER, gold = 0, hooked = 0;
  let t = 0, earned = 0;
  let stT = 0, stRoll = STORM_ROLL, stDry = 0, stormG = 0;
  let rush = 0, fcAct = 0, fcCd = 0, focusG = 0, gameSecs = 0;
  const at = { [START]: 0 }, earnedAt = { [START]: 0 }, bought = [];

  const speedBuffs = () => (0.0175 * (lv("fishingSpeed") + lv("betterLure"))
                            + 0.02 * lv("coffee") + 0.05 * lv("oldSpice")
                            + 0.05 * GEAR_T + MUS_SPEED) * Math.pow(1.01, lv("fert"));
  const speedMul = () => (1 + speedBuffs() + (stT > 0 ? 1 : 0))
                         * (fcAct > 0 ? 1.5 : 1) * (rush > 0 ? 3 : 1);
  const beerMul  = () => 1 + 0.05 * lv("beer") + 0.04 * lv("hardLiquor") + 0.05 * lv("morgan")
                         + 0.05 * wv("cognac") + 0.01 * GEAR_T + MUS_GAME;
  const dbl      = () => 0.005 * lv("doubleDrop") + 0.005 * lv("masterful")
                         + 0.005 * lv("doubleTrouble") + 0.025 * GEAR_T
                         + 0.01 * lv("worms") + MUS_DBL;
  const enc      = () => 0.05 + 0.05 + 0.005 * lv("masterful") + 0.01 * lv("tooShiny")
                         + 0.025 * GEAR_T + 0.01 * lv("plankton") + MUS_ENC
                         + 0.005 * wv("perseverance");
  const bolt     = () => 0.002 * THUNDER_SUM + MUS_BOLT + 0.005 * lv("deafening")
                         + 0.0025 * wv("ungodly");
  const raven    = () => 0.005 * wv("darkMatter");
  const goldCh   = f => 0.0001 * lv("goldFisher") * f.idx * Math.pow(1.1, GEAR_T);
  const baseTime = f => f.time * (1 - 0.025 * lv("machine"));
  const stormLen = () => STORM_BASE + Math.max(0, lv("theStorm") - 1) * 60;
  const rushCh   = () => (wv("whiteMonster") ? 0.001 : 0.0005);
  const rushLen  = () => (wv("whiteMonster") ? 5 : 3.5);

  // Timers all run on game seconds, so they advance beerMul times per real one.
  function stepTimers(g) {
    if (stT > 0) { stT = Math.max(0, stT - g); stormG += g; }
    else { stDry += g; stRoll -= g;
           if (stRoll <= 0) { stRoll = STORM_ROLL;
             if (Math.random() < (stDry >= STORM_DRY ? 1 / 3 : 1 / 10)) { stT = stormLen(); stDry = 0; } } }
    if (rush > 0) rush = Math.max(0, rush - g);
    if (fcAct > 0) { fcAct -= g; focusG += g; if (fcAct <= 0) { fcAct = 0; fcCd = FOCUS_CD; } }
    else if (fcCd > 0) { fcCd = Math.max(0, fcCd - g); }
    else if (focusOn) fcAct = FOCUS_ON;        // clicked the moment it is ready
  }

  // Three rods, and the three best fish unlocked. Price is a flat 5.2x xp for
  // every swamp fish, so the xp pick and the silver pick are the same three.
  // Per-catch yields only move when a level or a purchase lands, so they are
  // cached: the per-second loop then only multiplies by the current speed.
  let C = null;
  const invalidate = () => { C = null; };
  function build() {
    const picks = WADE.filter(f => f.lvl <= lvl)
                      .sort((a, b) => b.xp / b.time - a.xp / a.time).slice(0, 3);
    const d = 1 + dbl(), e = enc(), pB = bolt(), r = 1 + raven();
    // struck beats enchanted, and the storm's 5% only rolls if the bolt missed
    const mk = inStorm => {
      const pS = pB + (1 - pB) * (inStorm ? 0.05 : 0);
      const pE = (1 - pS) * e;
      return { xpM: 1 + (STRUCK_MULT - 1) * pS,
               spM: 1 + (STRUCK_MULT - 1) * pS + (ENCH_MULT - 1) * pE };
    };
    const calm = mk(false), st = mk(true);
    C = { xpCalm: 0, xpStorm: 0, spCalm: 0, spStorm: 0, gp: 0, spawn: 0, rush: 0, silver: 0 };
    for (const f of picks) {
      const rate = 1 / baseTime(f);            // catches per game second at 1x speed
      const price = Math.round(f.price * (1 + 0.025 * lv("bread")));
      const xp1 = f.xp * r * d, sp1 = price * d;
      C.xpCalm  += rate * xp1 * calm.xpM;
      C.xpStorm += rate * xp1 * st.xpM;
      C.spCalm  += rate * sp1 * calm.spM;
      C.spStorm += rate * sp1 * st.spM;
      C.gp      += rate * d * goldCh(f);
      C.spawn   += rate * f.idx / (100 - lv("infest"));   // golden fish, Clones on
      C.rush    += rate * rushCh() * f.idx;
      // what silverRate() reports in game: no struck, and beerMul folded in
      C.silver  += price * d * (1 + (ENCH_MULT - 1) * e) * rate;
    }
    C.dblTrouble = 1 + 0.05 * lv("dblTrouble");
  }

  // Expected yield per real second from what is on the line.
  function rates(g) {
    if (!C) build();
    const k = g * speedMul();                  // catches this real second, per 1/s
    const storm = stT > 0;
    const out = { xps: k * (storm ? C.xpStorm : C.xpCalm),
                  sps: k * (storm ? C.spStorm : C.spCalm),
                  gps: k * C.gp, pops: 0, rushRoll: k * C.rush };
    if (golden) {
      const spawn = k * C.spawn;
      const silverRate = C.silver * speedMul() * g;   // g is beerMul game s per real s
      out.sps  += spawn * 0.5 * Math.max(1, Math.round(silverRate * GOLD_PAY)) * C.dblTrouble;
      out.pops  = spawn * 0.25 * Math.max(1, Math.floor(hooked * 0.0005)) * C.dblTrouble;
    }
    return out;
  }

  const rows = [];
  let lvlT = 0, lvlXp = 0, lvlS = 0, lvlG = 0;
  while (t < 40000 * 3600 && lvl < TOP) {
    const g = beerMul();                               // game seconds this real second
    stepTimers(g);
    gameSecs += g;
    const r = rates(g);
    if (Math.random() < r.rushRoll) rush = rushLen();
    xp += r.xps; bank += r.sps; earned += r.sps;
    hooked += r.gps; gold += r.gps + r.pops;
    lvlXp += r.xps; lvlS += r.sps; lvlG += r.gps + r.pops; lvlT++; t++;
    while (xp >= xpToNext(lvl)) {
      xp -= xpToNext(lvl);
      rows.push({ lvl, secs: lvlT, xps: lvlXp / lvlT, sps: lvlS / lvlT, gph: lvlG / lvlT * 3600 });
      lvlT = 0; lvlXp = 0; lvlS = 0; lvlG = 0;
      lvl++;
      invalidate();
      at[lvl] = t; earnedAt[lvl] = earned;
    }
    for (;;) {
      const o = WADE_UPG.filter(u => wv(u.id) < u.max && lvl >= u.lvl && u.costs[wv(u.id)] <= bank)
                        .sort((a, b) => a.costs[wv(a.id)] - b.costs[wv(b.id)])[0];
      if (!o) break;
      bank -= o.costs[wv(o.id)];
      W[o.id] = wv(o.id) + 1;
      invalidate();
      if (W[o.id] === o.max) bought.push({ name: o.name, t, lvl });
    }
  }
  const left = WADE_UPG.filter(u => wv(u.id) < u.max)
    .map(u => ({ name: u.name, have: wv(u.id), max: u.max,
                 rest: u.costs.slice(wv(u.id)).reduce((s, c) => s + c, 0) }));
  return { rows, at, earnedAt, t, lvl, bank, earned, gold, W, bought, left,
           stormPct: 100 * stormG / gameSecs, focusPct: 100 * focusG / gameSecs };
}

// ── Report ─────────────────────────────────────────────────────────────────
const nf = n => Math.round(n).toLocaleString("en-US");
const hm = s => (s / 3600 >= 10 ? (s / 3600).toFixed(1) + "h"
              : s >= 3600 ? Math.floor(s / 3600) + "h" + String(Math.round(s % 3600 / 60)).padStart(2, "0")
              : Math.round(s / 60) + "m");

function report(label, R) {
  console.log("\n=== " + label + " ===");
  console.log("Lv" + START + " -> Lv" + R.lvl + " in " + (R.t / 3600).toFixed(1) + "h"
              + "   storm uptime " + R.stormPct.toFixed(1) + "%"
              + "   focus uptime " + R.focusPct.toFixed(1) + "%");
  console.log("silver earned " + nf(R.earned) + ", gold earned " + nf(R.gold)
              + ", silver spare at the end " + nf(R.bank));
  console.log("\n lvl        xp/s   silver/s    gold/h     level took    total");
  for (const r of R.rows)
    console.log("  " + String(r.lvl).padStart(2) + "  " + r.xps.toFixed(1).padStart(10)
                + r.sps.toFixed(1).padStart(11) + r.gph.toFixed(1).padStart(10)
                + hm(r.secs).padStart(15) + hm(R.at[r.lvl + 1]).padStart(9));
  console.log("\n swamp tree maxed:");
  for (const b of R.bought)
    console.log("   " + b.name.padEnd(18) + " done at " + hm(b.t).padStart(7) + ", Lv" + b.lvl);
  for (const l of R.left)
    console.log("   " + l.name.padEnd(18) + " stuck at " + l.have + "/" + l.max
                + ", " + nf(l.rest) + " silver short");
}

report("golden fish clicked, Focus on cooldown", sim({ golden: true,  focusOn: true }));
report("fully AFK: no golden fish, no Focus",    sim({ golden: false, focusOn: false }));
