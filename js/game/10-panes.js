// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Fish list ────────────────────────────────────────────────────────────
  const fishEls = new Map();

  function buildFishList() {
    paneFish.innerHTML = "";
    fishEls.clear();
    for (const f of areaFish()) {
      const locked = !state.free && state.player.level < f.lvl;
      const b = document.createElement("button");
      b.className = "fish" + (locked ? " fish--locked" : "") + (isMut(f.id) ? " fish--mut" : "");
      b.disabled = locked;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML =
        '<span class="fish__fill"></span>' +
        '<span class="fish__top"><span class="fish__name">' + f.name +
          '<span class="fish__tier">(Tier ' + f.idx + ")</span></span>" +
        '<span class="fish__stat">' +
          (locked ? "Lv " + f.lvl : fishXp(f) + " XP &middot; " + catchTime(f).toFixed(1) + "s") +
        "</span></span>" +
        '<span class="fish__owned">Owned: 0</span>';
      if (!locked) b.addEventListener("click", () => selectFish(f.id));
      paneFish.appendChild(b);
      fishEls.set(f.id, {
        btn: b,
        fill: b.querySelector(".fish__fill"),
        owned: b.querySelector(".fish__owned"),
      });
    }
    refreshFish();
  }

  function refreshFish() {
    const picks = livePicks();
    for (const f of areaFish()) {
      const el = fishEls.get(f.id);
      if (!el) continue;
      const i = picks.indexOf(f.id);
      const prog = i >= 0 ? rods[i].t : 0;
      el.btn.setAttribute("aria-pressed", String(i >= 0));
      el.fill.style.width = i >= 0 ? Math.min(100, (prog / catchTime(f)) * 100).toFixed(1) + "%" : "0%";
      el.owned.textContent = "Owned: " + (state.owned[f.id] || 0);
    }
  }

  // As many fish as there are rods. Clicking a selected fish drops that rod;
  // picking one too many pushes the oldest out.
  function selectFish(id) {
    const n = rodCount();
    const at = state.picks.indexOf(id);
    if (at >= 0) {
      state.picks.splice(at, 1);
      rods.forEach(r => { r.t = 0; });
    } else {
      if (state.picks.length >= n) { state.picks.shift(); rods.forEach(r => { r.t = 0; }); }
      state.picks.push(id);
    }
    if (!state.picks.length) state.picks = [];
    refreshFish();
    save();
  }

  function addXp(n) {
    state.player.xp += n;
    state.stats.xpEarned += n;
    let leveled = false;
    while (state.player.xp >= xpToNext(state.player.level)) {
      state.player.xp -= xpToNext(state.player.level);
      state.player.level++;
      // Playtime at which each level was reached, for the progression graph.
      if (state.stats.levelAt[state.player.level] === undefined)
        state.stats.levelAt[state.player.level] = state.stats.play;
      leveled = true;
    }
    if (leveled) { buildFishList(); refreshUpgrades(); refreshPondLock(); refreshPond(); save(); }
    paintIdent();
  }

  // ── Upgrades pane ────────────────────────────────────────────────────────
  const paneUp = document.querySelector('[data-pane="upgrades"]');
  const upEls = new Map();

  function buildUpgrades() {
    paneUp.innerHTML = "";
    upEls.clear();
    for (const u of areaUpg()) {
      const b = document.createElement("button");
      b.className = "up";
      b.innerHTML =
        '<span class="up__top"><span class="up__name">' + u.name + "</span>" +
        '<span class="up__tier"></span></span>' +
        '<span class="up__desc">' + u.desc + "</span>" +
        '<span class="up__cost"></span>';
      b.addEventListener("click", () => buyUpgrade(u.id));
      paneUp.appendChild(b);
      upEls.set(u.id, {
        btn: b,
        tier: b.querySelector(".up__tier"),
        cost: b.querySelector(".up__cost"),
      });
    }
    refreshUpgrades();
  }

  function refreshUpgrades() {
    for (const u of areaUpg()) {
      const el = upEls.get(u.id);
      if (!el) continue;
      const t = lvlOf(u.id);
      const maxed  = t >= u.max;
      const need   = tierLvl(u, t);
      const locked = !state.free && state.player.level < need;
      const cost   = maxed ? 0 : u.costs[t];
      const poor   = !maxed && !locked && !state.free && state.silver < cost;

      el.tier.textContent = u.max > 1 ? t + " / " + u.max : (t ? "Owned" : "Not owned");
      el.cost.textContent = maxed ? "Maxed"
                          : locked ? "Requires Lv " + need
                          : nf(cost) + " Silver";
      el.btn.disabled = maxed || locked || poor;
      el.btn.className = "up" +
        (locked ? " up--locked" : "") +
        (maxed  ? " up--maxed"  : "") +
        (poor   ? " up--poor"   : "");
    }
  }

  function buyUpgrade(id) {
    const u = ALL_UPG.find(x => x.id === id);
    if (!u) return;
    const t = lvlOf(id);
    if (t >= u.max || (!state.free && state.player.level < tierLvl(u, t))) return;
    const cost = u.costs[t];
    if (!state.free && state.silver < cost) return;
    if (!state.free) state.silver -= cost;
    state.upgrades[id] = t + 1;
    paintIdent();
    refreshUpgrades();
    refreshFish();
    refreshScrolls();
    paintFocus();
    save();
  }

  document.querySelectorAll(".bars").forEach(group => {
    const side = group.dataset.group;
    const bars = [...group.querySelectorAll(".bar")];
    bars.forEach(bar => bar.addEventListener("click", () => {
      state.tabs[side] = bar.dataset.tab;
      bars.forEach(b => b.setAttribute("aria-selected", String(b === bar)));
      onTab(side, bar.dataset.tab);
    }));
  });
  document.querySelectorAll(".party__slot").forEach(slot =>
    slot.addEventListener("click", () => onPartySlot(+slot.dataset.party)));

  function onTab(side, tab) {
    if (side === "left") {
      showLeft(["shop", "inventory", "equipment", "profile", "museum", "forge", "scrolls",
        "invert", "gemshop"]
        .indexOf(tab) >= 0 ? tab : "main");
      return;
    }
    document.querySelectorAll(".pane").forEach(p => { p.hidden = p.dataset.pane !== tab; });
  }
  function onPartySlot(index) {}
  const mapScreen = document.getElementById("map-screen");
  function onMap() { mapScreen.hidden = !mapScreen.hidden; }
  // No Back button any more, so the map needs another way out: click anywhere
  // that is not a zone, or press Escape. The Map button itself sits under the
  // overlay, so it cannot be relied on to toggle back.
  mapScreen.addEventListener("click", e => {
    if (!e.target.closest(".map__zone")) mapScreen.hidden = true;
  });
  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && !mapScreen.hidden) mapScreen.hidden = true;
  });
  document.getElementById("map-image").setAttribute("href", window.MAP_JPEG);
  // Starter pond and Wade are real destinations. Altitude and Deep are still
  // outlined and gated but lead nowhere.
  mapScreen.querySelectorAll(".map__zone").forEach(zone => {
    zone.addEventListener("click", () => {
      const loc = zone.dataset.loc;
      if (!AREAS[loc]) return;
      if (!state.free && state.player.level < +zone.dataset.lvl) return;
      travelTo(loc);
      mapScreen.hidden = true;
    });
  });

  // Wade has no fish or upgrades of its own yet, so its Fish and Upgrades
  // panes are deliberately empty and the Pond tab is swapped for the Dojo.
  function travelTo(area) {
    if (!AREAS[area] || state.area === area) { paintArea(); return; }
    state.picksBy[state.area] = state.picks;      // park what was on the line
    state.area = area;
    state.picks = state.picksBy[area] || [];
    for (const r of rods) { r.t = 0; r.cast.phase = "idle"; }
    paintArea();
    save();
  }

  function paintArea() {
    const wade = state.area === "wade";
    SCENE = AREAS[state.area];
    document.documentElement.classList.toggle("area-wade", wade);

    const bar = t => document.querySelector('.bars[data-group="right"] .bar[data-tab="' + t + '"]');
    const pondBar = bar("pond"), dojoBar = bar("dojo");
    pondBar.hidden = wade;
    dojoBar.hidden = !wade;
    if (wade) {
      const open = state.free || state.player.level >= 70;
      dojoBar.disabled = !open;
      document.getElementById("dojo-lock").hidden = open;
    }
    // Both panes follow whichever location you are standing in.
    buildFishList(); refreshFish();
    buildUpgrades(); refreshUpgrades();
    // the tab that was open may have just been hidden
    const cur = state.tabs.right;
    if ((cur === "pond" && wade) || (cur === "dojo" && !wade)) {
      state.tabs.right = "fish";
      document.querySelectorAll('.bars[data-group="right"] .bar')
        .forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === "fish")));
      onTab("right", "fish");
    }
    resize();
  }

  // Paints the LV n badges each time the map opens.
  function paintMapLocks() {
    mapScreen.querySelectorAll(".map__zone[data-lvl]").forEach(zone => {
      const need = +zone.dataset.lvl;
      const open = state.free || state.player.level >= need;
      zone.classList.toggle("map__zone--locked", !open);
      const tag = document.getElementById("map-lock-" + zone.dataset.loc);
      if (tag) tag.hidden = open;
      const ico = document.getElementById("map-locki-" + zone.dataset.loc);
      if (ico) ico.style.display = open ? "none" : "";
    });
  }

  document.getElementById("map-btn").addEventListener("click", () => { paintMapLocks(); onMap(); });

  // ── Pond pane ────────────────────────────────────────────────────────────
  const paneBreed = document.getElementById("pond-breeder");

  const pondTabs = [...document.querySelectorAll(".pondtab")];
  const paneFood = document.getElementById("pond-food");
  const paneFly  = document.getElementById("pond-fly");
  const paneStorm = document.getElementById("pond-storm");
  const pondEls  = new Map();
  const breedEls = new Map();

  const pondLocked = pane =>
    !state.free && state.player.level < +document.querySelector('.pondtab[data-pane="' + pane + '"]').dataset.lvl;

  function refreshPond() {
    for (const t of pondTabs) {
      const need = +t.dataset.lvl;
      const locked = !state.free && state.player.level < need;
      t.classList.toggle("pondtab--locked", locked);
      t.querySelector(".pondtab__lvl").textContent = locked ? "(Lv " + need + ")" : "";
    }
    for (const u of POND_UPG) {
      const el = pondEls.get(u.id);
      if (!el) continue;
      const t = lvlOf(u.id);
      const maxed  = t >= u.max;
      const locked = pondLocked(u.pane);
      const cost   = maxed ? 0 : u.costs[t];
      const poor   = !maxed && !locked && !state.free && state.silver < cost;

      el.tier.textContent = u.max > 1 ? t + " / " + u.max : (t ? "Owned" : "Not owned");
      el.cost.textContent = maxed ? "Maxed" : nf(cost);
      el.btn.disabled = maxed || locked || poor;
      el.btn.className = "pondslot pondslot--up" +
        (maxed ? " pondslot--maxed" : "") +
        (poor  ? " pondslot--poor"  : "");
    }
    refreshBreed();
  }

  function refreshBreed() {
    const tabLocked = pondLocked("breed");
    for (const [id, el] of breedEls) {
      const done   = isMut(id);
      const locked = tabLocked || (!state.free && state.player.level < el.m.lvl);
      const poor   = !done && !locked && !state.free && state.silver < el.m.cost;
      el.note.textContent = done ? "Mutated"
                          : locked ? "Lv " + el.m.lvl
                          : nf(el.m.cost);
      el.btn.disabled = done || locked || poor;
      el.btn.className = "pondslot pondslot--breed" +
        (done ? " pondslot--mutated" : "") +
        (locked ? " pondslot--gated" : "") +
        (poor ? " pondslot--poor" : "");
    }
  }

  function mutateFish(id) {
    const m = MUT[id];
    if (!m || isMut(id) || pondLocked("breed")) return;
    if (!state.free && state.player.level < m.lvl) return;
    if (!state.free && state.silver < m.cost) return;
    if (!state.free) state.silver -= m.cost;
    state.mutated[id] = true;
    paintIdent();
    buildFishList();
    refreshInventory(true);
    refreshPond();
    save();
  }

  function buyPond(id) {
    const u = POND_UPG.find(x => x.id === id);
    if (!u) return;
    const t = lvlOf(id);
    if (t >= u.max || pondLocked(u.pane)) return;
    const cost = u.costs[t];
    if (!state.free && state.silver < cost) return;
    if (!state.free) state.silver -= cost;
    state.upgrades[id] = t + 1;
    paintIdent();
    refreshPond();
    refreshFish();
    refreshInventory(true);
    save();
  }

  const PANE_EL = { food: paneFood, fly: paneFly, storm: paneStorm };

  function buildPond() {
    paneFood.innerHTML = "";
    paneFly.innerHTML = "";
    paneStorm.innerHTML = "";
    pondEls.clear();
    for (const u of POND_UPG) {
      const b = document.createElement("button");
      b.className = "pondslot pondslot--up";
      b.innerHTML =
        '<span class="pondslot__top"><span class="pondslot__name">' + u.name + "</span>" +
        '<span class="pondslot__tier"></span></span>' +
        '<span class="pondslot__desc">' + u.desc + "</span>" +
        '<span class="pondslot__cost"></span>';
      b.addEventListener("click", () => buyPond(u.id));
      PANE_EL[u.pane].appendChild(b);
      pondEls.set(u.id, { btn: b, tier: b.querySelector(".pondslot__tier"), cost: b.querySelector(".pondslot__cost") });
    }
    paneBreed.innerHTML = "";
    breedEls.clear();
    for (const f of FISH) {
      const m = MUT[f.id];
      const b = document.createElement("button");
      b.className = "pondslot pondslot--breed";
      b.dataset.fish = f.id;
      b.innerHTML =
        '<span class="pondslot__fish">' + f.name + "</span>" +
        '<span class="pondslot__mut"></span>';
      b.addEventListener("click", () => mutateFish(f.id));
      paneBreed.appendChild(b);
      breedEls.set(f.id, { btn: b, note: b.querySelector(".pondslot__mut"), m });
    }
    refreshPond();
  }

