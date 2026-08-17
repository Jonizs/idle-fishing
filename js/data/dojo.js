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
    { dan: 2, name: "Nidan", hours: 24,
      desc: "The steady path. Nidan demonstrates that knowledge without consistency is merely illusion.",
      train: [
        { id: "nidLight",  name: "Light Feet", max: 5,
          desc: "+0.5% resonance chance per tier.",
          costs: [30000000, 37000000, 45000000, 55000000, 67000000] },
        { id: "nidSpirit", name: "Entangled Spirit", max: 5,
          desc: "+0.5% sea raven chance per tier.",
          costs: [30000000, 37000000, 45000000, 55000000, 67000000] },
        { id: "nidEarth",  name: "Earthly Connection", max: 4,
          desc: "+30s storm duration per tier.",
          costs: [40000000, 50000000, 61000000, 75000000] },
      ] },
    { dan: 3, name: "Sandan", hours: 24,
      desc: "The sparks of wisdom. Sandan commands independence, blending sharp instincts with inner calm.",
      train: [
        { id: "sanStance", name: "Perfect Stance", max: 10,
          desc: "+0.5% enchanted drop chance per tier.",
          costs: [24000000, 28500000, 34500000, 40500000, 48000000,
                  57000000, 67500000, 81000000, 96000000, 114000000] },
        // The fog system itself is still to come; this line is priced and
        // trainable but has nothing to act on yet.
        { id: "sanFog",    name: "Deeper Fog", max: 5,
          desc: "+1s fog duration per tier.",
          costs: [45000000, 55500000, 67500000, 82500000, 100500000] },
        { id: "sanWeight", name: "Weightlessness", max: 8,
          desc: "-2.5% base fishing time per tier.",
          costs: [45000000, 54000000, 65000000, 78000000,
                  94000000, 113000000, 135000000, 162000000] },
      ] },
    // Ranks past Sandan carry their flavour text only — no trainings yet, so
    // they show their description and stay shut.
    { dan: 4, name: "Yondan", hours: 24, train: [],
      desc: "The breaking point. Yondan forces the mind to abandon rationalization and embrace pure reality." },
    { dan: 5, name: "Godan", hours: 24, train: [],
      desc: "The mastery of self. Godan reveals that true strength is not loud, but applied with absolute control." },
    { dan: 6, name: "Rokudan", hours: 24, train: [],
      desc: "The echoing silence. Rokudan is reached when actions speak seamlessly, devoid of doubt and hesitation." },
    { dan: 7, name: "Shichidan", hours: 24, train: [],
      desc: "The philosopher's edge. Shichidan transcends physical form to teach the deeper underlying truths." },
    { dan: 8, name: "Hachidan", hours: 24, train: [],
      desc: "The endless horizon. Hachidan proves that greater wisdom only reveals how much left there is to learn." },
    { dan: 9, name: "Kudan", hours: 24, train: [],
      desc: "The final transformation. Kudan sheds the material world entirely, preparing the mind for total ascension." },
    { dan: 10, name: "Judan", hours: 24, train: [],
      desc: "The circle completes. The end of the beginning. Judan merges system and soul back into typical nothingness." },
  ];

  // Seconds one tier of this dan takes, so the dan always totals `hours`.
  const danTierSecs = d =>
    (d.hours * 3600) / d.train.reduce((n, t) => n + t.max, 0);

  D.DOJO = DOJO;
  D.danTierSecs = danTierSecs;
})();
