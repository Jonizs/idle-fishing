// Prices the three unmodelled tables — Mutations, The Storm, Lightning Crate —
// against the game's own formulas, using marginal payback as the yardstick.
const path = require("path");
const DATA = path.join(__dirname, "..", "js", "data");
for (const f of ["fish", "progression", "upgrades", "mutations", "pond"])
  require(path.join(DATA, f + ".js"));
const G = globalThis.GAME_DATA;
const FISH = G.FISH, UP = G.UPGRADES, POND = G.POND_UPG, MUTATE = G.MUTATE;
const MUT = G.MUT;
const P = Object.fromEntries(POND.map(u => [u.id, u]));
const U = Object.fromEntries(UP.map(u => [u.id, u]));

const FOCUS = 1.125, STRUCK = 8, ENCH = 4;
const GEAR = { rod: 3, line: 3, lure: 3, bait: 3, hat: 4 };   // pinned, as in curve.js

// ── the game's rate formulas ────────────────────────────────────────────────
// s: { lv:{id->tier}, mut:{id->true}, worn:{kind->{r,t}}, museumThunder:bool }
function rates(s, storm) {
  const lv = id => s.lv[id] || 0;
  const wt = k => s.worn[k].t;
  const rarSum = r => Object.values(s.worn).reduce((n, w) => n + (w.r === r ? w.t : 0), 0);

  const speed = (1 + (0.0175 * (lv("fishingSpeed") + lv("betterLure")) + 0.02 * lv("coffee")
                 + 0.05 * wt("lure") + 0.025 * rarSum("enchanted"))
                 * Math.pow(1.01, lv("fert")))
                * FOCUS * (storm ? 1.5 : 1);
  const game = 1 + 0.05 * lv("beer") + 0.04 * lv("hardLiquor") + 0.01 * wt("rod")
             + 0.01 * rarSum("refined");
  const dbl = 0.005 * lv("doubleDrop") + 0.025 * wt("bait") + 0.02 * rarSum("awakened")
            + 0.01 * lv("worms");
  const enc = (lv("enchanted") ? 0.05 : 0) + 0.01 * lv("tooShiny") + 0.025 * wt("hat")
            + 0.03 * rarSum("ascended") + 0.01 * lv("plankton");
  const bolt = 0.002 * rarSum("thunder") + (s.museumThunder ? 0.02 : 0) + 0.005 * lv("deafening");
  const bread = 1 + 0.025 * lv("bread");

  // bolt is rolled first, then the storm's own 5%, then enchanted — exclusive.
  const pStruck = bolt + (1 - bolt) * (storm ? 0.05 : 0);
  const pEnch = (1 - pStruck) * Math.min(enc, 1);
  const xpMult = 1 + pStruck * (STRUCK - 1);                       // ench gives no xp
  const silMult = pStruck * STRUCK + pEnch * ENCH + (1 - pStruck - pEnch);

  const per = f => {
    const t = (f.time * (1 - 0.025 * lv("machine")) / speed) / game;
    const fxp = s.mut[f.id] ? MUT[f.id].xp : f.xp;
    const fpr = s.mut[f.id] ? MUT[f.id].price : f.price;
    return {
      f,
      xps: fxp * (1 + dbl) * xpMult / t,
      sps: Math.round(fpr * bread) * (1 + dbl) * silMult / t,
      catches: (1 + dbl) / t,
      goldSpawn: (f.idx / (100 - lv("infest"))) / t,
      crates: storm ? (0.0001 * lv("lightCrate") * f.idx * (1 + dbl)) / t : 0,
    };
  };
  return FISH.filter(f => f.lvl <= s.level).map(per);
}

// Golden fish: 139s of current earnings per pop, spawn-limited to one per 12s
// without Clones. Clicked, as the balance model assumes.
const PAY = 139, GAP = 12;
function withGolden(s, r) {
  const lv = id => s.lv[id] || 0;
  const att = r.reduce((a, p) => a + p.goldSpawn, 0);
  const R = lv("clones") ? att : 1 / (GAP + 1 / Math.max(att, 1e-9));
  return 1 + R * 0.5 * PAY * (1 + 0.05 * lv("dblTrouble"));
}

