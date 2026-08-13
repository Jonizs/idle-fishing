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

  // ── Wade fishing ─────────────────────────────────────────────────────────
  // The swamp ladder picks up where the mutated pond ladder stops. Mutated
  // Bass is the last rung there at 2.31 xp/s and 12.2 silver/s, so Swampfish
  // starts just above both and every rung is ~1.23x the one below it, which
  // holds the same shape as the pond curve over seven fish instead of nine.
  //         xp/s:  2.50  3.14  3.91  4.81  5.95  7.30  9.00
  //     silver/s: 13.0  16.0  19.7  24.2  29.8  36.6  45.0
  // The first three all open at 54 and pay exactly the same per second, so a
  // player arriving with three rods can fill all of them at once and the only
  // difference is how long each one takes to land.
  const WADE_FISH = [
    { id: "swampfish", name: "Swampfish",  xp: 10,  time: 4,  lvl: 54, price: 52,   col: "#6f8f4a", idx: 1 },
    { id: "minnow",    name: "Minnow",     xp: 15,  time: 6,  lvl: 54, price: 78,   col: "#8fa96b", idx: 1 },
    { id: "blackfish", name: "Blackfish",  xp: 22,  time: 8.8, lvl: 54, price: 114, col: "#3c4a3f", idx: 1 },
    { id: "swampeel",  name: "Swamp Eel",  xp: 22,  time: 7,  lvl: 58, price: 112,  col: "#4a7a5c", idx: 2 },
    { id: "snakehead", name: "Snakehead",  xp: 43,  time: 11, lvl: 62, price: 217,  col: "#8a7a3e", idx: 3 },
    { id: "alligator", name: "Alligator",  xp: 77,  time: 16, lvl: 66, price: 387,  col: "#3f6b3a", idx: 4 },
    { id: "catfish",   name: "Catfish",    xp: 131, time: 22, lvl: 71, price: 656,  col: "#7a6a52", idx: 5 },
    { id: "stingray",  name: "Stingray",   xp: 197, time: 27, lvl: 76, price: 988,  col: "#5c6f7a", idx: 6 },
    { id: "arapaima",  name: "Arapaima",   xp: 288, time: 32, lvl: 82, price: 1440, col: "#a3543f", idx: 7 },
  ];
  // The three starters share tier 1, so idx is set by hand here rather than
  // taken from list position. idx is the tier: it drives Gold Fisher, the
  // golden spawn roll, Pirate Loot and every crate chance.
  WADE_FISH.forEach((f, i) => { if (f.idx === undefined) f.idx = i + 1; });

  D.FISH = FISH;
  D.WADE_FISH = WADE_FISH;
  // Every fish in the game, for looking one up by id without knowing where it
  // was caught — the bag, the sell screen and the save all need that.
  D.ALL_FISH = FISH.concat(WADE_FISH);
})();
