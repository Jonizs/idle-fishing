// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Equipment: lures, bait, hats, rods, lines, crates ────────────────────
  // Bag keys are "rarity:tier" ("std:3"). state.equip holds the same key,
  // or "" for an empty slot.
  const eqSlots = [], crateSlots = [], dailySlots = [], invCrateSlots = [];
  const CRATE_SLOTS = 24;
  const KINDS = ["rod", "line", "lure", "bait", "hat", "crate"];
  const WEAR  = ["rod", "line", "lure", "bait", "hat"];   // the five worn slots
  const BAGS = {
    rod: () => state.rods,   line: () => state.lines, lure: () => state.lures,
    bait: () => state.baits, hat: () => state.hats,   crate: () => state.crates,
  };
  const EQ_EL = {}, EQ_PLACEHOLDER = {};
  for (const k of WEAR) {
    EQ_EL[k] = document.getElementById("eq-" + k);
    EQ_PLACEHOLDER[k] = EQ_EL[k].innerHTML;
    EQ_EL[k].addEventListener("click", () => unequipItem(k));
  }
  let eqSig = "";

  // `crate: true` marks a name that only ever labels a crate. It is not an
  // enchantment and must never appear where enchantments are listed.
  const RARITY = {
    std:       { name: "Standard",  bonus: "" },
    lucky:     { name: "Equipment", bonus: "", crate: true },
    refined:   { name: "Refined",   bonus: "+0.01x game speed per tier" },
    enchanted: { name: "Enchanted", bonus: "+2.5% catch speed per tier" },
    awakened:  { name: "Awakened",  bonus: "+2% double drop per tier" },
    ascended:  { name: "Ascended",  bonus: "+3% enchanted fish per tier" },
    // Event rarity: only ever comes out of a lightning crate.
    thunder:   { name: "Thunder",   bonus: "+0.2% lightning strike per tier" },
  };
  const KIND_NAME = { rod: "Rod", line: "Line", lure: "Lure", bait: "Bait",
                      hat: "Hat", crate: "Hat crate" };
  const KIND_BONUS = {
    rod:   t => "+" + (t * 0.01).toFixed(2) + "x game speed",
    line:  t => "x" + Math.pow(1.1, t).toFixed(2) + " gold coin chance",
    lure:  t => "+" + t * 5 + "% catch speed",
    bait:  t => "+" + (t * 2.5).toFixed(1) + "% double drop",
    hat:   t => "+" + (t * 2.5).toFixed(1) + "% enchanted fish",
    crate: () => "click to open",
  };

  const key    = (r, t) => r + ":" + t;
  const parse  = k => { const i = k.indexOf(":"); return { r: k.slice(0, i), t: +k.slice(i + 1) }; };
  const worn   = kind => (state.equip[kind] ? parse(state.equip[kind]) : null);
  const wornT  = kind => { const w = worn(kind); return w ? w.t : 0; };
  const rarSum = rar => {                       // tiers of every worn item of a rarity
    let n = 0;
    for (const k of WEAR) { const w = worn(k); if (w && w.r === rar) n += w.t; }
    return n;
  };

  const ICON_PATH = {
    rod:  '<path d="M4 20l13-13" stroke="COL" stroke-width="2.6" fill="none"/>' +
          '<path d="M17 7l4-4" stroke="COL" stroke-width="2.6" fill="none"/>' +
          '<circle cx="19" cy="16" r="1.8" fill="COL"/>',
    line: '<ellipse cx="12" cy="12" rx="5" ry="8" stroke="COL" stroke-width="2.4" fill="none"/>' +
          '<path d="M7 8h10M7 12h10M7 16h10" stroke="COL" stroke-width="1.6"/>',
    lure: '<path d="M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9z" fill="COL"/>' +
          '<circle cx="12" cy="9" r="1.5" fill="#2e130d"/>',
    bait: '<path d="M5 17c0-4 4-3 4-6s-3-3-3-5" stroke="COL" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<path d="M12 19c0-4 5-4 5-8s-3-4-3-7" stroke="COL" stroke-width="3" fill="none" stroke-linecap="round"/>',
    hat:  '<path d="M6 15c0-5 2-8 6-8s6 3 6 8z" fill="COL"/>' +
          '<path d="M2 16h20" stroke="COL" stroke-width="2.4" stroke-linecap="round"/>',
    crate:'<rect x="4" y="7" width="16" height="13" rx="1" fill="COL"/>' +
          '<path d="M4 11h16M12 7v13" stroke="#2e130d" stroke-width="1.6"/>' +
          '<path d="M3 7h18" stroke="COL" stroke-width="2.4" stroke-linecap="round"/>',
  };
  const itemIcon = (kind, tier) =>
    '<svg class="slot__icon" viewBox="0 0 24 24" aria-hidden="true">' +
    ICON_PATH[kind].split("COL").join(LURE_COL[tier - 1]) + "</svg>";
  const itemName = (kind, r, t) =>
    kind === "crate" ? RARITY[r].name + " tier " + t
                       + (r === "lucky" || r === "thunder" ? " crate" : " hat crate")
                     : RARITY[r].name + " tier " + t + " " + KIND_NAME[kind];
  const itemTip  = (kind, r, t) => itemName(kind, r, t) + " \u00b7 " + KIND_BONUS[kind](t) +
    (RARITY[r].bonus ? " \u00b7 " + RARITY[r].bonus.replace("per tier", "per tier (T" + t + ")") : "") +
    (kind === "crate" ? "" : " \u00b7 sells for " + nfg(goldValue(t)) + " gold");
  const rarCls = r => (r === "std" ? "" : " rar--" + r);
  const RAR_RANK = Object.keys(RARITY);
  // Highest tier first, then best enchantment, then slot so equal items group.
  const byTierThenRar = (a, b) =>
    b.t - a.t ||
    RAR_RANK.indexOf(b.r) - RAR_RANK.indexOf(a.r) ||
    WEAR.indexOf(a.kind) - WEAR.indexOf(b.kind);
  // Matches the border colours the rarity styles already use.
  const RAR_COL = {
    std:       "#c8ccd2",
    lucky:     "#5ad46a",
    refined:   "#a9b4be",
    enchanted: "#a9e7c8",
    awakened:  "#ef7fd0",
    ascended:  "#f7edb0",
    thunder:   "#63b6ff",
  };
  // what a spare piece of gear is worth, by tier
  const GOLD_VALUE = [0.25, 0.5, 1.5, 5, 15, 50, 180, 450, 1250, 8000];
  const goldValue = t => GOLD_VALUE[t - 1] || 0;
  // A slot rebuilt mid-cycle would start its own sweep out of step with the
  // rest, so every one is offset back onto a single shared 3s clock.
  const sheenDelay = () => (-(performance.now() % 3000)).toFixed(0) + "ms";

  function rollDrop(f) {
    // Lightning crates ride on top of the normal drop table, not instead of it,
    // and only fall while the storm is overhead.
    if (stormOn() && lvlOf("lightCrate") && Math.random() < 0.0001 * lvlOf("lightCrate") * f.idx)
      gainItem("crate", "thunder", 5);

    // Pirate Loot: 0.005% per fish tier for a common scroll of a random type.
    // Dark Arts doubles that to 0.01%.
    if (lvlOf("pirateLoot") && Math.random() < (lvlOf("darkArts") ? 0.0001 : 0.00005) * f.idx)
      gainScroll(SCROLLS[Math.floor(Math.random() * SCROLLS.length)].id, 1);

    // Dark Arts is also the only source of the Spyglass, which the Invertion
    // bench eats one of per tier 2 scroll.
    if (lvlOf("darkArts") && Math.random() < 0.00002 * f.idx) gainSpyglass();

    // White Monster lifts Redbull from 0.05% to 0.1% per fish tier and its
    // burst from 3.5s to 5s.
    if (lvlOf("redbull") && Math.random() < rushChance() * f.idx) {
      rush.t = rushLen();
      addFloater("Redbull!", bob.rx, bob.ry, "#5ad46a");
    }
    const cm = musCrate();                        // Ascended sets, multiplicative
    if (lvlOf("goldenCrate")) {
      if (Math.random() < 0.00005 * f.idx * cm)      gainItem("crate", "lucky", 4);
      else if (Math.random() < 0.0005 * f.idx * cm)  gainItem("crate", "lucky", 3);
    }
    if (lvlOf("enchCrate")) {
      if (Math.random() < 0.00005 * f.idx * cm)      gainItem("crate", "lucky", 3);
      else if (Math.random() < 0.0005 * f.idx * cm)  gainItem("crate", "lucky", 2);
    }
    if (lvlOf("luckyCrate")) {
      if (Math.random() < LUCKY_T2 * f.idx * cm)      gainItem("crate", "lucky", 2);
      else if (Math.random() < LUCKY_T1 * f.idx * cm) gainItem("crate", "lucky", 1);
    }
    if (lvlOf("muddyCrate")) {
      if (Math.random() < 0.00001 * f.idx * cm)     gainItem("crate", "lucky", 5);
      else if (Math.random() < 0.0001 * f.idx * cm) gainItem("crate", "lucky", 4);
    }
  }

  function gainItem(kind, r, tier) {
    const bag = BAGS[kind]();
    const k = key(r, tier);
    bag[k] = (bag[k] || 0) + 1;
    addFloater((kind === "crate" ? RARITY[r].name + " crate" : RARITY[r].name + " " + KIND_NAME[kind]) +
               " T" + tier + "!", bob.rx, bob.ry,
               r === "thunder" ? "#bfe0ff" : LURE_COL[tier - 1]);
  }

  function equipItem(kind, k) {
    if (kind === "crate") return openCrateDlg(k);
    const bag = BAGS[kind]();
    if (!(bag[k] > 0)) return;
    if (state.equip[kind]) bag[state.equip[kind]] = (bag[state.equip[kind]] || 0) + 1;
    bag[k]--;
    state.equip[kind] = k;
    refreshEquip(true); refreshFish(); save();
  }

  function unequipItem(kind) {
    const k = state.equip[kind];
    if (!k) return;
    const bag = BAGS[kind]();
    bag[k] = (bag[k] || 0) + 1;
    state.equip[kind] = "";
    refreshEquip(true); refreshFish(); save();
  }

  // Every spare stack, newest tier first. Equipped items live in state.equip
  // rather than the bags, so they can never appear here; crates are not gear.
  function spareGear() {
    const out = [];
    for (const kind of WEAR) {
      const bag = BAGS[kind]();
      for (const k in bag) if (bag[k] > 0) {
        const it = parse(k);
        out.push({ kind, k, r: it.r, t: it.t, n: bag[k], gold: goldValue(it.t) * bag[k] });
      }
    }
    return out.sort(byTierThenRar);
  }

  // Sell the given stacks for gold. Pass spareGear() for the lot.
  function sellGear(rows) {
    let total = 0, n = 0;
    for (const row of rows) {
      const bag = BAGS[row.kind]();
      const have = bag[row.k] || 0;
      if (!have) continue;
      total += goldValue(row.t) * have;
      n += have;
      delete bag[row.k];
    }
    if (!n) return;
    state.gold += total;
    dropToast("Sold " + nf(n) + " for " + nfg(total) + " gold", "#e5bb4e");
    paintIdent(); refreshEquip(true); paintShop(); save();
  }

  // ── Sell equipment dialog ────────────────────────────────────────────────
  const gearDlg   = document.getElementById("gear-dlg");
  const gearList  = document.getElementById("gear-list");
  const gearTotal = document.getElementById("gear-total");
  const gearGo    = document.getElementById("gear-go");
  const gearAll   = document.getElementById("gear-all");
  let gearRows = [];                       // the stacks on show
  const gearPicked = new Set();            // which of them are ticked, by key

  function openGearDlg() {
    gearRows = spareGear();
    gearPicked.clear();
    gearList.innerHTML = "";
    if (!gearRows.length) {
      gearList.innerHTML = '<div class="gear__empty">No spare equipment.</div>';
    }
    for (const row of gearRows) {
      const b = document.createElement("button");
      b.className = "gear__row";
      b.innerHTML = itemIcon(row.kind, row.t) +
        '<span class="gear__name">' + itemName(row.kind, row.r, row.t) + "</span>" +
        '<span class="gear__n">x' + nf(row.n) + "</span>" +
        '<span class="gear__gold">' + nfg(row.gold) + "</span>";
      b.addEventListener("click", () => {
        if (gearPicked.has(row.k + row.kind)) gearPicked.delete(row.k + row.kind);
        else gearPicked.add(row.k + row.kind);
        b.classList.toggle("gear__row--on");
        paintGearTotal();
      });
      gearList.appendChild(b);
    }
    gearAll.disabled = !gearRows.length;
    paintGearTotal();
    gearDlg.hidden = false;
  }

  function paintGearTotal() {
    const picked = gearRows.filter(r => gearPicked.has(r.k + r.kind));
    const total = picked.reduce((s, r) => s + r.gold, 0);
    gearTotal.textContent = nfg(total) + " Gold";
    gearGo.disabled = !picked.length;
  }

  document.getElementById("gear-cancel").addEventListener("click", () => { gearDlg.hidden = true; });
  gearDlg.addEventListener("click", e => { if (e.target === gearDlg) gearDlg.hidden = true; });
  gearGo.addEventListener("click", () => {
    sellGear(gearRows.filter(r => gearPicked.has(r.k + r.kind)));
    gearDlg.hidden = true;
  });
  gearAll.addEventListener("click", () => { sellGear(gearRows); gearDlg.hidden = true; });

  // ── Scroll bag ───────────────────────────────────────────────────────────
  function gainScroll(id, r) {
    const k = id + ":" + r;
    state.scrolls[k] = (state.scrolls[k] || 0) + 1;
    addFloater("Scroll!", bob.rx, bob.ry, scrollRarOf(r).col);
    refreshScrollUI(true);
  }

  // One of each type only: equipping a type already on the bar does nothing.
  function gainSpyglass() {
    state.spyglass++;
    addFloater("Spyglass!", bob.rx, bob.ry, "#d8c08a");
    refreshInvert(true);
  }

  function equipScroll(k) {
    const { id } = parseScroll(k);
    if (!state.scrolls[k]) return;
    if (scrollR(id)) return;
    const slot = state.scrollEq.indexOf("");
    if (slot < 0) return;
    state.scrolls[k]--;
    if (!state.scrolls[k]) delete state.scrolls[k];
    state.scrollEq[slot] = k;
    refreshScrollUI(true); paintIdent(); save();
  }

  function unequipScroll(slot) {
    const k = state.scrollEq[slot];
    if (!k) return;
    state.scrollEq[slot] = "";
    state.scrolls[k] = (state.scrolls[k] || 0) + 1;
    refreshScrollUI(true); paintIdent(); save();
  }

  // ── Crates ───────────────────────────────────────────────────────────────
  // Each crate rolls one standard hat off its own table. Weights sum to 1.
  // Priced against income at the level each becomes sensible, deliberately
  // steep: hats are permanent multipliers and more sinks are coming.
  const CRATES = [
    { tier: 1, cost: 1200,   table: [[1, .80], [2, .20]] },
    { tier: 2, cost: 12000,  table: [[2, .50], [3, .40], [4, .10]] },
    { tier: 3, cost: 60000,  table: [[3, .25], [4, .55], [5, .20]] },
    { tier: 4, cost: 140000, table: [[5, .70], [6, .30]] },
    { tier: 5, cost: 320000, table: [[6, .55], [7, .40], [8, .05]] },
  ];

  function buyCrate(tier) {
    const c = CRATES[tier - 1];
    if (!state.free && state.silver < c.cost) return;
    if (!state.free) state.silver -= c.cost;
    const k = key("std", tier);
    state.crates[k] = (state.crates[k] || 0) + 1;
    paintIdent(); refreshEquip(true); paintShop(); save();
  }

  // One crate. Returns what fell out; the caller handles toasts and refresh so
  // that opening a stack does not fire either of them once per crate.
  function rollCrate(k) {
    const it = parse(k), tier = it.t;
    state.crates[k]--;
    if (it.r === "thunder") {                     // one Thunder piece, any slot
      const kind = WEAR[Math.random() * WEAR.length | 0];
      const bag = BAGS[kind](), gk = key("thunder", tier);
      bag[gk] = (bag[gk] || 0) + 1;
      return { kind, rar: "thunder", tier, col: "#bfe0ff", bolt: true };
    }
    if (it.r === "lucky") {                       // equal odds across the five slots
      const kind = WEAR[Math.random() * WEAR.length | 0];
      const bag = BAGS[kind](), gk = key("std", tier);
      bag[gk] = (bag[gk] || 0) + 1;
      return { kind, rar: "std", tier, col: LURE_COL[tier - 1] };
    }
    const table = CRATES[tier - 1].table;
    let r = Math.random(), hat = table[table.length - 1][0];
    for (const [t, w] of table) { if (r < w) { hat = t; break; } r -= w; }
    const hk = key("std", hat);
    state.hats[hk] = (state.hats[hk] || 0) + 1;
    return { kind: "hat", rar: "std", tier: hat, col: LURE_COL[hat - 1] };
  }

  function openCrate(k, n) {
    n = Math.max(1, Math.min(state.crates[k] || 0, Math.floor(n || 1)));
    if (!(state.crates[k] > 0)) return;
    let last = null, bolt = false;
    for (let i = 0; i < n; i++) { last = rollCrate(k); bolt = bolt || !!last.bolt; }
    if (bolt) addBolt();
    if (n === 1) dropToast(itemName(last.kind, last.rar, last.tier), last.col);
    else dropToast(n + " crates opened", last.col);
    refreshEquip(true); paintShop(); save();
  }