// Pick the best `rods` fish. Ranking by fish is fixed under every shared
// multiplier, so this only moves when a fish unlocks or is mutated.
function best(s, storm, rods, metric) {
  const r = rates(s, storm);
  const scored = r.map(p => ({ p, v: metric === "xp" ? p.xps : metric === "sil" ? p.sps
                                : Math.sqrt(p.xps * p.sps) }));
  scored.sort((a, b) => b.v - a.v);
  return scored.slice(0, rods).map(x => x.p);
}

// Income averaged over storm uptime, with golden fish folded in.
function income(s, metric = "mix") {
  const rods = (s.lv.trifecta ? 3 : s.lv.twoRods ? 2 : 1);
  const u = s.lv.theStorm ? uptime(s.lv.theStorm) : 0;
  let xps = 0, sps = 0, crates = 0;
  for (const [storm, w] of [[false, 1 - u], [true, u]]) {
    if (w <= 0) continue;
    const picks = best(s, storm, rods, metric);
    const gm = withGolden(s, picks);
    xps += w * picks.reduce((a, p) => a + p.xps, 0);
    sps += w * picks.reduce((a, p) => a + p.sps, 0) * gm;
    crates += w * picks.reduce((a, p) => a + p.crates, 0);
  }
  return { xps, sps, cratesPerHr: crates * 3600, picks: best(s, false, rods, metric).map(p => p.f.name) };
}

// ── storm uptime ────────────────────────────────────────────────────────────
const STORM_ROLL = 300, STORM_BASE = 300, STORM_DRY = 3000;
function uptime(tier) {                       // exact, by the roll process
  const len = STORM_BASE + Math.max(0, tier - 1) * 60;
  // rolls every 300s; 1/10 until 3000s dry (10 rolls), then 1/3
  let p = 1, e = 0;                            // e = expected dry seconds
  for (let k = 1; k <= 400; k++) {
    const pr = k <= 10 ? 0.1 : 1 / 3;
    e += p * pr * k * STORM_ROLL;
    p *= 1 - pr;
  }
  return len / (len + e);
}

// ── reference state ─────────────────────────────────────────────────────────
// Level 44: main tree maxed, Fish Food and Flying Fish maxed, gear pinned.
function ref(over = {}) {
  const lv = {};
  for (const u of UP) lv[u.id] = u.max;
  for (const id of ["bread", "plankton", "worms", "fert", "clones", "strongRod", "infest", "dblTrouble"])
    lv[id] = P[id].max;
  lv.theStorm = 0; lv.lightCrate = 0;
  const s = {
    level: 44, lv: Object.assign(lv, over.lv || {}), mut: over.mut || {},
    worn: { rod: { r: "std", t: GEAR.rod }, line: { r: "std", t: GEAR.line },
            lure: { r: "std", t: GEAR.lure }, bait: { r: "std", t: GEAR.bait },
            hat: { r: "std", t: GEAR.hat } },
    museumThunder: false,
  };
  if (over.worn) Object.assign(s.worn, over.worn);
  if (over.museumThunder) s.museumThunder = true;
  return s;
}
const clone = s => ({ level: s.level, lv: { ...s.lv }, mut: { ...s.mut },
                      worn: JSON.parse(JSON.stringify(s.worn)), museumThunder: s.museumThunder });

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "k" : n.toFixed(0);
const hm = s => s >= 3600 ? (s / 3600).toFixed(1) + "h" : Math.round(s / 60) + "m";

// ── calibration: payback of the already-tuned tables ────────────────────────
function payback(id, tiers, costs, base) {
  const out = [];
  const s = clone(base);
  s.lv[id] = 0;
  let prev = income(s).sps;
  for (let k = 0; k < tiers; k++) {
    s.lv[id] = k + 1;
    const now = income(s).sps;
    out.push({ k: k + 1, cost: costs[k], d: now - prev, pay: costs[k] / Math.max(now - prev, 1e-9) });
    prev = now;
  }
  return out;
}

