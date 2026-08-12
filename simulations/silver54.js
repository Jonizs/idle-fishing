// Silver run, Lv 1 -> 54. Answers one question: with every upgrade and pond
// line bought as soon as it is affordable, how much silver is still missing
// when the player hits 54?
//
// Differences from curve.js, which this is forked from:
//   - formulas resynced with idle-fishing.html (oldSpice, morgan, masterful,
//     extremelyShiny, doubleTrouble, ascended-hat enchant)
//   - Museum tiers 1 and 2 are complete from the start, and never grow. Every
//     museum buff is linear in the summed tier, so that is a flat 1+2 = 3.
//   - runs to 54 and reports silver, not the xp curve
// Still absent, so this is the poor end of the range: scrolls, gear rarity
// (gear is tiers only), museum tiers 3-10.
const path = require("path");
const DATA = path.join(__dirname, "..", "js", "data");
for (const f of ["fish", "progression", "upgrades", "mutations", "pond"])
  require(path.join(DATA, f + ".js"));
const G = globalThis.GAME_DATA;
const FISH = G.FISH;
const UP   = G.UPGRADES.slice().sort((a, b) => a.lvl - b.lvl);   // already split
const POND = G.POND_UPG, MUT = G.MUTATE, tierLvl = G.tierLvl;
// LATE_XP is the dial for how long the Lv32+ tail takes. Overridable so the
// curve and the prices can be solved together: LATE_XP=1.14 node silver54.js
const LATE = +process.env.LATE_XP || G.LATE_XP;
const xpToNext = L =>
  Math.round(9 * Math.pow(L, 1.85) * Math.pow(1.02, L) * (G.EARLY_XP[L] || 1)
             * (L > G.LATE_FROM ? Math.pow(LATE, L - G.LATE_FROM) : 1));
const GEAR = { rod: 3, line: 3, lure: 3, bait: 3, hat: 4 };
const PAY = 64, GAP = 12;
const STORM_ROLL = 300, STORM_BASE = 300, STORM_DRY = 3000, STRUCK = 8, RUSH_ON = 3.5;
const TOP = 54;

// Museum: tiers 1 and 2 complete for every rarity. Thunder only has a tier 5
// set, so it stays empty and musBolt is 0.
const MUS = 3;
const MUS_SPEED = 0.02 * MUS, MUS_GAME = 0.02 * MUS;
const MUS_DBL   = 0.01 * MUS, MUS_ENC  = 0.01 * MUS;

function sim(clickGolden) {
  const L = {}, mutd = {};
  const lv = id => L[id] || 0;
  const paneLvl = { food: 32, fly: 35, storm: 44 };
  const all = [...UP.map(u => ({ u, kind: "up" })), ...POND.map(u => ({ u, kind: "pond" })),
               ...MUT.map(m => ({ u: { id: "mut:" + m.id, max: 1, costs: [m.cost], lvl: m.lvl }, kind: "mut", m }))];
  let lvl = 1, xp = 0, bank = 0, t = 0, earned = 0, lastAtt = 0;
  const at = { 1: 0 }, earnedAt = { 1: 0 };
  let stT = 0, stRoll = STORM_ROLL, stDry = 0, rush = 0, stormSecs = 0;

  const speed = () => 1 + (0.0175 * (lv("fishingSpeed") + lv("betterLure")) + 0.02 * lv("coffee")
                           + 0.05 * lv("oldSpice") + 0.05 * GEAR.lure + MUS_SPEED)
                          * Math.pow(1.01, lv("fert"));
  const game  = () => 1 + 0.05 * lv("beer") + 0.04 * lv("hardLiquor") + 0.05 * lv("morgan")
                        + 0.01 * GEAR.rod + MUS_GAME;
  const dbl   = () => 0.005 * lv("doubleDrop") + 0.005 * lv("masterful") + 0.005 * lv("doubleTrouble")
                        + 0.025 * GEAR.bait + 0.01 * lv("worms") + MUS_DBL;
  const enc   = () => (lv("enchanted") ? 0.05 : 0) + (lv("extremelyShiny") ? 0.05 : 0)
                        + 0.005 * lv("masterful") + 0.01 * lv("tooShiny")
                        + 0.025 * GEAR.hat + 0.01 * lv("plankton") + MUS_ENC;
  const rods  = () => lv("trifecta") ? 3 : lv("twoRods") ? 2 : 1;
  const focus = () => lv("focus") ? 1.125 : 1;
  const stormLen = () => STORM_BASE + Math.max(0, lv("theStorm") - 1) * 60;
  const boltChance = () => 0.005 * lv("deafening");

  function stepEvents(dt) {
    if (stT > 0) { stT -= dt; if (stT < 0) stT = 0; stormSecs += dt; }
    else if (lv("theStorm")) {
      stDry += dt; stRoll -= dt;
      if (stRoll <= 0) {
        stRoll = STORM_ROLL;
        if (Math.random() < (stDry >= STORM_DRY ? 1 / 3 : 1 / 10)) { stT = stormLen(); stDry = 0; }
      }
    }
    if (rush > 0) rush = Math.max(0, rush - dt);
  }

  function rates() {
    const avail = FISH.filter(f => f.lvl <= lvl);
    const picks = avail.slice(-rods());
    let xps = 0, sps = 0, att = 0;
    for (const f of picks) {
      const m = mutd[f.id] ? MUT.find(x => x.id === f.id) : null;
      const fxp = m ? m.xp : f.xp, fpr = m ? m.price : f.price;
      const tt = (f.time * (1 - 0.025 * lv("machine"))
                  / (speed() * focus() * (stT > 0 ? 1.5 : 1) * (rush > 0 ? 3 : 1))) / game();
      const pStruck = (stT > 0 ? 0.05 : 0) + boltChance();
      const mult = 1 + pStruck * (STRUCK - 1);
      xps += (fxp * (1 + dbl()) * mult) / tt;
      sps += (Math.round(fpr * (1 + 0.025 * lv("bread"))) * (1 + dbl()) * (1 + 3 * enc()) * mult) / tt;
      if (lv("redbull") && Math.random() < 0.0005 * f.idx * (1 / tt)) rush = RUSH_ON;
      att += (f.idx / (100 - lv("infest"))) / tt;
    }
    if (clickGolden) {
      const R = lv("clones") ? att : 1 / (GAP + 1 / Math.max(att, 1e-9));
      sps *= 1 + R * 0.5 * PAY * (1 + 0.05 * lv("dblTrouble"));
    }
    return { xps, sps, att };
  }

  while (t < 20000 * 3600 && lvl < TOP) {
    stepEvents(1);
    const r = rates();
    xp += r.xps; bank += r.sps; earned += r.sps; t++; lastAtt = r.att;
    while (xp >= xpToNext(lvl)) {
      xp -= xpToNext(lvl); lvl++;
      if (at[lvl] === undefined) { at[lvl] = t; earnedAt[lvl] = earned; }
    }
    for (;;) {
      const opts = all.filter(o => {
        const c = o.kind === "mut" ? (mutd[o.m.id] ? 1 : 0) : lv(o.u.id);
        if (c >= o.u.max) return false;
        const need = o.kind === "pond" ? paneLvl[o.u.pane]
                   : o.u.lvl !== undefined && o.kind === "mut" ? o.u.lvl : tierLvl(o.u, c);
        return lvl >= need && o.u.costs[c] <= bank;
      }).sort((a, b) => a.u.costs[a.kind === "mut" ? 0 : lv(a.u.id)] - b.u.costs[b.kind === "mut" ? 0 : lv(b.u.id)]);
      if (!opts.length) break;
      const o = opts[0];
      if (o.kind === "mut") { bank -= o.u.costs[0]; mutd[o.m.id] = true; }
      else { bank -= o.u.costs[lv(o.u.id)]; L[o.u.id] = lv(o.u.id) + 1; }
    }
  }

  // What is still unbought, and what the rest of it would have cost.
  const left = [];
  for (const o of all) {
    const c = o.kind === "mut" ? (mutd[o.m.id] ? 1 : 0) : lv(o.u.id);
    if (c >= o.u.max) continue;
    let rest = 0;
    for (let i = c; i < o.u.max; i++) rest += o.u.costs[i];
    left.push({ id: o.u.id, name: o.u.name || o.u.id, have: c, max: o.u.max, rest });
  }
  left.sort((a, b) => b.rest - a.rest);
  return { at, earnedAt, t, lvl, bank, earned, left, lastAtt, L,
           stormPct: 100 * stormSecs / t };
}

