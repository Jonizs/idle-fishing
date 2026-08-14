// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Panel wiring ─────────────────────────────────────────────────────────
  const elName  = document.getElementById("player-name");
  const elLevel = document.getElementById("player-level");
  const elXpFill = document.getElementById("xp-fill");
  const elXpText = document.getElementById("xp-text");
  const elGold   = document.getElementById("gold");
  const elSilver = document.getElementById("silver");
  const elGems   = document.getElementById("gems");
  const paneFish = document.getElementById("pane-fish");

  const nf = n => n.toLocaleString("en-US");
  // gold can be fractional now that low-tier gear sells for a quarter coin
  const nfg = n => (Number.isInteger(n) ? nf(n)
                  : (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }));

  const POND_LVL = 32;
  const pondBar  = document.querySelector('[data-tab="pond"]');
  const pondLock = document.getElementById("pond-lock");

  const scrollsBar  = document.querySelector('[data-tab="scrolls"]');
  const scrollsLock = document.getElementById("scrolls-lock");

  function refreshScrolls() {
    const open = state.free || lvlOf("scrolls") > 0;
    scrollsBar.disabled = !open;
    scrollsLock.hidden = open;
  }

  function refreshPondLock() {
    const open = state.free || state.player.level >= POND_LVL;
    pondBar.disabled = !open;
    pondLock.hidden = open;
  }

  const hudSpeed = document.getElementById("hud-speed");
  const hudDbl   = document.getElementById("hud-double");
  const hudEnch  = document.getElementById("hud-ench");
  const hudBolt  = document.getElementById("hud-bolt");
  const hudRaven = document.getElementById("hud-raven");
  const hudReson = document.getElementById("hud-reson");
  const lvlChart = document.getElementById("lvl-chart");

  // Levels reached, plotted as hours (y) against level (x).
  function paintChart() {
    const pts = Object.keys(state.stats.levelAt)
      .map(Number).sort((a, b) => a - b)
      .map(l => ({ l, h: state.stats.levelAt[l] / 3600 }));
    if (pts.length < 2) {
      lvlChart.innerHTML = '<span class="chart__empty">' +
        "Levels you reach from now on are plotted here." + "</span>";
      return;
    }
    const W = 300, H = 150, ml = 34, mr = 8, mt = 8, mb = 20;
    const x0 = pts[0].l, x1 = pts[pts.length - 1].l;
    const y1 = pts[pts.length - 1].h || 1;
    const px = l => ml + (x1 === x0 ? 0 : (l - x0) / (x1 - x0)) * (W - ml - mr);
    const py = h => H - mb - (h / y1) * (H - mt - mb);
    const nice = v => v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);

    let g = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet">';
    for (let i = 0; i <= 3; i++) {                       // horizontal guides
      const h = y1 * i / 3, y = py(h);
      g += '<line x1="' + ml + '" y1="' + y + '" x2="' + (W - mr) + '" y2="' + y +
           '" stroke="rgba(242,227,208,.13)" stroke-width="1"/>' +
           '<text x="' + (ml - 5) + '" y="' + (y + 3) + '" text-anchor="end" ' +
           'font-size="8" fill="rgba(242,227,208,.55)">' + nice(h) + "</text>";
    }
    const step = Math.max(1, Math.ceil((x1 - x0) / 6));
    for (let l = x0; l <= x1; l += step)
      g += '<text x="' + px(l) + '" y="' + (H - 6) + '" text-anchor="middle" ' +
           'font-size="8" fill="rgba(242,227,208,.55)">' + l + "</text>";
    g += '<polyline fill="none" stroke="#e0a054" stroke-width="2" points="' +
         pts.map(p => px(p.l) + "," + py(p.h)).join(" ") + '"/>';
    for (const p of pts)
      g += '<circle cx="' + px(p.l) + '" cy="' + py(p.h) + '" r="2" fill="#f2e3d0"/>';
    g += "</svg>";
    lvlChart.innerHTML = g;
  }
  const hudGold  = document.getElementById("hud-gold");
  const hudGame  = document.getElementById("hud-game");

  const stormTag = document.getElementById("storm-tag");
  const rushTag  = document.getElementById("rush-tag");
  const rushTime = document.getElementById("rush-time");
  const stormTime = document.getElementById("storm-time");

  function paintStormTag() {
    const on = stormOn();
    stormTag.hidden = !on;
    if (!on) return;
    const t = Math.max(0, Math.ceil(storm.t));
    stormTime.textContent = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  }

  // Redbull is an event now, not a silent multiplier: it gets its own tag and
  // counts itself down. Painted every frame, since it runs in seconds.
  function paintRush() {
    const on = rush.t > 0;
    rushTag.hidden = !on;
    if (on) rushTime.textContent = rush.t.toFixed(1) + "s";
  }

  function paintHud() {
    const f = ALL_FISH.find(x => x.id === state.picks[0]) || areaFish()[0];
    hudSpeed.textContent = "+" + ((speedMul() - 1) * 100).toFixed(1) + "%";
    hudDbl.textContent   = (dblChance() * 100).toFixed(1) + "%";
    hudEnch.textContent  = (encChance() * 100).toFixed(1) + "%";
    hudGold.textContent  = (goldChance(f) * 100).toFixed(3) + "%";
    hudGame.textContent  = (beerMul() * state.speed).toFixed(2) + "x";
    hudBolt.textContent  = (boltChance() * 100).toFixed(1) + "%";
    hudRaven.textContent = (ravenChance() * 100).toFixed(1) + "%";
    hudReson.textContent = (resonChance() * 100).toFixed(1) + "%";
  }

  // Gemstones: one per real hour with the game open. Deliberately on the wall
  // clock and outside beerMul / dev speed, so nothing in the game can mint the
  // paid currency faster. The part-hour is saved, so closing the tab at 59
  // minutes does not throw that time away.
  const GEM_SECS = 3600;
  function tickGems(realDt) {
    state.gemSecs += realDt;
    if (state.gemSecs < GEM_SECS) return;
    const n = Math.floor(state.gemSecs / GEM_SECS);
    state.gemSecs -= n * GEM_SECS;
    state.gems += n;
    paintIdent();
    dropToast("+" + n + " Gemstone" + (n > 1 ? "s" : ""), "#c084fc");
    save();
  }

  function paintIdent() {
    elName.textContent  = state.player.name || "—";
    elLevel.textContent = state.player.level;
    elGold.textContent   = nfg(state.gold);
    elSilver.textContent = nf(state.silver);
    elGems.textContent   = nf(state.gems);
    const need = xpToNext(state.player.level);
    elXpFill.style.width = Math.min(100, (state.player.xp / need) * 100).toFixed(2) + "%";
    elXpText.textContent = Math.floor(state.player.xp) + " / " + need + " XP";
  }

  // ── Inventory ────────────────────────────────────────────────────────────
  const INV_SLOTS = 100;
  const fishGrids = [];   // every 100-slot grid that shows the fish bag
  let invSig = "";

  const fishIcon = col =>
    '<svg class="slot__icon" viewBox="0 0 26 14" aria-hidden="true">' +
    '<path d="M17 7c0 3.3-3.6 5.6-8 5.6S1 10.3 1 7 4.6 1.4 9 1.4 17 3.7 17 7z" fill="' + col + '"/>' +
    '<path d="M17 7l8-4.6v9.2z" fill="' + col + '"/>' +
    '<circle cx="5.4" cy="5.8" r="1.1" fill="#2e130d"/></svg>';

  function buildFishGrid(el) {
    el.innerHTML = "";
    const slots = [];
    for (let i = 0; i < INV_SLOTS; i++) {
      const s = document.createElement("button");
      s.className = "slot";
      s.disabled = true;
      s.addEventListener("click", () => {
        const id = s.dataset.fish;
        if (id) openSell(id, s.dataset.kind || "");
      });
      el.appendChild(s);
      slots.push(s);
    }
    fishGrids.push(slots);
  }

  // ── Scroll UI ────────────────────────────────────────────────────────────
  const scrollBarSlots = [], scrollInvSlots = [];
  let scrollSig = "";

  // Rarity reads off the slot border, as it does for equipment, so the emblem
  // is always ink — a white Common emblem on the cream sheet would vanish.
  const scrollIcon = s =>
    '<svg class="slot__icon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" fill="var(--cream)" stroke="var(--bark-dd)" stroke-width=".9"/>' +
    s.emblem.replace(/\{c\}/g, "#2e130d") +
    '<rect x="4.2" y="3.6" width="15.6" height="3.6" rx="1.8" fill="var(--ember)" stroke="var(--bark-dd)" stroke-width=".9"/>' +
    '<rect x="4.2" y="16.8" width="15.6" height="3.6" rx="1.8" fill="var(--ember)" stroke="var(--bark-dd)" stroke-width=".9"/>' +
    "</svg>";

  const emptyScrollIcon =
    '<svg class="slot__icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-scroll"/></svg>';

  const scrollAmt = (v, fmt) =>
    fmt === "x" ? String(Math.round(v * 1000) / 1000) : (Math.round(v * 1000) / 10) + "%";
  const scrollLine = (s, r) => s.desc.replace("{v}", scrollAmt(s.per * r, s.fmt));
  const scrollTip  = (s, r) => s.name + " — " + scrollRarOf(r).name + "\n" + scrollLine(s, r);

  function buildScrollUI() {
    const bar = document.getElementById("scrolls-bar");
    bar.innerHTML = ""; scrollBarSlots.length = 0;
    for (let i = 0; i < SCROLL_SLOTS; i++) {
      const b = document.createElement("button");
      b.className = "slot";
      b.addEventListener("click", () => unequipScroll(i));
      bar.appendChild(b); scrollBarSlots.push(b);
    }
    const inv = document.getElementById("scrolls-inv");
    inv.innerHTML = ""; scrollInvSlots.length = 0;
    for (let i = 0; i < INV_SLOTS; i++) {
      const b = document.createElement("button");
      b.className = "slot";
      b.disabled = true;
      b.addEventListener("click", () => { if (b.dataset.key) equipScroll(b.dataset.key); });
      inv.appendChild(b); scrollInvSlots.push(b);
    }
  }

  function refreshScrollUI(force) {
    if (!scrollBarSlots.length) return;
    const bag = [];
    for (const k in state.scrolls) if (state.scrolls[k] > 0) {
      const it = parseScroll(k);
      bag.push({ k, id: it.id, r: it.r, n: state.scrolls[k] });
    }
    bag.sort((a, b) => b.r - a.r || a.id.localeCompare(b.id));
    const sig = bag.map(x => x.k + ":" + x.n).join("|") + "#" + state.scrollEq.join(",");
    if (!force && sig === scrollSig) return;
    scrollSig = sig;

    for (let i = 0; i < SCROLL_SLOTS; i++) {
      const el = scrollBarSlots[i], k = state.scrollEq[i];
      if (k) {
        const it = parseScroll(k), s = SCROLL[it.id];
        el.className = "slot slot--full srar--" + scrollRarOf(it.r).id;
        el.disabled = false;
        el.title = scrollTip(s, it.r);
        el.innerHTML = scrollIcon(s) + '<span class="slot__t">T' + it.r + "</span>";
      } else {
        el.className = "slot";
        el.disabled = true;
        el.removeAttribute("title");
        el.innerHTML = emptyScrollIcon;
      }
    }

    for (let i = 0; i < INV_SLOTS; i++) {
      const el = scrollInvSlots[i], x = bag[i];
      if (x) {
        const s = SCROLL[x.id];
        el.className = "slot slot--full srar--" + scrollRarOf(x.r).id;
        el.disabled = false;
        el.dataset.key = x.k;
        el.title = scrollTip(s, x.r) +
                   (scrollR(x.id) ? "\nOne of this type is already equipped." : "");
        el.innerHTML = scrollIcon(s) + '<span class="slot__t">T' + x.r + "</span>" +
                       '<span class="slot__n">' + nf(x.n) + "</span>";
      } else if (el.dataset.key || el.innerHTML) {
        el.className = "slot";
        el.disabled = true;
        delete el.dataset.key;
        el.removeAttribute("title");
        el.innerHTML = "";
      }
    }
  }

  function buildInventory() {
    buildScrollUI();
    fishGrids.length = 0;
    buildFishGrid(document.getElementById("inv"));
    buildFishGrid(document.getElementById("inv-fish"));
    const eq = document.getElementById("inv-equip");
    eq.innerHTML = "";
    eqSlots.length = 0;
    for (let i = 0; i < INV_SLOTS; i++) {
      const s = document.createElement("button");
      s.className = "slot";
      s.disabled = true;
      s.addEventListener("click", () => { if (s.dataset.kind) equipItem(s.dataset.kind, s.dataset.key); });
      eq.appendChild(s);
      eqSlots.push(s);
    }
    const cr = document.getElementById("inv-crates");
    cr.innerHTML = "";
    invCrateSlots.length = 0;
    for (let i = 0; i < CRATE_SLOTS; i++) {
      const s = document.createElement("button");
      s.className = "slot";
      s.disabled = true;
      s.addEventListener("click", () => { if (s.dataset.key) openCrateDlg(s.dataset.key); });
      cr.appendChild(s);
      invCrateSlots.push(s);
    }
  }