console.log("== calibration: shipped, already-tuned pond upgrades ==");
console.log("   (payback = seconds of total silver income to repay that tier)\n");
const calBase = ref();
for (const id of ["bread", "plankton", "worms", "fert", "infest", "dblTrouble"]) {
  const rows = payback(id, P[id].max, P[id].costs, calBase);
  const tot = rows.reduce((a, r) => a + r.cost, 0);
  const totD = rows.reduce((a, r) => a + r.d, 0);
  console.log(P[id].name.padEnd(15), "total", fmt(tot).padStart(6),
    " +" + totD.toFixed(0).padStart(5) + " silver/s ",
    " payback: first tier " + hm(rows[0].pay).padStart(5) + ", last " + hm(rows[rows.length - 1].pay).padStart(5) +
    ", whole line " + hm(tot / totD));
}
{
  const s = clone(calBase); s.lv.clones = 0; const a = income(s).sps;
  s.lv.clones = 1; const b = income(s).sps;
  console.log("Clones".padEnd(15), "total", fmt(P.clones.costs[0]).padStart(6),
    " +" + (b - a).toFixed(0).padStart(5) + " silver/s  payback: " + hm(P.clones.costs[0] / (b - a)));
}

// ── 1. The Storm ────────────────────────────────────────────────────────────
console.log("\n\n== 1. The Storm — 10 tiers, " + fmt(P.theStorm.costs.reduce((a, b) => a + b, 0)) + " ==\n");
console.log(" tier   len   uptime   silver/s     xp/s     cost   marginal payback");
{
  const s = clone(calBase);
  let prevS = income(s).sps, prevX = income(s).xps;
  const base = { s: prevS, x: prevX };
  for (let k = 1; k <= 10; k++) {
    s.lv.theStorm = k;
    const r = income(s);
    const cost = P.theStorm.costs[k - 1];
    console.log(String(k).padStart(5),
      String(300 + (k - 1) * 60).padStart(5) + "s",
      (100 * uptime(k)).toFixed(1).padStart(6) + "%",
      r.sps.toFixed(0).padStart(10), r.xps.toFixed(2).padStart(9),
      fmt(cost).padStart(8), hm(cost / (r.sps - prevS)).padStart(10));
    prevS = r.sps; prevX = r.xps;
  }
  const full = income(s);
  console.log("\n  whole line: +" + (100 * (full.sps / base.s - 1)).toFixed(0) + "% silver, +" +
    (100 * (full.xps / base.x - 1)).toFixed(0) + "% xp, payback " +
    hm(P.theStorm.costs.reduce((a, b) => a + b, 0) / (full.sps - base.s)));
}

// ── 2. Mutations ────────────────────────────────────────────────────────────
console.log("\n\n== 2. Mutations — 9, " + fmt(MUTATE.reduce((a, m) => a + m.cost, 0)) + " ==\n");
{
  // Each mutation is bought at the level that unlocks it, so the rod count and
  // the fish already unlocked are whatever they are at that moment.
  const rodsAt = L => (L >= 44 ? 3 : L >= 19 ? 2 : 1);
  console.log(" gate  fish          cost   rods   silver/s before -> after   payback   picks after");
  const s = clone(calBase); s.lv.theStorm = 5;
  for (const m of MUTATE) {
    const L = Math.min(m.lvl, 52);
    s.level = L; s.lv.trifecta = rodsAt(m.lvl) === 3 ? 1 : 0;
    const before = income(s);
    const t = clone(s); t.mut[m.id] = true;
    const after = income(t);
    const d = after.sps - before.sps;
    s.mut[m.id] = true;                       // keep them, cumulative
    console.log(String(m.lvl).padStart(4), " " + FISH.find(f => f.id === m.id).name.padEnd(12),
      fmt(m.cost).padStart(6), String(rodsAt(m.lvl)).padStart(5),
      before.sps.toFixed(0).padStart(12) + " ->" + after.sps.toFixed(0).padStart(7),
      (d > 1 ? hm(m.cost / d) : "no gain").padStart(10),
      "   " + after.picks.join(", "));
  }
  console.log("\n  With three rods only three fish are ever being fished, so once the best");
  console.log("  three are mutated every further mutation is worth exactly nothing.");
  const a = clone(calBase); a.lv.theStorm = 5; a.level = 52;
  const b = clone(a); b.mut = { lanternfish: true, grasscarp: true, herring: true };
  const c = clone(a); for (const m of MUTATE) c.mut[m.id] = true;
  const ra = income(a), rb = income(b), rc = income(c);
  console.log("  none: " + ra.sps.toFixed(0) + " silver/s | best three (610k): " + rb.sps.toFixed(0) +
    " | all nine (12.15M): " + rc.sps.toFixed(0));
  console.log("  Golden fish, lightning crates and Redbull all scale with fish tier, so");
  console.log("  fishing mutated low fish gives some of it back: golden multiplier " +
    withGolden(a, best(a, false, 3, "mix")).toFixed(2) + "x -> " +
    withGolden(c, best(c, false, 3, "mix")).toFixed(2) + "x.");
}

