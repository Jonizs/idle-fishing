// Data table. Loaded before the game script and shared with the tools in
// simulations/, so there is exactly one copy of these numbers.
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // ── Wade upgrades ────────────────────────────────────────────────────────
  // The swamp's own tree, shown in the Upgrades tab while you are standing in
  // it. Its buffs stack with the pond's rather than replacing them.
  //
  // Every line is nosplit, unlike the pond tree: the tier counts here were
  // specified directly, so the listed cost is the cost actually charged.
  //
  // Prices are a first pass sized against the Lv 54-82 window, not modelled,
  // and cut 44% from that first pass.
  const WADE_UPG = [
    { id: "perseverance", name: "Perseverance", lvl: 54, max: 15, nosplit: true,
      desc: "+0.5% enchanted fish chance per tier.",
      costs: [448000, 560000, 700000, 872000, 1090000, 1370000, 1710000, 2140000,
              2670000, 3340000, 4180000, 5220000, 6500000, 8160000, 10200000] },
    { id: "darkMatter",   name: "Dark Matter",  lvl: 57, max: 10, nosplit: true,
      desc: "+0.5% sea raven drop chance per tier.",
      costs: [672000, 864000, 1100000, 1410000, 1800000, 2310000, 2960000,
              3780000, 4850000, 6220000] },
    { id: "ungodly",      name: "Ungodly Presence", lvl: 60, max: 20, nosplit: true,
      desc: "+0.25% lightning strike chance per tier.",
      costs: [336000, 409000, 498000, 610000, 745000, 904000, 1110000, 1350000,
              1650000, 2010000, 2460000, 2990000, 3650000, 4450000, 5430000,
              6610000, 8080000, 9840000, 12000000, 14600000] },
    { id: "muddyCrate",   name: "Muddy Crate",  lvl: 64, max: 1,
      desc: "Per fish tier, 0.01% for a tier 4 crate and 0.001% for a tier 5.",
      costs: [14000000] },
    { id: "whiteMonster", name: "White Monster", lvl: 66, max: 1,
      desc: "Redbull triggers on 0.1% per fish tier and lasts 5 seconds.",
      costs: [22400000] },
    { id: "quatro",       name: "Quatro",       lvl: 67, max: 1,
      desc: "Fish four different fish at the same time.",
      costs: [33600000] },
    { id: "cognac",       name: "VS Cognac",    lvl: 68, max: 3, nosplit: true,
      desc: "+0.05x game speed per tier.",
      costs: [31200000, 40000000, 52000000] },
    { id: "resonance",    name: "Resonance",    lvl: 68, max: 10, nosplit: true,
      desc: "+0.5% chance per tier that a catch pays double XP.",
      costs: [4480000, 5710000, 7280000, 9300000, 11900000, 15100000, 19300000,
              24600000, 31400000, 40000000] },
  ];

  WADE_UPG.sort((a, b) => a.lvl - b.lvl);   // listed in unlock order

  D.WADE_UPG = WADE_UPG;
})();
