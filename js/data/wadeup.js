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
  // and cut 30% from that first pass.
  const WADE_UPG = [
    { id: "perseverance", name: "Perseverance", lvl: 54, max: 15, nosplit: true,
      desc: "+0.5% enchanted fish chance per tier.",
      costs: [560000, 700000, 875000, 1090000, 1360000, 1710000, 2140000, 2670000,
              3340000, 4170000, 5220000, 6520000, 8120000, 10200000, 12700000] },
    { id: "darkMatter",   name: "Dark Matter",  lvl: 57, max: 10, nosplit: true,
      desc: "+0.5% sea raven drop chance per tier.",
      costs: [840000, 1080000, 1380000, 1760000, 2250000, 2890000, 3700000,
              4730000, 6060000, 7770000] },
    { id: "ungodly",      name: "Ungodly Presence", lvl: 60, max: 20, nosplit: true,
      desc: "+0.25% lightning strike chance per tier.",
      costs: [420000, 511000, 623000, 763000, 931000, 1130000, 1390000, 1690000,
              2060000, 2510000, 3070000, 3740000, 4560000, 5560000, 6790000,
              8260000, 10100000, 12300000, 15000000, 18300000] },
    { id: "muddyCrate",   name: "Muddy Crate",  lvl: 64, max: 1,
      desc: "Per fish tier, 0.01% for a tier 4 crate and 0.001% for a tier 5.",
      costs: [17500000] },
    { id: "whiteMonster", name: "White Monster", lvl: 66, max: 1,
      desc: "Redbull triggers on 0.1% per fish tier and lasts 5 seconds.",
      costs: [28000000] },
    { id: "cognac",       name: "VS Cognac",    lvl: 68, max: 3, nosplit: true,
      desc: "+0.05x game speed per tier.",
      costs: [39000000, 50000000, 65000000] },
  ];

  WADE_UPG.sort((a, b) => a.lvl - b.lvl);   // listed in unlock order

  D.WADE_UPG = WADE_UPG;
})();
