// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Storm ────────────────────────────────────────────────────────────────
  // Rolls every 5 minutes at 1/10. After 50 minutes without one the odds rise
  // to 1/3 until it lands, so a long dry spell can't run forever.
  const STORM_ROLL = 300, STORM_BASE = 300, STORM_DRY = 3000;
  const storm = { t: 0, roll: STORM_ROLL, dry: 0, flash: 0, bolts: [], drops: [] };
  // Sea ravens fly out of the lure and off the top of the screen, the same
  // way a bolt comes down: spawned on an event, stepped and drawn by the loop.
  const ravens = [];

  const stormTier = () => lvlOf("theStorm");
  const stormLen  = () => STORM_BASE + Math.max(0, stormTier() - 1) * 60;
  const stormOn   = () => storm.t > 0;

  function startStorm(secs) {
    storm.t = secs || stormLen();
    storm.dry = 0;
    storm.roll = STORM_ROLL;
    if (!storm.drops.length) seedRain();
    dropToast("The storm rolls in", "#bfe0ff");
  }

  function seedRain() {
    storm.drops.length = 0;
    for (let i = 0; i < 220; i++)
      storm.drops.push({
        x: Math.random() * view.w,
        y: Math.random() * view.h,
        l: 8 + Math.random() * 14,
        v: 780 + Math.random() * 520,
      });
  }

  // A jagged bolt from the top of the frame down onto the water.
  // A bolt can be aimed at a point and can carry a callback that fires on
  // impact, so the strike lands before any text appears.
  function addBolt(atX, atY, onHit) {
    const tx = atX !== undefined ? atX : pond.cx + (Math.random() - 0.5) * pond.rx * 1.7;
    const ty = atY !== undefined ? atY : pond.cy + (Math.random() - 0.5) * pond.ry * 1.2;
    const pts = [{ x: tx + (Math.random() - 0.5) * 90, y: -10 }];
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      pts.push({
        x: tx * k + pts[0].x * (1 - k) + (Math.random() - 0.5) * 46 * (1 - k),
        y: ty * k - 10 * (1 - k),
      });
    }
    // 0.14s of travel before the flash, so the eye reads sky -> water -> text.
    storm.bolts.push({ pts, t: 0, life: 0.46, lead: 0.14, hit: false, x: tx, y: ty, onHit });
  }

  function updateStorm(dt) {
    if (storm.t > 0) {
      storm.t -= dt;
      if (storm.t <= 0) { storm.t = 0; storm.bolts.length = 0; dropToast("The storm passes", "#8fb6e0"); }
      if (Math.random() < dt / 3.4) addBolt();
      for (const d of storm.drops) {
        d.y += d.v * dt;
        d.x -= d.v * 0.16 * dt;
        if (d.y > view.h) { d.y = -20; d.x = Math.random() * view.w; }
        if (d.x < -20) d.x = view.w + 20;
      }
      stepBolts(dt);
      storm.flash = Math.max(0, storm.flash - dt * 4.5);
      return;
    }
    stepBolts(dt);                                  // Thunder strikes outside storms
    storm.flash = Math.max(0, storm.flash - dt * 4.5);
    if (!stormTier()) return;                       // not unlocked yet
    storm.dry += dt;
    storm.roll -= dt;
    if (storm.roll <= 0) {
      storm.roll = STORM_ROLL;
      if (Math.random() < (storm.dry >= STORM_DRY ? 1 / 3 : 1 / 10)) startStorm();
    }
  }

  // Flies up and away from (x, y), wings beating, fading near the end.
  function addRaven(x, y) {
    ravens.push({
      x, y, t: 0, life: 1.5,
      vx: (Math.random() < 0.5 ? -1 : 1) * (110 + Math.random() * 60),
      vy: -(200 + Math.random() * 70),
      flap: Math.random() * 6.28,
    });
  }

  function stepRavens(dt) {
    for (let i = ravens.length - 1; i >= 0; i--) {
      const r = ravens[i];
      r.t += dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy -= 30 * dt;                    // keeps climbing, never falls back
      r.flap += dt * 17;
      if (r.t >= r.life) ravens.splice(i, 1);
    }
  }

  function drawRavens() {
    if (!ravens.length) return;
    ctx.save();
    for (const r of ravens) {
      const k = r.t / r.life;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const s = Math.max(8, angler.u * 1.1);   // wing half-span
      const beat = Math.sin(r.flap);      // -1 up, +1 down
      ctx.strokeStyle = "#101010";
      ctx.lineWidth = Math.max(2, s * 0.16);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      // body
      ctx.beginPath();
      ctx.moveTo(r.x - s * 0.16, r.y);
      ctx.lineTo(r.x + s * 0.3, r.y - s * 0.04);
      ctx.stroke();
      // wings, a shallow M that opens and closes
      ctx.beginPath();
      ctx.moveTo(r.x - s, r.y - beat * s * 0.55);
      ctx.quadraticCurveTo(r.x - s * 0.45, r.y - s * 0.3, r.x, r.y - s * 0.06);
      ctx.quadraticCurveTo(r.x + s * 0.45, r.y - s * 0.3, r.x + s, r.y - beat * s * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }

  function stepBolts(dt) {
    for (let i = storm.bolts.length - 1; i >= 0; i--) {
      const b = storm.bolts[i];
      b.t += dt;
      if (!b.hit && b.t >= b.lead) {                // impact
        b.hit = true;
        storm.flash = 1;
        addSplash(b.x, b.y, 9, 200);
        if (b.onHit) b.onHit();
      }
      if (b.t >= b.life) storm.bolts.splice(i, 1);
    }
  }

  function drawStorm() {
    if (!stormOn() && !storm.bolts.length && storm.flash <= 0) return;
    ctx.save();
    if (!stormOn()) { drawBolts(); ctx.restore(); return; }
    ctx.fillStyle = "rgba(24,32,54,.30)";
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.strokeStyle = "rgba(186,214,255,.42)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const d of storm.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.l * 0.16, d.y + d.l);
    }
    ctx.stroke();
    drawBolts();
    ctx.restore();
  }

  function drawBolts() {
    if (storm.flash > 0) {
      ctx.fillStyle = "rgba(198,224,255," + (storm.flash * 0.28).toFixed(3) + ")";
      ctx.fillRect(0, 0, view.w, view.h);
    }
    for (const b of storm.bolts) {
      // before impact the bolt is still descending, so draw only what has fallen
      const k = Math.min(1, b.t / b.lead);
      const n = Math.max(2, Math.ceil(k * b.pts.length));
      const a = b.hit ? 1 - (b.t - b.lead) / (b.life - b.lead) : 1;
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#bfe0ff";
      ctx.shadowColor = "#6aa8ff";
      ctx.shadowBlur = 16;
      for (const w of [5.5, 2.2]) {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(b.pts[0].x, b.pts[0].y);
        for (const pt of b.pts.slice(1, n)) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.strokeStyle = "#eaf5ff";
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  // Focus: a minute of +50% catch speed, then three minutes of cooldown.
  const FOCUS_ON = 60, FOCUS_CD = 180;
  // Shodan’s Kime shortens the wait between bursts.
  const focusCd = () => FOCUS_CD * (1 - 0.2 * dojoLvl("shoKime"));
  const focus = { active: 0, cd: 0 };
  const RUSH_ON = 3.5;                 // Redbull, before White Monster
  const rushChance = () => (lvlOf("whiteMonster") ? 0.001 : 0.0005);
  const rushLen    = () => (lvlOf("whiteMonster") ? 5 : RUSH_ON);
  const rush = { t: 0 };

  // ── Scrolls ──────────────────────────────────────────────────────────────
  // Bag keys are "type:rarity" ("raven:3"). state.scrollEq holds the same key
  // per bar slot, or "" for empty. Only one scroll of a type may be equipped,
  // so every effect is linear in that one scroll's rarity tier.
  const SCROLL = Object.fromEntries(SCROLLS.map(s => [s.id, s]));
  const SCROLL_SLOTS = 9;
  const parseScroll = k => { const [id, r] = k.split(":"); return { id, r: +r }; };
  const scrollRarOf = t => SCROLL_RAR[t - 1];
  // Rarity tier of the equipped scroll of this type, or 0 if none is worn.
  const scrollR = id => {
    for (const k of state.scrollEq) if (k && parseScroll(k).id === id) return parseScroll(k).r;
    return 0;
  };

  // ── Gem shop buffs ──────────────────────────────────────────────────────
  // Bought with gems, timed in real days rather than playtime, so they keep
  // running with the tab shut. state.gemBuf holds an expiry in epoch ms;
  // Gifted Fisherman is permanent and stores 1.
  const GEM_UPG = {
    speed:   { cost: 200, days: 14 },
    premium: { cost: 350, days: 14 },
    gifted:  { cost: 550, days: 0 },
  };
  const gemOn = k => k === "gifted" ? !!state.gemBuf.gifted
                                    : state.gemBuf[k] > Date.now();

  // Lure tiers 1-10, colour ramp left to right; tier 10 is white and glows.
  const LURE_MAX = 10;
  const LURE_COL = ["#e05a5a", "#e8b22e", "#2fae3f", "#2ab8bd", "#3a72d4",
                    "#8a4fd0", "#c840a8", "#b0295e", "#e5bb4e", "#ffffff"];
  const LUCKY_T1 = 0.0005, LUCKY_T2 = 0.00005;   // per fish tier
  // ── Catch formulas ───────────────────────────────────────────────────────
  // The formulas themselves live in js/data/formulas.js so Node can load them
  // without a DOM; this wires them to the live game. Every ctx entry is a
  // function, not a value: state and half these accessors are declared in
  // later files, so reading them eagerly here would hit the TDZ.
  const FORMULA = makeFormulas({
    lvl:      id => lvlOf(id),
    dojo:     id => dojoLvl(id),
    wornT:    kind => wornT(kind),
    rarSum:   rar => rarSum(rar),
    scrollR:  id => scrollR(id),
    demo:     () => state.demo,
    stormOn:  () => stormOn(),
    gem:      k => gemOn(k),
    focusOn:  () => focus.active > 0,
    rushOn:   () => rush.t > 0,
    mus: { speed: () => musSpeed(), game: () => musGame(), dbl: () => musDbl(),
           enc: () => musEnc(), bolt: () => musBolt() },
  });
  const { scrollBuff, speedBuffs, speedBase, speedMul, boltChance, ravenChance,
          resonChance, dblChance, beerMul, goldChance, encChance } = FORMULA;

  const ENCH_MULT = 4;

  // ── Game state ───────────────────────────────────────────────────────────
  const state = {
    time: 0,
    free: false,                 // dev: everything costs nothing
    demo: false,                 // dev: showcase stats, not saved
    museum: {},                 // "rarity:tier" -> array of donated slot names
    struck: {},                 // fish id -> count, caught during a storm
    scrolls: {},                // "type:rarity" -> count, the scroll bag
    scrollEq: ["", "", "", "", "", "", "", "", ""],   // the nine bar slots
    ravens: 0,                  // sea ravens, dropped by the Old Raven Scroll
    spyglass: 0,                // Dark Arts drop, spent on tier 2 scrolls
    mutated: {},                // fish id -> true once bred
    layout: "auto",              // auto | phone | desktop
    bought: { daily: [], weekly: [] },   // shop slots already taken
    player: { name: "", level: 1, xp: 0, online: true },
    party: [null, null, null, null],
    tabs: { left: "profile", right: "fish" },
    area: "pond",                // pond | wade — which location is being fished
    owned: {},
    ench: {},
    upgrades: {},
    picks: ["lanternfish"],          // one fish per rod, in rod order
    // Each area keeps its own selection; picks is whichever is active. Swapped
    // on travel so coming back to the pond does not lose what you had on.
    picksBy: { pond: ["lanternfish"], wade: ["swampfish"] },
    speed: 1,
    gold: 0, silver: 0,
    gems: 0,                     // premium currency, 1 per real hour open
    gemSecs: 0,                  // real seconds banked toward the next one
    gemBuf: { speed: 0, premium: 0, gifted: 0 },   // gem shop buffs, see GEM_UPG
    meals: 0,
    rods: {}, lines: {}, lures: {}, baits: {}, hats: {}, crates: {},   // "rarity:tier" -> count
    equip: { rod: "", line: "", lure: "", bait: "", hat: "" },          // "" = empty slot
    // Dojo: tiers finished per training, plus the one tier training right
    // now.  is a wall-clock timestamp, so it runs while the tab is shut.
    dojo: { tiers: {}, active: null },
    dojoFast: false,             // dev CD toggle, never saved
    stats: { play: 0, silverEarned: 0, goldEarned: 0, caught: 0, xpEarned: 0, levelAt: {} },
  };
  const save = () => store.write({
    player: state.player, party: state.party,
    owned: state.owned, ench: state.ench, upgrades: state.upgrades,
    picks: state.picks, picksBy: state.picksBy,
    gold: state.gold, silver: state.silver,
    gems: state.gems, gemSecs: state.gemSecs, gemBuf: state.gemBuf,
    stats: state.stats, bought: state.bought, layout: state.layout, area: state.area,
    mutated: state.mutated, struck: state.struck, museum: state.museum,
    scrolls: state.scrolls, scrollEq: state.scrollEq, ravens: state.ravens,
    spyglass: state.spyglass, dojo: state.dojo,
    splitTiers: true,
    rods: state.rods, lines: state.lines, lures: state.lures, baits: state.baits,
    hats: state.hats, crates: state.crates,
    equip: state.equip,
  });