// ── 3. Lightning Crate ──────────────────────────────────────────────────────
console.log("\n\n== 3. Lightning Crate — 5 tiers, " + fmt(P.lightCrate.costs.reduce((a, b) => a + b, 0)) + " ==\n");
{
  const s = clone(calBase); s.lv.theStorm = 5;
  console.log(" tier     cost   crates/hr   hrs to wear 5   hrs to +museum set");
  for (let k = 1; k <= 5; k++) {
    s.lv.lightCrate = k;
    const c = income(s).cratesPerHr;
    // random slot each: coupon collector for 5 distinct = 5*H5 = 11.42 crates,
    // then 5 more of any kind to fill the museum rail (dupes are fine there)
    const collect = 5 * (1 + 1 / 2 + 1 / 3 + 1 / 4 + 1 / 5);
    console.log(String(k).padStart(5), fmt(P.lightCrate.costs[k - 1]).padStart(8),
      c.toFixed(1).padStart(11), (collect / c).toFixed(1).padStart(14),
      ((collect + 5 * 2.28) / c).toFixed(1).padStart(19));
  }
  // what the gear is worth once worn
  const worn5 = { rod: { r: "thunder", t: 5 }, line: { r: "thunder", t: 5 }, lure: { r: "thunder", t: 5 },
                  bait: { r: "thunder", t: 5 }, hat: { r: "thunder", t: 5 } };
  const a = clone(s); a.lv.lightCrate = 5;
  const b = clone(a); b.worn = JSON.parse(JSON.stringify(worn5));
  const c = clone(b); c.museumThunder = true;
  const ra = income(a), rb = income(b), rc = income(c);
  console.log("\n  worn Thunder T5 in all five slots (over pinned std T3/T4):");
  console.log("    silver/s " + ra.sps.toFixed(0) + " -> " + rb.sps.toFixed(0) +
    "  (+" + (100 * (rb.sps / ra.sps - 1)).toFixed(0) + "%),  xp/s " +
    ra.xps.toFixed(2) + " -> " + rb.xps.toFixed(2) + "  (+" + (100 * (rb.xps / ra.xps - 1)).toFixed(0) + "%)");
  console.log("  plus the donated Thunder museum set (+2% strike):");
  console.log("    silver/s -> " + rc.sps.toFixed(0) + "  (+" + (100 * (rc.sps / ra.sps - 1)).toFixed(0) +
    "% over no crates),  xp/s -> " + rc.xps.toFixed(2) + "  (+" + (100 * (rc.xps / ra.xps - 1)).toFixed(0) + "%)");
  const tot = P.lightCrate.costs.reduce((x, y) => x + y, 0);
  console.log("\n  whole line payback once the set is worn and donated: " + hm(tot / (rc.sps - ra.sps)));
  console.log("  (tier 1 alone reaches the same end state, just slower — the tiers buy");
  console.log("   time-to-set, not a higher ceiling.)");
}
