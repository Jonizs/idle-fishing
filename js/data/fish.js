// Data table. Loaded before the game script and shared with the tools in
// simulations/, so there is exactly one copy of these numbers.
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // ── Fish table ───────────────────────────────────────────────────────────
  const FISH = [
    { id: "lanternfish", name: "Sardine",     xp: 1,  time: 4.5,  lvl: 1,  price: 2,   col: "#6fb5c9" },
    { id: "grasscarp",   name: "Grass Carp",  xp: 2,  time: 7.2,  lvl: 2,  price: 4,   col: "#7ea34a" },
    { id: "herring",     name: "Herring",     xp: 5,  time: 9.9, lvl: 4,  price: 9,   col: "#b9c3cc" },
    { id: "pollock",     name: "Pollock",     xp: 9,  time: 12.6, lvl: 6,  price: 16,  col: "#a08a63" },
    { id: "mackerel",    name: "Mackerel",    xp: 15, time: 15.3, lvl: 9,  price: 28,  col: "#4f7fa8" },
    { id: "sardine",     name: "Anchovy",     xp: 20, time: 18, lvl: 14, price: 40,  col: "#ccd2d8" },
    { id: "silvercarp",  name: "Silver Carp", xp: 26, time: 20.7, lvl: 19, price: 58,  col: "#9fb0bd" },
    { id: "trout",       name: "Trout",       xp: 30, time: 22.5, lvl: 25, price: 75,  col: "#d08a5a" },
    { id: "bass",        name: "Bass",        xp: 50, time: 34.2, lvl: 30, price: 140, col: "#6a8f4a" },
  ];
  FISH.forEach((f, i) => { f.idx = i + 1; });   // tier number, used by Gold Fisher

  D.FISH = FISH;
})();
