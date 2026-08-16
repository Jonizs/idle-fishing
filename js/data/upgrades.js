// Data table. Loaded before the game script and shared with the tools in
// simulations/, so there is exactly one copy of these numbers.
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // ── Upgrades ─────────────────────────────────────────────────────────────
  // Costs are tuned against income: fishing speed maxes near L4, double drop
  // hits 5% near L5 and 10% near L15, better lure and enchanted land by L15.
  const UPGRADES = [
    { id: "starterGear",  name: "Starter Gear",   lvl: 1,  max: 1,
      desc: "Grants a tier 1 rod, a tier 1 line and a tier 1 lure.",
      costs: [100] },
    { id: "fishingSpeed", name: "Fishing Speed",  lvl: 1,  max: 5,
      desc: "+1.75% catch speed per tier.",
      costs: [11, 19, 30, 49, 75] },
    { id: "doubleDrop",   name: "Double Drop",    lvl: 1,  max: 10,
      desc: "+0.5% chance to catch two fish and earn double XP.",
      costs: [25, 40, 65, 100, 150, 300, 600, 1100, 1900, 2800] },
    { id: "betterLure",   name: "Better Lure",    lvl: 6,  max: 5, lvls: [6, 8, 8, 8, 8],
      desc: "+1.75% catch speed per tier.",
      costs: [300, 500, 800, 1200, 1700] },
    // Modelled against income: gold fisher t1 lands ~L12 and t10 ~L30,
    // fancy bait ~L17, beer t1 ~L17 and t5 ~L29.
    { id: "goldFisher",   name: "Gold Fisher",    lvl: 8,  max: 20,
      desc: "+0.01% per tier, times the fish tier, to hook a gold coin.",
      costs: [400, 490, 610, 750, 930, 1150, 1420, 1750, 2160, 2670,
              3300, 4080, 5040, 6220, 7680, 9490, 11710, 14470, 17870, 22070] },
    { id: "enchanted",    name: "Enchanted Fish", lvl: 10, max: 1,
      desc: "5% chance your catch is enchanted, worth 4x.",
      costs: [2000] },
    { id: "coffee",       name: "Black Coffee",   lvl: 11, max: 10,
      desc: "+2% catch speed per tier.",
      costs: [450, 585, 765, 990, 1290, 1665, 2175, 2820, 3675, 4770] },
    { id: "luckyCrate",   name: "Upgraded Crate", lvl: 13, max: 1,
      desc: "Per fish tier, 0.05% for a tier 1 equipment crate and 0.005% for a tier 2.",
      costs: [1200] },
    { id: "tooShiny",     name: "Too Shiny",      lvl: 15, max: 5,
      desc: "+1% enchanted fish chance per tier.",
      costs: [900, 1500, 2400, 3800, 6000] },
    { id: "beer",         name: "Beer",           lvl: 4,  max: 3, lvls: [4, 8, 12],
      desc: "+0.05x game speed per tier.",
      costs: [100, 600, 1500] },
    { id: "hardLiquor",   name: "Hard Liquor",    lvl: 18, max: 5,
      desc: "+0.04x game speed per tier.",
      costs: [6000, 10000, 16000, 24000, 36000] },
    { id: "twoRods",      name: "2 Is Better Than 1", lvl: 19, max: 1,
      desc: "Fish two different fish at the same time.",
      costs: [36000] },
    { id: "machine",      name: "Fishing Machine", lvl: 21, max: 5,
      desc: "-2.5% base catch time per tier.",
      costs: [12500, 20000, 30000, 45000, 65000] },
    // 10 pre-split tiers become 20 in play, 0.5% each.
    { id: "doubleTrouble", name: "Double Trouble",  lvl: 24, max: 10,
      desc: "+0.5% double drop chance per tier.",
      costs: [40000, 58000, 84000, 122000, 177000, 257000, 373000, 541000, 785000, 1139000] },
    { id: "redbull",      name: "Redbull",        lvl: 25, max: 1,
      desc: "Per fish tier, 0.05% chance a catch triples all catch speed for 3.5s.",
      costs: [12000] },
    { id: "enchCrate",    name: "Enchanted Crate", lvl: 28, max: 1,
      desc: "Per fish tier, 0.05% for a tier 2 equipment crate and 0.005% for a tier 3.",
      costs: [20000] },
    { id: "goldenCrate",  name: "Golden Crate",   lvl: 37, max: 1,
      desc: "Per fish tier, 0.05% for a tier 3 equipment crate and 0.005% for a tier 4.",
      costs: [900000] },
    { id: "deafening",    name: "Deafening Strikes", lvl: 40, max: 5, nosplit: true,
      desc: "+0.5% chance per tier that a catch is struck by lightning.",
      costs: [1150000, 1520000, 2010000, 2650000, 3500000] },
    { id: "trifecta",     name: "Trifecta",       lvl: 44, max: 1,
      desc: "Fish three different fish at the same time.",
      costs: [11000000] },
    // Trifecta, Captain Morgan and Old Spice are sized together against the
    // Lv 44-54 silver window: a player who clicks every golden fish should
    // still be about 10% short of the whole tree at 54. See silver54.js.
    { id: "morgan",       name: "Captain Morgan", lvl: 46, max: 5, nosplit: true,
      desc: "+0.05x game speed per tier.",
      costs: [2400000, 2900000, 3500000, 4300000, 4900000] },
    { id: "oldSpice",     name: "Old Spice",      lvl: 50, max: 5, nosplit: true,
      desc: "Nice smell attracts fish. +5% fishing speed per tier.",
      costs: [3600000, 4400000, 5400000, 6600000, 8000000] },
    // nosplit: 15 tiers as specced, not 30. Sized to soak roughly the whole
    // Lv 34-41 silver window if bought ahead of everything else.
    { id: "masterful",    name: "Masterful Technique", lvl: 34, max: 15, nosplit: true,
      desc: "+0.5% enchanted fish and +0.5% double drop per tier.",
      costs: [62500, 75000, 92500, 112500, 137500, 170000, 205000, 252500, 307500, 375000, 457500, 557500, 680000, 830000, 1012500] },

    { id: "extremelyShiny", name: "Extremely Shiny", lvl: 30, max: 1,
      desc: "+5% enchanted fish chance.",
      costs: [300000] },

    { id: "scrolls",      name: "Old Fishing Scrolls", lvl: 32, max: 1,
      desc: "Unlocks the Scrolls menu.",
      costs: [10] },

    // Same gate as Old Fishing Scrolls, and priced to match it: scroll effects
    // are not in the balance model, so this is a sibling price, not a modelled
    // one.
    { id: "pirateLoot",   name: "Pirate Loot", lvl: 32, max: 1,
      desc: "0.005% chance per fish tier to drop a common fishing scroll.",
      costs: [650000] },
    { id: "focus",        name: "Focus",          lvl: 29, max: 1,
      desc: "Adds a button: +50% catch speed for 1 minute, then 3 minutes of cooldown.",
      costs: [25000] },
  ];

  UPGRADES.sort((a, b) => a.lvl - b.lvl);   // listed in unlock order

  // Every tiered upgrade is split into twice as many tiers, each worth half as
  // much and costing roughly half. Buying both halves matches the old tier
  // exactly, so pacing and totals are unchanged. Effect coefficients below are
  // already halved to match.
  const splitCost = c => { const a = Math.round(c * 0.45); return [a, c - a]; };
  for (const u of UPGRADES) if (u.max > 1 && !u.nosplit) {
    u.costs = u.costs.flatMap(splitCost);
    u.max  *= 2;
    if (u.lvls) u.lvls = u.lvls.flatMap(l => [l, l]);
  }

  // Tiers can each have their own level requirement.
  const tierLvl = (u, t) => (u.lvls ? u.lvls[Math.min(t, u.lvls.length - 1)] : u.lvl);

  D.UPGRADES = UPGRADES;
  D.splitCost = splitCost;
  D.tierLvl = tierLvl;
})();
