// Data table. Loaded before the game script and shared with the tools in
// simulations/, so there is exactly one copy of these numbers.
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // Polynomial growth with a slow exponential rider: brisk for the first few
  // levels, then the tail stretches out hard. L1 costs 9 xp, L30 costs 8809.
  // Levels 2-4 are eased so the opening isn't a slog; the curve is untouched
  // from level 5 on.
  const EARLY_XP = { 2: 0.55, 3: 0.65, 4: 0.8 };
  // Past 32 the curve gets a second exponential rider, so the late game can
  // absorb the power the next locations will add. LATE_XP is the dial.
  const LATE_FROM = 32, LATE_XP = 1.171;
  // From 54 the swamp takes over and the rider eases to SWAMP_XP. The 1.171
  // rider stops compounding there rather than being replaced, so Lv 54 costs
  // exactly what it did before and only the levels above it move.
  const SWAMP_FROM = 54, SWAMP_XP = 1.13;
  const lateMul = L => (L > LATE_FROM
    ? Math.pow(LATE_XP, Math.min(L, SWAMP_FROM) - LATE_FROM)
      * (L > SWAMP_FROM ? Math.pow(SWAMP_XP, L - SWAMP_FROM) : 1)
    : 1);
  const xpToNext = L =>
    Math.round(9 * Math.pow(L, 1.85) * Math.pow(1.02, L) * (EARLY_XP[L] || 1) * lateMul(L));

  D.EARLY_XP = EARLY_XP;
  D.LATE_FROM = LATE_FROM;
  D.LATE_XP = LATE_XP;
  D.SWAMP_FROM = SWAMP_FROM;
  D.SWAMP_XP = SWAMP_XP;
  D.xpToNext = xpToNext;
})();
