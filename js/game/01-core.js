// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";

  const canvas = document.getElementById("stage");
  const ctx    = canvas.getContext("2d");
  const TAU    = Math.PI * 2;

  const C = {
    bark: "#6b352a", dark: "#4a231b", deep: "#2e130d", light: "#8f4a39",
    cream: "#f2e3d0", ember: "#e0a054",
    waterDeep: "#0e2f36", water: "#1b525c", waterLit: "#2f8189",
    stone: "#7b6c60", stoneLit: "#9b8b7d", stoneDark: "#43392f",
    leafD: "#3c6b33", leafM: "#5c8f3a", leafL: "#8ab24b",
    grassD: "#26491f", grassM: "#39692c", grassL: "#548c38",
    bushD: "#14300f", bushM: "#1d4318", bushL: "#2a5722",
    rust: "#b5622c", plank: "#7d4a30", plankLit: "#9c6242", plankDark: "#4a2a19",
    skin: "#e8b38a", shirt: "#4d7fa6", pants: "#3a4a5c", hat: "#c9a24a",
  };

  const FONT = '"Ode to Idle Gaming", "Trebuchet MS", sans-serif';
  const rand = (a, b) => a + Math.random() * (b - a);

  // Seeded PRNG so scattered scenery is identical every layout, not jittering.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ── Save (guarded: sandboxed previews can block storage) ─────────────────
  const SAVE_KEY = "idlefish.save";
  const store = {
    read()      { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch (e) { return null; } },
    write(data) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {} },
  };

  // ── Data tables (js/data/*.js, loaded above) ────────────────────────────
  const { FISH, WADE_FISH, ALL_FISH, EARLY_XP, LATE_FROM, LATE_XP, xpToNext, UPGRADES, WADE_UPG, splitCost, tierLvl, MUTATE, MUT, POND_UPG,
          SCROLLS, SCROLL_RAR, DOJO, danTierSecs } = globalThis.GAME_DATA;
  // The ladder for wherever you are standing. FISH stays the pond's own list,
  // because the Breeder and the pond upgrades only ever apply there.
  const areaFish = () => (state.area === "wade" ? WADE_FISH : FISH);
  // Same idea for the upgrade tree. Both trees' buffs apply wherever you
  // are standing; only which list the Upgrades tab shows changes.
  const areaUpg = () => (state.area === "wade" ? WADE_UPG : UPGRADES);
  const ALL_UPG = UPGRADES.concat(WADE_UPG);


  const isMut = id => !!state.mutated[id];
  const fishXp = f => isMut(f.id) ? MUT[f.id].xp : f.xp;
  const fishPrice = f => isMut(f.id) ? MUT[f.id].price : f.price;




  const lvlOf   = id => state.upgrades[id] || 0;
  const baseTime  = f => f.time * (1 - 0.025 * lvlOf("machine") - 0.025 * dojoLvl("shoSkills")) * (1 - scrollBuff("sword"));
  const catchTime = f => baseTime(f) / speedMul();
  const focusBtn = document.getElementById("focus-btn");
  focusBtn.addEventListener("click", () => {
    if (!lvlOf("focus") || focus.active > 0 || focus.cd > 0) return;
    focus.active = FOCUS_ON;
    paintFocus();
  });

  function updateFocus(dt) {
    if (rush.t > 0) rush.t = Math.max(0, rush.t - dt);
    if (focus.active > 0) {
      focus.active -= dt;
      if (focus.active <= 0) { focus.active = 0; focus.cd = focusCd(); }
    } else if (focus.cd > 0) {
      focus.cd -= dt;
      if (focus.cd < 0) focus.cd = 0;
    }
  }

  function paintFocus() {
    const have = lvlOf("focus") > 0;
    focusBtn.hidden = !have;
    if (!have) return;
    const on = focus.active > 0, cd = focus.cd > 0;
    focusBtn.setAttribute("aria-pressed", String(on));
    focusBtn.disabled = on || cd;
    focusBtn.textContent = on ? "Focus " + Math.ceil(focus.active) + "s"
                        : cd ? Math.ceil(focus.cd) + "s"
                        : "Focus";
  }

  // Golden fish: floats up out of the pond and pops when clicked. Its ten
  // seconds run on the wall clock, so game speed can't shorten the window.
  // Base spawning is one at a time with a 12s wall-clock gap; Clones lifts both.
  const GOLD_LIFE = 10, GOLD_GAP = 12;
  // A silver pop pays this many seconds of the player's current earnings, so
  // the reward tracks income instead of drifting with lifetime totals. Sized
  // so golden fish roughly double AFK income with no Fly upgrades and roughly
  // triple it with all of them; see simulations/silver54.js.
  const GOLD_PAY = 64;
  const goldens = [];
  let goldGap = GOLD_GAP;

  // Strengthened Rod: weights over rod tiers 1-4. Index 0 is the base drop.
  const ROD_TIERS = [
    [1],
    [0.6, 0.4],
    [0.2, 0.5, 0.3],
    [0, 0.3, 0.6, 0.1],
  ];

  // Expected silver per real second from what is on the line right now.
  const silverRate = () => {
    let s = 0;
    for (const id of livePicks()) {
      const f = ALL_FISH.find(x => x.id === id);
      if (!f) continue;
      s += priceOf(f, false) * (1 + dblChance()) * (1 + (ENCH_MULT - 1) * encChance())
           / catchTime(f);
    }
    return s * beerMul() * state.speed;
  };

  function spawnGolden() {
    if (!lvlOf("clones") && (goldens.length || goldGap < GOLD_GAP)) return;
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.7;
    const y0 = pond.cy + Math.sin(a) * pond.ry * r;
    goldens.push({ x: pond.cx + Math.cos(a) * pond.rx * r, y0, y: y0, t: 0 });
    goldGap = 0;
  }

  function updateGolden(realDt) {
    goldGap += realDt;
    for (let i = goldens.length - 1; i >= 0; i--) {
      const g = goldens[i];
      g.t += realDt;
      g.y = g.y0 - (g.t / GOLD_LIFE) * pond.ry * 1.5;
      if (g.t >= GOLD_LIFE) goldens.splice(i, 1);
    }
  }

  function rollRodTier() {
    const w = ROD_TIERS[lvlOf("strongRod")] || ROD_TIERS[0];
    let r = Math.random();
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i + 1; }
    return w.length;
  }

  function popGolden(i) {
    const g = goldens[i];
    if (!g) return;
    goldens.splice(i, 1);
    addSplash(g.x, g.y, 10, 150);
    // Double Trouble doubles whatever the pop yields, currency included.
    const dbl = Math.random() < 0.05 * lvlOf("dblTrouble") ? 2 : 1;
    const roll = Math.random();
    if (roll < 0.5) {
      const n = Math.max(1, Math.round(silverRate() * GOLD_PAY)) * dbl;
      state.silver += n;
      addFloater("+" + nf(n) + " Silver", g.x, g.y, "#c8ccd2");
    } else if (roll < 0.75) {
      const n = Math.max(1, Math.floor(state.stats.goldEarned * 0.0005)) * dbl;
      state.gold += n;
      addFloater("+" + nf(n) + " Gold", g.x, g.y, "#e5bb4e");
    } else {
      const n = dbl;
      const tier = rollRodTier();
      const r = Math.random();
      // Enchanted is forge-only now, so its band folds into refined.
      const rar = r < 0.75 ? "std" : r < 0.985 ? "refined" : "awakened";
      const bag = state.rods, k = key(rar, tier);
      bag[k] = (bag[k] || 0) + n;
      addFloater((n > 1 ? "2x " : "") + itemName("rod", rar, tier), g.x, g.y, LURE_COL[tier - 1]);
      refreshEquip(true);
    }
    paintIdent(); save();
  }

  function drawGolden() {
    canvas.style.cursor = goldens.length ? "pointer" : "";
    const u = angler.u;
    for (const g of goldens) {
      const k = g.t / GOLD_LIFE;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const x = g.x + Math.sin(g.t * 2.2) * u * 0.5, y = g.y;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(229,187,78,.22)";
      ctx.beginPath(); ctx.arc(x, y, u * 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = "#e5bb4e";
      ctx.beginPath(); ctx.ellipse(x, y, u * 0.85, u * 0.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - u * 0.78, y);
      ctx.lineTo(x - u * 1.35, y - u * 0.42);
      ctx.lineTo(x - u * 1.35, y + u * 0.42);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f6e3a8";
      ctx.beginPath(); ctx.ellipse(x + u * 0.1, y - u * 0.16, u * 0.5, u * 0.16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = C.deep;
      ctx.beginPath(); ctx.arc(x + u * 0.5, y - u * 0.1, u * 0.09, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

