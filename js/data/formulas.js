// The catch formulas, lifted out of js/game/02-stats.js.
//
// These are the numbers a server would have to recompute for itself if the
// save ever moves off the client, so they live here rather than in the game
// script: this file has no DOM in it and Node can require() it.
//
// Nothing here reads `state`. Every input arrives through the ctx object the
// caller passes to makeFormulas, so the browser can wire it to the live game
// and a simulation (or a server) can wire it to whatever it likes. ctx is
// read through calls, never destructured, so the values stay live.
//
//   lvl(id)      upgrade level                      demo()      dev showcase
//   dojo(id)     dojo tiers finished                stormOn()   storm running
//   wornT(kind)  tier of the worn item              gem(k)      gem buff on
//   rarSum(rar)  worn tiers of a rarity             focusOn()   focus active
//   scrollR(id)  equipped scroll's rarity           rushOn()    rush active
//   mus.*        museum set buffs
//
// gem() is a ctx input on purpose: gem buffs are premium and must stay out of
// any silver or gold argument, so simulations pass a ctx whose gem() is false.
//
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  D.makeFormulas = ctx => {
    // Per-tier value of each scroll type, so scrollBuff needs only the tier.
    const PER = Object.fromEntries(D.SCROLLS.map(s => [s.id, s.per]));
    const scrollBuff = id => PER[id] * ctx.scrollR(id);
    const mus = ctx.mus;

    // Focus multiplies the finished total rather than adding to it.
    // Fertilization multiplies the buffs, not the 1.0 base.
    const speedBuffs = () => (0.0175 * (ctx.lvl("fishingSpeed") + ctx.lvl("betterLure"))
                              + 0.02 * ctx.lvl("coffee") + 0.05 * ctx.lvl("oldSpice")
                              + 0.025 * ctx.lvl("excellent")
                              + 0.05 * ctx.wornT("lure") + 0.025 * ctx.rarSum("enchanted")
                              + mus.speed() + scrollBuff("buccan"))
                             * Math.pow(1.01, ctx.lvl("fert"));
    // The storm adds a flat +100% catch speed rather than multiplying, so it
    // reads the same way every other speed buff does.
    const speedBase = () => ctx.demo() ? 3.5 : 1 + speedBuffs() + (ctx.stormOn() ? 1 : 0)
                          + (ctx.gem("premium") ? 0.5 : 0);
    const speedMul = () => speedBase() * (ctx.focusOn() ? 1.5 : 1) * (ctx.rushOn() ? 3 : 1);

    // Thunder: each worn tier adds 0.2% for the sky to strike your catch.
    const boltChance = () => 0.002 * ctx.rarSum("thunder") + mus.bolt() + 0.005 * ctx.lvl("deafening")
                          + 0.0025 * ctx.lvl("ungodly") + scrollBuff("storm");
    // Sea ravens: the Old Raven Scroll, plus Wade's Dark Matter line.
    const ravenChance = () => scrollBuff("raven") + 0.005 * ctx.lvl("darkMatter");
    // Resonance: the catch rings twice and pays twice the xp.
    const resonChance = () => 0.005 * ctx.lvl("resonance");

    const dblChance = () => ctx.demo() ? 1 : 0.005 * ctx.lvl("doubleDrop") + 0.005 * ctx.lvl("masterful") + 0.005 * ctx.lvl("doubleTrouble") + 0.005 * ctx.lvl("seismic") + 0.005 * ctx.dojo("shoControl") + 0.025 * ctx.wornT("bait") + 0.02 * ctx.rarSum("awakened")
                          + 0.01 * ctx.lvl("worms") + mus.dbl() + scrollBuff("caribbean")
                          + (ctx.gem("premium") ? 0.1 : 0);
    const beerMul   = () => ctx.demo() ? 3 : 1 + 0.05 * ctx.lvl("beer") + 0.04 * ctx.lvl("hardLiquor")
                          + 0.05 * ctx.lvl("morgan") + 0.05 * ctx.lvl("cognac")
                          + 0.01 * ctx.wornT("rod") + 0.01 * ctx.rarSum("refined") + mus.game()
                          + scrollBuff("wind")
                          + (ctx.gem("speed") ? 1 : 0) + (ctx.gem("premium") ? 0.2 : 0);
    const goldChance = f => ctx.demo() ? 0.05 : 0.0001 * ctx.lvl("goldFisher") * f.idx * Math.pow(1.1, ctx.wornT("line"))
                          + scrollBuff("sea");
    const encChance = () => ctx.demo() ? 0.5 : (ctx.lvl("enchanted") ? 0.05 : 0) + (ctx.lvl("extremelyShiny") ? 0.05 : 0) + 0.005 * ctx.lvl("masterful") + 0.01 * ctx.lvl("tooShiny")
                          + 0.025 * ctx.wornT("hat") + 0.03 * ctx.rarSum("ascended")
                          + 0.01 * ctx.lvl("plankton") + mus.enc() + scrollBuff("treasure")
                          + 0.005 * ctx.lvl("perseverance")
                          + (ctx.gem("premium") ? 0.1 : 0);

    return { scrollBuff, speedBuffs, speedBase, speedMul, boltChance, ravenChance,
             resonChance, dblChance, beerMul, goldChance, encChance };
  };
})();
