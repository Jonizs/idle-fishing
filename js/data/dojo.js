// Data table. Loaded before the game script and shared with the tools in
// simulations/, so there is exactly one copy of these numbers.
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // ── Dojo ─────────────────────────────────────────────────────────────────
  // Ten dan ranks, each a list of trainings. A training tier costs silver to
  // start and then runs on the wall clock — game speed does not touch it.
  //
  // `hours` is the whole dan, split evenly across every tier it holds, so a
  // dan is 24 real hours however many trainings get added to it. Shodan is
  // 5 + 1 + 10 = 16 tiers, so 90 minutes each.
  const DOJO = [
    { dan: 1, name: "Shodan", hours: 24,
      desc: "The beginning of the end. Shodan teaches the importance of shedding one's ego.",
      train: [
        { id: "shoSkills",  name: "Flawless Mechanics", max: 5,
          desc: "-2.5% base fishing time per tier.",
          costs: [15000000, 18500000, 22500000, 27500000, 33500000] },
        { id: "shoKime",    name: "Kime",    max: 1,
          desc: "-20% focus cooldown.",
          costs: [40000000] },
        { id: "shoControl", name: "Control", max: 10,
          desc: "+0.5% double drop chance per tier.",
          costs: [8000000, 9500000, 11500000, 13500000, 16000000,
                  19000000, 22500000, 27000000, 32000000, 38000000] },
      ] },
  ];

  // Seconds one tier of this dan takes, so the dan always totals `hours`.
  const danTierSecs = d =>
    (d.hours * 3600) / d.train.reduce((n, t) => n + t.max, 0);

  D.DOJO = DOJO;
  D.danTierSecs = danTierSecs;
})();
