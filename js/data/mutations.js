// Data table. Loaded before the game script and shared with the tools in
// simulations/, so there is exactly one copy of these numbers.
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // Fish Breeder: a mutated fish keeps its own catch time but is worth more
  // XP/s and silver than the rung above it, so the mutated ladder sits on top
  // of the base one. Gates start at Lv 38 and step +2 per fish.
  const MUTATE = [
    { id: "lanternfish", lvl: 38, xp: 7,  price: 158, cost: 360000 },
    { id: "grasscarp",   lvl: 40, xp: 12, price: 178, cost: 570000 },
    { id: "herring",     lvl: 42, xp: 17, price: 201, cost: 900000 },
    { id: "pollock",     lvl: 44, xp: 23, price: 227, cost: 1410000 },
    { id: "mackerel",    lvl: 46, xp: 29, price: 256, cost: 2220000 },
    { id: "sardine",     lvl: 48, xp: 36, price: 289, cost: 3480000 },
    { id: "silvercarp",  lvl: 50, xp: 43, price: 327, cost: 5460000 },
    { id: "trout",       lvl: 52, xp: 50, price: 369, cost: 8580000 },
    { id: "bass",        lvl: 54, xp: 79, price: 416, cost: 13470000 },
  ];
  const MUT = Object.fromEntries(MUTATE.map(m => [m.id, m]));

  D.MUTATE = MUTATE;
  D.MUT = MUT;
})();
