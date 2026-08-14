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
  // Prices are a first pass sized against the Lv 54-82 window, not modelled.
  const WADE_UPG = [
    { id: "perseverance", name: "Perseverance", lvl: 54, max: 15, nosplit: true,
      desc: "+0.5% enchanted fish chance per tier.",
      costs: [800000, 1000000, 1250000, 1560000, 1950000, 2440000, 3050000, 3810000,
              4770000, 5960000, 7450000, 9310000, 11600000, 14600000, 18200000] },
    { id: "darkMatter",   name: "Dark Matter",  lvl: 57, max: 10, nosplit: true,
      desc: "+0.5% sea raven drop chance per tier.",
      costs: [1200000, 1540000, 1970000, 2520000, 3220000, 4130000, 5280000,
              6760000, 8650000, 11100000] },
    { id: "ungodly",      name: "Ungodly Presence", lvl: 60, max: 20, nosplit: true,
      desc: "+0.25% lightning strike chance per tier.",
      costs: [600000, 730000, 890000, 1090000, 1330000, 1620000, 1980000, 2410000,
              2940000, 3590000, 4380000, 5340000, 6520000, 7950000, 9700000,
              11800000, 14400000, 17600000, 21500000, 26200000] },
    { id: "muddyCrate",   name: "Muddy Crate",  lvl: 64, max: 1,
      desc: "Per fish tier, 0.01% for a tier 4 crate and 0.001% for a tier 5.",
      costs: [25000000] },
    { id: "whiteMonster", name: "White Monster", lvl: 66, max: 1,
      desc: "Redbull triggers on 0.1% per fish tier and lasts 5 seconds.",
      costs: [40000000] },
    { id: "quatro",       name: "Quatro",       lvl: 67, max: 1,
      desc: "Fish four different fish at the same time.",
      costs: [60000000] },
    { id: "resonance",    name: "Resonance",    lvl: 68, max: 10, nosplit: true,
      desc: "+0.5% chance per tier that a catch pays double XP.",
      costs: [8000000, 10200000, 13000000, 16600000, 21200000, 27000000, 34500000,
              44000000, 56000000, 71500000] },
  ];

  WADE_UPG.sort((a, b) => a.lvl - b.lvl);   // listed in unlock order

  D.WADE_UPG = WADE_UPG;
})();