const nf = n => Math.round(n).toLocaleString("en-US");

// Golden fish: how much silver does a pop add, as a multiple of AFK income?
// A silver pop pays GOLD_PAY seconds of current income and is 50% of the roll,
// so the ratio is simply spawnRate * 0.5 * GOLD_PAY * doubleTrouble.
// att already carries Infestation. Clones removes the one-at-a-time gate.
function goldenReport(att, infest, label) {
  const raw  = att * (100 - infest) / 100;            // attempts with Infestation 0
  const bare = 1 / (GAP + 1 / Math.max(raw, 1e-9));   // no Clones: gated to ~1/12s
  const full = raw * 100 / 90;                        // Clones lifts the gate, Infest 10
  const dblFull = 1 + 0.05 * 8;                       // Double Trouble maxed
  const add = (r, m) => r * 0.5 * PAY * m;
  console.log("\n--- golden fish (" + label + ") ---");
  console.log("attempt rate " + raw.toFixed(4) + "/s at Infestation 0");
  console.log("  no fly upgrades : spawn " + bare.toFixed(4) + "/s -> adds " + add(bare, 1).toFixed(2) + "x AFK");
  console.log("  all fly upgrades: spawn " + full.toFixed(4) + "/s -> adds " + add(full, dblFull).toFixed(2) + "x AFK");
  console.log("  GOLD_PAY for +1.0x at base: " + (1 / (bare * 0.5)).toFixed(0) + "s");
  console.log("  GOLD_PAY for +2.0x maxed  : " + (2 / (full * 0.5 * dblFull)).toFixed(0) + "s");
}

for (const golden of [true, false]) {
  const R = sim(golden);
  const missing = R.left.reduce((s, x) => s + x.rest, 0);
  console.log("\n=== " + (golden ? "with golden fish" : "no golden fish") + " ===");
  console.log("Lv" + R.lvl + " reached at " + (R.t / 3600).toFixed(1) + "h, storm uptime "
              + R.stormPct.toFixed(1) + "%");
  console.log("silver earned " + nf(R.earned) + ", left in bank " + nf(R.bank));
  console.log("still unbought: " + nf(missing) + " silver across " + R.left.length + " lines");
  for (const l of [46, 50, 52, 54])
    if (R.at[l] !== undefined)
      console.log("   at Lv" + l + ": " + (R.at[l] / 3600).toFixed(1) + "h, earned so far " + nf(R.earnedAt[l]));
  if (R.earnedAt[50] !== undefined)
    console.log("   Lv50->54 window earns " + nf(R.earned - R.earnedAt[50]));
  goldenReport(R.lastAtt, R.L.infest || 0, golden ? "golden build" : "no-golden build");
  for (const x of R.left.slice(0, 8))
    console.log("   " + x.name + "  " + x.have + "/" + x.max + "  needs " + nf(x.rest));
}
