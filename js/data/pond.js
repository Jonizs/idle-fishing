// Data table. Loaded before the game script and shared with the tools in
// simulations/, so there is exactly one copy of these numbers.
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // Pond upgrades are NOT run through the split loop above — their tier counts
  // and per-tier effects are the shipped values. Costs are modelled against
  // income from Lv 32 with the tree maxed: bought left to right they max at
  // Lv 37 / 38 / 39 / 40 respectively.
  const POND_UPG = [
    { id: "bread",     name: "Bread",         pane: "food", max: 10,
      desc: "+2.5% fish sell price per tier.",
      costs: [23400, 28500, 34800, 42450, 51900, 63300, 77100, 94050, 114750, 140100] },
    { id: "plankton",  name: "Plankton",      pane: "food", max: 10,
      desc: "+1% enchanted fish chance per tier.",
      costs: [34650, 42300, 51600, 63000, 76800, 93750, 114450, 139500, 171000, 207000] },
    { id: "worms",     name: "Worms",         pane: "food", max: 10,
      desc: "+1% double drop chance per tier.",
      costs: [42300, 51600, 63000, 76800, 93600, 114300, 139350, 169500, 207000, 253500] },
    { id: "fert",      name: "Fertilization", pane: "food", max: 8,
      desc: "Multiplies every catch speed buff by 1.01x per tier.",
      costs: [78750, 98400, 123150, 154500, 192000, 240000, 300000, 375000] },

    { id: "clones",    name: "Clones",        pane: "fly", max: 1,
      desc: "Golden fish can share the pond, with no 12s wait between them.",
      costs: [62400] },
    { id: "strongRod", name: "Strengthened Rod", pane: "fly", max: 3,
      desc: "Raises the tier of rods golden fish drop.",
      costs: [297000, 476000, 761000] },
    { id: "infest",    name: "Infestation",   pane: "fly", max: 10,
      desc: "-1 fish needed per golden fish, per tier.",
      costs: [81400, 99300, 121000, 148000, 180000, 220000, 268000, 327000, 399000, 487000] },
    { id: "lightCrate", name: "Lightning Crate", pane: "storm", max: 5,
      desc: "During a storm, per fish tier, 0.01% per tier to land a lightning crate.",
      costs: [880000, 1420000, 2280000, 3670000, 5900000] },

    { id: "theStorm",  name: "The Storm",     pane: "storm", max: 10,
      desc: "Calls the storm: 1.5x catch speed and 5% struck fish. +1 min per tier.",
      costs: [520000, 660000, 838000, 1060000, 1350000, 1710000, 2170000, 2760000, 3500000, 4440000] },

    { id: "dblTrouble", name: "Double Trouble", pane: "fly", max: 8,
      desc: "+5% chance a golden fish pops twice over, per tier.",
      costs: [363000, 453000, 566000, 708000, 885000, 1110000, 1380000, 1730000] },
  ];

  D.POND_UPG = POND_UPG;
})();
