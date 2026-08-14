// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Layout mode ──────────────────────────────────────────────────────────
  // auto follows the window, the other two are forced. Panels become drawers
  // in phone mode, so the scene keeps the full width.
  const MODES = ["auto", "phone", "desktop"];
  const aspectBtn = document.getElementById("aspect-btn");
  const panelL = document.querySelector(".panel--left");
  const panelR = document.querySelector(".panel--right");

  function isPhone() {
    if (state.layout === "phone") return true;
    if (state.layout === "desktop") return false;
    return window.innerWidth < 760;
  }

  function applyLayout() {
    const phone = isPhone();
    document.documentElement.classList.toggle("phone", phone);
    aspectBtn.textContent = state.layout === "auto" ? "Auto" : state.layout === "phone" ? "Phone" : "Desktop";
    if (!phone) { panelL.classList.remove("open"); panelR.classList.remove("open"); }
    resize();
  }

  function openPanel(el) {
    const on = !el.classList.contains("open");
    panelL.classList.remove("open"); panelR.classList.remove("open");
    if (on) el.classList.add("open");
  }
  document.getElementById("nav-left").addEventListener("click", () => openPanel(panelL));
  document.getElementById("nav-right").addEventListener("click", () => openPanel(panelR));
  canvas.addEventListener("pointerdown", e => {
    if (goldens.length) {
      const r = canvas.getBoundingClientRect();
      for (let i = goldens.length - 1; i >= 0; i--) {
        const g = goldens[i];
        const gx = g.x + Math.sin(g.t * 2.2) * angler.u * 0.5;
        if (Math.hypot(e.clientX - r.left - gx, e.clientY - r.top - g.y) < angler.u * 1.6) {
          popGolden(i);
          return;
        }
      }
    }
    if (document.documentElement.classList.contains("phone")) {
      panelL.classList.remove("open"); panelR.classList.remove("open");
    }
  });

  aspectBtn.addEventListener("click", () => {
    state.layout = MODES[(MODES.indexOf(state.layout) + 1) % MODES.length];
    applyLayout();
    save();
  });

  // ── Dev speed ────────────────────────────────────────────────────────────
  const devMenu = document.getElementById("dev-menu");
  document.getElementById("dev-toggle").addEventListener("click", () => {
    devMenu.hidden = !devMenu.hidden;
  });
  const devFree = document.getElementById("dev-free");
  devFree.addEventListener("click", () => setFree(!state.free));
  function setFree(on) {
    state.free = on;
    devFree.setAttribute("aria-pressed", String(on));
    paintShop(); refreshUpgrades(); buildFishList(); refreshFish();
    refreshPondLock(); refreshPond(); refreshScrolls();
  }

  document.getElementById("dev-storm").addEventListener("click", () => {
    if (stormOn()) { storm.t = 0; storm.bolts.length = 0; dropToast("Storm cleared", "#8fb6e0"); }
    else startStorm(stormTier() ? stormLen() : 300);   // works before the upgrade
  });

  document.getElementById("dev-thunder").addEventListener("click", () => {
    for (const k of WEAR) {
      const bag = BAGS[k]();
      const id = key("thunder", 5);
      bag[id] = (bag[id] || 0) + 1;
    }
    refreshEquip(true); paintIdent(); save();
    dropToast("Thunder set granted", "#bfe0ff");
  });

  document.getElementById("dev-max").addEventListener("click", () => {
    for (const u of UPGRADES) state.upgrades[u.id] = u.max;
    for (const u of POND_UPG)  state.upgrades[u.id] = u.max;
    for (const k of WEAR) {
      const id = key("thunder", 5);
      const bag = BAGS[k]();
      bag[id] = (bag[id] || 0) + 1;
      equipItem(k, id);
    }
    paintIdent(); refreshUpgrades(); refreshPondLock(); refreshPond();
    buildFishList(); refreshFish(); refreshScrolls(); refreshEquip(true); paintFocus();
    save();
    dropToast("Maxed", "#bfe0ff");
  });

  // Exactly enough xp to tip over, so the level-up path runs for real: the
  // graph point, the fish list, the upgrade gates and the pond locks.
  document.getElementById("dev-lvl").addEventListener("click", () => {
    addXp(xpToNext(state.player.level) - state.player.xp);
  });

  const devDemo = document.getElementById("dev-demo");
  devDemo.addEventListener("click", () => {
    state.demo = !state.demo;
    devDemo.setAttribute("aria-pressed", String(state.demo));
    for (const r of rods) { r.t = 0; r.cast.phase = "idle"; }
    refreshFish(); paintHud();
  });

  const devOpts = [...document.querySelectorAll(".dev__opt")];
  devOpts.forEach(o => o.addEventListener("click", () => {
    state.speed = +o.dataset.speed;
    devOpts.forEach(x => x.setAttribute("aria-pressed", String(x === o)));
  }));

  // ── Name gate ────────────────────────────────────────────────────────────
  const gate = document.getElementById("gate");
  const gInput = document.getElementById("gate-input");
  const gGo = document.getElementById("gate-go");
  const gSub = document.getElementById("gate-sub");
  const validName = v => /^[A-Za-z0-9_]{3,14}$/.test(v);

  gInput.addEventListener("input", () => {
    const v = gInput.value.trim(), ok = validName(v);
    gGo.disabled = !ok;
    gSub.textContent = (!v || ok) ? "3–14 characters" : "Letters, numbers and _ only";
  });
  gInput.addEventListener("keydown", e => { if (e.key === "Enter" && !gGo.disabled) gGo.click(); });
  gGo.addEventListener("click", () => {
    state.player.name = gInput.value.trim();
    save(); paintIdent(); gate.hidden = true;
  });

  const saved = store.read();
  if (saved && saved.player && saved.player.name) {
    Object.assign(state.player, saved.player);
    if (typeof state.player.xp !== "number") state.player.xp = 0;
    if (Array.isArray(saved.party)) state.party = saved.party;
    if (saved.owned) state.owned = saved.owned;
    const ok = id => ALL_FISH.some(f => f.id === id);
    if (Array.isArray(saved.picks)) state.picks = saved.picks.filter(ok);
    else {                                        // saves from before multi-rod
      state.picks = [saved.selected, saved.selected2].filter(id => id && ok(id));
    }
    if (saved.picksBy) for (const k in state.picksBy)
      if (Array.isArray(saved.picksBy[k])) state.picksBy[k] = saved.picksBy[k].filter(ok);
    if (!state.picks.length) state.picks = [areaFish()[0].id];
    if (typeof saved.gold === "number") state.gold = saved.gold;
    if (typeof saved.silver === "number") state.silver = saved.silver;
    if (typeof saved.gems === "number") state.gems = saved.gems;
    if (typeof saved.gemSecs === "number") state.gemSecs = saved.gemSecs;
    if (saved.gemBuf) for (const k in state.gemBuf)
      if (typeof saved.gemBuf[k] === "number") state.gemBuf[k] = saved.gemBuf[k];
    if (saved.ench) state.ench = saved.ench;
    if (saved.upgrades) {
      state.upgrades = saved.upgrades;
      if (!saved.splitTiers) for (const u of UPGRADES)      // pre-split save
        if (u.max > 1 && state.upgrades[u.id]) state.upgrades[u.id] = Math.min(u.max, state.upgrades[u.id] * 2);
    }
    if (saved.mutated) state.mutated = saved.mutated;
    if (saved.struck) state.struck = saved.struck;
    if (saved.scrolls) state.scrolls = saved.scrolls;
    if (Array.isArray(saved.scrollEq))
      for (let i = 0; i < SCROLL_SLOTS; i++)
        if (typeof saved.scrollEq[i] === "string") state.scrollEq[i] = saved.scrollEq[i];
    if (typeof saved.ravens === "number") state.ravens = saved.ravens;
    if (saved.museum) state.museum = saved.museum;
    if (saved.stats) Object.assign(state.stats, saved.stats);
    if (!state.stats.levelAt) state.stats.levelAt = {};   // saves from before the graph
    if (saved.bought) Object.assign(state.bought, saved.bought);
    if (AREAS[saved.area]) state.area = saved.area;
    if (MODES.indexOf(saved.layout) >= 0) state.layout = saved.layout;
    // saves from before rarities keyed bags by bare tier and equip by number
    const migrate = bag => {
      const out = {};
      for (const k in bag) out[/:/.test(k) ? k : "std:" + k] = bag[k];
      return out;
    };
    if (saved.rods)   state.rods   = migrate(saved.rods);
    if (saved.lines)  state.lines  = migrate(saved.lines);
    if (saved.lures)  state.lures  = migrate(saved.lures);
    if (saved.baits)  state.baits  = migrate(saved.baits);
    if (saved.hats)   state.hats   = migrate(saved.hats);
    if (saved.crates) state.crates = migrate(saved.crates);
    if (saved.equip) for (const k in state.equip) {
      const v = saved.equip[k];
      if (typeof v === "number") state.equip[k] = v ? "std:" + v : "";
      else if (typeof v === "string") state.equip[k] = v;
    }
    paintIdent(); buildFishList(); buildUpgrades(); buildPond(); buildMuseum(); buildMuseumInfo(); buildForge(); buildInventory(); refreshInventory(true); refreshEquip(true); paintShop(); refreshPondLock(); refreshScrolls(); paintFocus(); paintArea(); applyLayout();
  } else {
    paintIdent(); buildFishList(); buildUpgrades(); buildPond(); buildMuseum(); buildMuseumInfo(); buildForge(); buildInventory(); refreshInventory(true); refreshEquip(true); paintShop(); refreshPondLock(); refreshScrolls(); paintFocus(); paintArea(); applyLayout();
    gate.hidden = false; gInput.focus();
  }

  // ── Pointer ──────────────────────────────────────────────────────────────
  const pointer = { x: 0, y: 0, down: false, justPressed: false };
  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
  }
  canvas.addEventListener("pointermove", pointerPos);
  canvas.addEventListener("pointerdown", e => {
    pointerPos(e); pointer.down = true; pointer.justPressed = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", () => { pointer.down = false; });

  // ── Loop ─────────────────────────────────────────────────────────────────
  const STEP = 1 / 60;
  const MAX_STEPS = 3600;          // 60s of simulation caught up per tick
  let accumulator = 0, last = performance.now();
  let rafId = null, bgId = null;
  let uiTimer = 0, saveTimer = 10;

  function fishLine(dt, fishId, hold, tKey, b, c) {
    const f = ALL_FISH.find(x => x.id === fishId);
    if (!f || (!state.free && state.player.level < f.lvl)) return;
    const need = catchTime(f);
    hold[tKey] += dt;
    let guard = 0;
    while (hold[tKey] >= need && guard++ < 500) {
      hold[tKey] -= need;
      let count = 1, gain = fishXp(f);
      // Old Raven Scroll: the raven doubles this catch's XP on top of
      // everything else, and leaves a sea raven behind.
      if (Math.random() < ravenChance()) {
        gain *= 2;
        state.ravens++;
        refreshInventory(true);
        addRaven(b.rx, b.ry);
        addFloater("Raven!", b.rx, b.ry, "#a855f7");
      }
      gain *= 1 + scrollBuff("skull");          // Old Skull Scroll
      if (Math.random() < dblChance()) {
        count = 2; gain *= 2;
        addFloater("Double!", b.rx, b.ry);
      }
      let kind = "";
      if (Math.random() < boltChance()) {
        kind = "struck";
        gain *= STRUCK_MULT;
        const hx = b.rx, hy = b.ry;
        addBolt(hx, hy, () => addFloater("LIGHTNING!", hx, hy, "#eaf5ff"));
      } else if (stormOn() && Math.random() < 0.05) {
        kind = "struck";
        gain *= STRUCK_MULT;
        addFloater("Struck!", b.rx, b.ry, "#bfe0ff");
      } else if (Math.random() < encChance()) {
        kind = "ench";
        addFloater("Enchanted!", b.rx, b.ry, "#f0cf74");
      }
      const bag = bagOf(kind);
      bag[f.id] = (bag[f.id] || 0) + count;
      state.stats.caught += count;
      for (let i = 0; i < count; i++) {
        rollDrop(f);
        if (Math.random() < goldChance(f)) {
          state.gold++; state.stats.goldEarned++;
          addFloater("Gold!", b.rx, b.ry, "#e5bb4e");
        }
      }
      if (Math.random() < f.idx / (100 - lvlOf("infest"))) spawnGolden();
      if (Math.random() < resonChance()) {
        gain *= 2;
        addFloater("RESONANCE!", b.rx, b.ry, "rgb(" + RESON_RGB + ")");
        addResonSplash(b.rx, b.ry);
      }
      addXp(gain * (gemOn("gifted") ? 1.25 : 1));
      addSplash(b.rx, b.ry, 7, 170);
      reelIn(c);
    }
  }

  function update(dt) {
    state.time += dt;
    updatePond(dt);

    // catching
    updateFocus(dt);
    updateStorm(dt);
    stepRavens(dt);
    const picks = livePicks();
    for (let i = 0; i < picks.length; i++)
      fishLine(dt, picks[i], rods[i], "t", rods[i].bob, rods[i].cast);

    uiTimer -= dt;
    if (uiTimer <= 0) { uiTimer = 0.08; refreshFish(); paintIdent(); refreshInventory(); refreshEquip(); paintShop(); refreshUpgrades(); refreshPond(); refreshMuseum(); refreshForge(); refreshScrollUI(); paintProfile(); paintHud(); paintStormTag(); paintFocus(); }
    paintRush();                           // seconds-long, so every frame

    saveTimer -= dt;
    if (saveTimer <= 0) { saveTimer = 10; save(); }

    pointer.justPressed = false;
  }

  function render() {
    const t = state.time;
    // Rock tone rather than black, so anything the artwork does not cover
    // reads as more cavern floor instead of a bar.
    ctx.fillStyle = SCENE.fill;
    ctx.fillRect(0, 0, view.w, view.h);

    // The painted scene carries the grass, stones, pads and waterline, so the
    // procedural field, bank and dock no longer draw. Only the moving water
    // goes on top of it. Smoothing off keeps the pixel art hard-edged when the
    // strip scales it up.
    if (SCENE.ready) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(SCENE.img, fit.x, fit.y, fit.w, fit.h);
      ctx.imageSmoothingEnabled = true;
    }

    drawFoam(t);
    drawWater(t);
    drawAngler(t);

    for (const f of jumpers) drawFish(f);
    drawDroplets();

    for (const p of props) if (!p.back && !p.water) drawProp(p, t);  // near bank, on top
    drawFlies(t);
    drawGolden();
    drawStorm();
    drawRavens();
    drawFloaters();
  }

  function advance(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt < 0) dt = 0;
    // background timers are throttled hard, so allow a long catch-up
    if (dt > 60) dt = 60;
    updateGolden(dt);                      // wall clock, before the multipliers
    tickGems(dt);                          // also wall clock: dev speed must not mint gems
    state.stats.play += dt * state.speed;   // dev speed scales playtime too
    dt *= state.speed * beerMul();
    accumulator += dt;
    // cap the catch-up work so a long gap at 20x can't stall the tab
    let steps = 0;
    while (accumulator >= STEP && steps++ < MAX_STEPS) { update(STEP); accumulator -= STEP; }
    if (steps >= MAX_STEPS) accumulator = 0;
  }

  function frame(now) {
    advance(now);
    render();
    rafId = requestAnimationFrame(frame);
  }

  // Hidden tabs get no animation frames, so the sim moves to an interval and
  // catches up from the real clock; nothing is rendered until it is visible.
  function loopMode() {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      if (bgId === null) bgId = setInterval(() => advance(performance.now()), 200);
    } else {
      if (bgId !== null) { clearInterval(bgId); bgId = null; }
      if (rafId === null) rafId = requestAnimationFrame(frame);
    }
  }
  document.addEventListener("visibilitychange", loopMode);
  loopMode();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  // Dev: wipe the save and start over. Confirmed, because it is irreversible.
  document.getElementById("dev-reset").addEventListener("click", () => {
    if (!confirm("Reset the whole game? This erases your save and cannot be undone.")) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });

  window.game = {
    state, view, pond, dock, angler, bob, C, save,
    jump: spawnJumper,
    resetSave: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} },
    // game.free() toggles, game.free(true/false) sets it. Not saved.
    free: on => {
      setFree(on === undefined ? !state.free : !!on);
      return "everything free: " + state.free;
    },
  };
