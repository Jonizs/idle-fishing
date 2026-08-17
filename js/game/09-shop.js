// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // Fading text for whatever you just got.
  const toastEl = document.getElementById("drop-toast");
  let toastT = null;
  // Notices rise from just above the angler's head, on the play field, so
  // every piece of feedback reads in one place.
  function dropToast(text, col) {
    addFloater(text, angler.x + angler.u * 1.2, angler.y - angler.u * 2.4, col);
  }

  const sellExtrasBtn = document.getElementById("sell-extras");
  sellExtrasBtn.addEventListener("click", openGearDlg);

  function refreshEquip(force) {
    const st = [], crs = [];
    for (const kind of KINDS) {
      const bag = BAGS[kind]();
      for (const k in bag) if (bag[k] > 0) {
        const it = parse(k);
        (kind === "crate" ? crs : st).push({ kind, k, r: it.r, t: it.t, n: bag[k] });
      }
    }
    st.sort(byTierThenRar);
    crs.sort(byTierThenRar);
    const sig = st.concat(crs).map(x => x.kind + x.k + ":" + x.n).join("|") + "#" +
                WEAR.map(k => state.equip[k]).join(",");
    if (!force && sig === eqSig) return;
    eqSig = sig;

    for (let i = 0; i < INV_SLOTS; i++) {
      const el = eqSlots[i], x = st[i];
      if (x) {
        el.className = "slot slot--full" + rarCls(x.r) + (x.t === LURE_MAX ? " slot--glow" : "");
        el.style.setProperty("--sheen", sheenDelay());
        el.disabled = false;
        el.dataset.kind = x.kind;
        el.dataset.key  = x.k;
        el.title = itemTip(x.kind, x.r, x.t);
        el.innerHTML = itemIcon(x.kind, x.t) + '<span class="slot__t">T' + x.t + "</span>" +
                       '<span class="slot__n">' + nf(x.n) + "</span>";
      } else if (el.dataset.kind || el.innerHTML) {
        el.className = "slot";
        el.disabled = true;
        delete el.dataset.kind; delete el.dataset.key;
        el.removeAttribute("title");
        el.innerHTML = "";
      }
    }

    for (let i = 0; i < CRATE_SLOTS; i++) {
      const el = invCrateSlots[i], x = crs[i];
      if (x) {
        el.className = "slot slot--full" + rarCls(x.r);
        el.style.setProperty("--sheen", sheenDelay());
        el.disabled = false;
        el.dataset.key = x.k;
        el.title = itemTip("crate", x.r, x.t);
        el.innerHTML = itemIcon("crate", x.t) + '<span class="slot__t">T' + x.t + "</span>" +
                       '<span class="slot__n">' + nf(x.n) + "</span>";
      } else if (el.dataset.key || el.innerHTML) {
        el.className = "slot";
        el.disabled = true;
        delete el.dataset.key;
        el.removeAttribute("title");
        el.innerHTML = "";
      }
    }

    let spare = 0;
    for (const x of st) spare += goldValue(x.t) * x.n;
    sellExtrasBtn.disabled = spare <= 0;
    sellExtrasBtn.textContent = spare > 0 ? "Sell equipment \u00b7 " + nfg(spare) + " gold" : "Sell equipment";

    for (const kind of WEAR) {
      const w = worn(kind), el = EQ_EL[kind];
      el.className = "eqslot" + (w ? " eqslot--full" + rarCls(w.r) : "") +
                     (w && w.t === LURE_MAX ? " slot--glow" : "");
      el.style.setProperty("--sheen", sheenDelay());
      el.title = w ? itemTip(kind, w.r, w.t) : "";
      el.innerHTML = w ? itemIcon(kind, w.t) + '<span class="slot__n">T' + w.t + "</span>"
                       : EQ_PLACEHOLDER[kind];
    }
  }

  function stacks() {
    const out = [];
    for (const k of ["struck", "ench", ""])
      for (const f of ALL_FISH) {
        const n = bagOf(k)[f.id] || 0;
        if (n > 0) out.push({ f, kind: k, n });
      }
    return out;
  }

  const STRUCK_MULT = 8;
  const bagOf = k => (k === "ench" ? state.ench : k === "struck" ? state.struck : state.owned);
  const kindMult = k => (k === "ench" ? ENCH_MULT : k === "struck" ? STRUCK_MULT : 1);
  const kindLabel = k => (k === "ench" ? "Enchanted " : k === "struck" ? "Struck " : "");
  // Bread lifts the shelf price; rounded per fish so silver stays whole.
  const priceOf = (f, k) =>
    Math.round(fishPrice(f) * (1 + 0.025 * lvlOf("bread") + 0.05 * lvlOf("marketExp"))) * kindMult(k);

  const sellAllValue = () => {
    let total = 0;
    for (const k of ["", "ench", "struck"]) {
      const bag = bagOf(k);
      for (const f of ALL_FISH) total += priceOf(f, k) * (bag[f.id] || 0);
    }
    return total;
  };

  // Sea ravens live in the fish inventory but are not one of the nine fish:
  // they have no price, so they stay out of stacks() and sellAllValue() and
  // their slot is not clickable.
  const RAVEN = { id: "searaven", name: "Sea Raven", col: "#101010" };

  // The fog's crafting fish sit beside the ravens for the same reason: no
  // price, no sell, held for a craft that does not exist yet.
  const fogStacks = () => Object.keys(state.fogFish)
    .filter(id => state.fogFish[id] > 0 && FOG_BY_ID[id])
    .map(id => ({ f: FOG_BY_ID[id], kind: "fogfish", n: state.fogFish[id] }));

  function refreshInventory(force) {
    const st = stacks();
    for (const s of fogStacks()) st.unshift(s);
    if (state.ravens > 0) st.unshift({ f: RAVEN, kind: "raven", n: state.ravens });
    const sig = st.map(s => s.f.id + s.kind + (isMut(s.f.id) ? "m" : "") + ":" + s.n).join("|")
              + "#" + sellAllValue();
    if (!force && sig === invSig) return;
    invSig = sig;
    for (const slots of fishGrids) for (let i = 0; i < INV_SLOTS; i++) {
      const el = slots[i], s = st[i];
      if (s) {
        const raven = s.kind === "raven", fogf = s.kind === "fogfish";
        el.className = "slot slot--full"
                     + (s.kind === "ench" ? " slot--ench" : "")
                     + (s.kind === "struck" ? " slot--struck" : "")
                     + (raven ? " slot--raven" : "")
                     + (fogf ? " slot--fogfish" : "")
                     + (isMut(s.f.id) ? " slot--mut" : "");
        el.disabled = raven || fogf;
        if (raven || fogf) { delete el.dataset.fish; delete el.dataset.kind; }
        else { el.dataset.fish = s.f.id; el.dataset.kind = s.kind; }
        el.title = kindLabel(s.kind) + (isMut(s.f.id) ? "Mutated " : "") + s.f.name;
        // A fog slot that is already showing this fish only has its count
        // rewritten: a full innerHTML rebuild would wipe the motes and restart
        // all 38 of them on every repaint.
        if (fogf && el.dataset.fogfish === s.f.id) {
          const nEl = el.querySelector(".slot__n");
          if (nEl) nEl.textContent = nf(s.n);
        } else {
          el.innerHTML = fishIcon(s.kind === "ench" ? "#f0cf74"
                                : s.kind === "struck" ? "#bfe0ff" : s.f.col) +
                         '<span class="slot__n">' + nf(s.n) + "</span>";
          if (fogf) { el.dataset.fogfish = s.f.id; seedMotes(el, true); }
          else delete el.dataset.fogfish;
        }
      } else if (el.dataset.fish || el.innerHTML) {
        el.className = "slot";
        el.disabled = true;
        delete el.dataset.fish;
        delete el.dataset.ench;
        delete el.dataset.fogfish;
        el.removeAttribute("title");
        el.innerHTML = "";
      }
    }
    const sellAllBtn = document.getElementById("sell-all");
    sellAllBtn.disabled = st.length === 0;
    sellAllBtn.textContent = st.length ? "Sell all · " + nf(sellAllValue()) : "Sell all";
  }

  // ── Selling ──────────────────────────────────────────────────────────────
  const sellBox  = document.getElementById("sell");
  const sellName = document.getElementById("sell-name");
  const sellInfo = document.getElementById("sell-info");
  const sellAmt  = document.getElementById("sell-amt");
  const sellTot  = document.getElementById("sell-total");
  const sellGo   = document.getElementById("sell-go");
  let sellId = null, sellEnch = "";

  function paintSell() {
    const f = ALL_FISH.find(x => x.id === sellId);
    if (!f) return;
    const have = bagOf(sellEnch)[f.id] || 0;
    let n = Math.floor(+sellAmt.value || 0);
    n = Math.max(0, Math.min(have, n));
    sellAmt.max = have;
    sellInfo.textContent = "Owned " + nf(have) + " · " + nf(priceOf(f, sellEnch)) + " silver each";
    sellTot.textContent = nf(priceOf(f, sellEnch) * n) + " Silver";
    sellGo.disabled = n <= 0;
  }

  function openSell(id, kind) {
    sellId = id; sellEnch = kind || "";
    const f = ALL_FISH.find(x => x.id === id);
    sellName.textContent = kindLabel(sellEnch) + f.name;
    sellAmt.value = 1;
    sellBox.hidden = false;
    paintSell();
    sellAmt.focus();
    sellAmt.select();
  }

  function doSell(id, kind, n) {
    const f = ALL_FISH.find(x => x.id === id);
    if (!f) return;
    const bag = bagOf(kind);
    const have = bag[f.id] || 0;
    n = Math.max(0, Math.min(have, Math.floor(n)));
    if (!n) return;
    bag[f.id] = have - n;
    state.silver += priceOf(f, kind) * n;
    state.stats.silverEarned += priceOf(f, kind) * n;
    paintIdent();
    refreshInventory(true);
    refreshFish();
    refreshUpgrades();
    save();
  }

  sellAmt.addEventListener("input", paintSell);
  sellAmt.addEventListener("keydown", e => { if (e.key === "Enter" && !sellGo.disabled) sellGo.click(); });
  document.querySelectorAll(".sell__quick button").forEach(b =>
    b.addEventListener("click", () => {
      const have = bagOf(sellEnch)[sellId] || 0;
      const q = b.dataset.q;
      sellAmt.value = q === "all" ? have : q === "half" ? Math.max(1, Math.floor(have / 2)) : +q;
      paintSell();
    }));
  // ── Crate dialog ─────────────────────────────────────────────────────────
  // Same shape as the sell dialog: quick amounts, a live total, one confirm.
  const crateBox  = document.getElementById("crate-dlg");
  const crateName = document.getElementById("crate-name");
  const crateInfo = document.getElementById("crate-info");
  const crateAmt  = document.getElementById("crate-amt");
  const crateTot  = document.getElementById("crate-total");
  const crateGo   = document.getElementById("crate-go");
  let crateKey = null;

  function paintCrate() {
    const have = state.crates[crateKey] || 0;
    let n = Math.floor(+crateAmt.value || 0);
    n = Math.max(0, Math.min(have, n));
    crateAmt.max = have;
    crateInfo.textContent = "Owned " + nf(have);
    crateTot.textContent = n > 0 ? "Open " + nf(n) : "Open";
    crateGo.disabled = n <= 0;
  }

  function openCrateDlg(k) {
    if (!(state.crates[k] > 0)) return;
    crateKey = k;
    const it = parse(k);
    crateName.textContent = itemName("crate", it.r, it.t);
    crateAmt.value = 1;
    crateBox.hidden = false;
    paintCrate();
    crateAmt.focus();
    crateAmt.select();
  }

  crateAmt.addEventListener("input", paintCrate);
  crateAmt.addEventListener("keydown", e => { if (e.key === "Enter" && !crateGo.disabled) crateGo.click(); });
  document.querySelectorAll(".crate__quick button").forEach(b =>
    b.addEventListener("click", () => {
      const have = state.crates[crateKey] || 0;
      const q = b.dataset.q;
      crateAmt.value = q === "all" ? have : q === "half" ? Math.max(1, Math.floor(have / 2)) : +q;
      paintCrate();
    }));
  document.getElementById("crate-cancel").addEventListener("click", () => { crateBox.hidden = true; });
  crateBox.addEventListener("click", e => { if (e.target === crateBox) crateBox.hidden = true; });
  crateGo.addEventListener("click", () => {
    openCrate(crateKey, +crateAmt.value);
    crateBox.hidden = true;
  });

  document.getElementById("sell-cancel").addEventListener("click", () => { sellBox.hidden = true; });
  sellBox.addEventListener("click", e => { if (e.target === sellBox) sellBox.hidden = true; });
  sellGo.addEventListener("click", () => {
    doSell(sellId, sellEnch, +sellAmt.value);
    sellBox.hidden = true;
  });

  document.getElementById("sell-all").addEventListener("click", () => {
    let total = 0;
    for (const k of ["", "ench", "struck"]) {
      const bag = bagOf(k);
      for (const f of ALL_FISH) {
        const have = bag[f.id] || 0;
        if (!have) continue;
        total += priceOf(f, k) * have;
        bag[f.id] = 0;
      }
    }
    if (!total) return;
    state.silver += total;
    state.stats.silverEarned += total;
    paintIdent();
    refreshInventory(true);
    refreshFish();
    refreshUpgrades();
    save();
  });

  // ── Shop view ────────────────────────────────────────────────────────────
  const leftMain = document.getElementById("left-main");
  const leftShop = document.getElementById("left-shop");
  const leftInv  = document.getElementById("left-inv");
  const leftEquip = document.getElementById("left-equip");
  const leftProf = document.getElementById("left-profile");
  const leftMuseum = document.getElementById("left-museum");
  const leftForge = document.getElementById("left-forge");
  const leftScrolls = document.getElementById("left-scrolls");
  const leftInvert = document.getElementById("left-invert");
  const leftGemshop = document.getElementById("left-gemshop");

  document.querySelectorAll(".shopsec__row").forEach(row => {
    const stocked = row.id === "crate-row";
    for (let i = 0; i < +row.dataset.slots; i++) {
      const d = document.createElement(stocked ? "button" : "div");
      d.className = "shopslot";
      if (row.id === "crate-row") {
        const tier = i + 1;
        d.innerHTML = itemIcon("crate", tier) +
                      '<span class="slot__t">T' + tier + "</span>" +
                      '<span class="shopslot__cost">' + nf(CRATES[tier - 1].cost) + "</span>";
        d.title = itemName("crate", "std", tier) + " \u00b7 " + nf(CRATES[tier - 1].cost) + " silver";
        d.addEventListener("click", () => buyCrate(tier));
        crateSlots.push(d);
      }
      row.appendChild(d);
    }
  });

  function paintShop() {
    for (let i = 0; i < crateSlots.length; i++) {
      const ok = state.free || state.silver >= CRATES[i].cost;
      crateSlots[i].disabled = !ok;
      crateSlots[i].classList.toggle("shopslot--buy", ok);
    }
  }

  function showLeft(view) {
    leftMain.hidden = view !== "main";
    leftShop.hidden = view !== "shop";
    leftInv.hidden  = view !== "inventory";
    leftEquip.hidden = view !== "equipment";
    leftProf.hidden = view !== "profile";
    leftMuseum.hidden = view !== "museum";
    leftForge.hidden = view !== "forge";
    leftScrolls.hidden = view !== "scrolls";
    leftInvert.hidden = view !== "invert";
    leftGemshop.hidden = view !== "gemshop";
    if (view === "shop" || view === "inventory" || view === "equipment") {
      refreshInventory(true); refreshEquip(true); paintShop();
    }
    if (view === "profile") paintProfile();
    if (view === "museum") refreshMuseum();
    if (view === "forge") refreshForge(true);
    if (view === "scrolls") refreshScrollUI(true);
    if (view === "invert") refreshInvert(true);
    if (view === "gemshop") paintGemshop();
  }

  const elPlay   = document.getElementById("st-play");
  const elStSil  = document.getElementById("st-silver");
  const elStGold = document.getElementById("st-gold");
  const elStCau  = document.getElementById("st-caught");
  const elStXp   = document.getElementById("st-xp");

  function hms(sec) {
    sec = Math.floor(sec);
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600);
    const m = Math.floor(sec % 3600 / 60), s2 = sec % 60;
    if (d) return d + "d " + h + "h " + m + "m";
    if (h) return h + "h " + m + "m " + s2 + "s";
    if (m) return m + "m " + s2 + "s";
    return s2 + "s";
  }

  function paintProfile() {
    if (leftProf.hidden) return;
    paintChart();
    const st = state.stats;
    elPlay.textContent   = hms(st.play);
    elStSil.textContent  = nf(Math.floor(st.silverEarned));
    elStGold.textContent = nf(Math.floor(st.goldEarned));
    elStCau.textContent  = nf(st.caught);
    elStXp.textContent   = nf(Math.floor(st.xpEarned));
  }

  (() => {
    const btn = document.getElementById("museum-info");
    const body = document.getElementById("museum-info-body");
    btn.addEventListener("click", () => {
      body.hidden = !body.hidden;
      btn.setAttribute("aria-expanded", String(!body.hidden));
    });
  })();

  // Collapsible nav group: header toggles the body, items inside stay tabs.
  (() => {
    const btn = document.getElementById("hud-btn");
    const hud = document.getElementById("hud");
    btn.addEventListener("click", () => {
      hud.hidden = !hud.hidden;
      btn.setAttribute("aria-expanded", String(!hud.hidden));
    });
  })();

  // ── Gem shop ─────────────────────────────────────────────────────────────
  const gemUpEls = [...document.querySelectorAll("[data-gemup]")];

  function gemLeft(k) {   // "6d 4h" / "38m" left on a timed buff
    const ms = state.gemBuf[k] - Date.now();
    if (ms <= 0) return "";
    const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
    if (d > 0) return d + "d " + (h - d * 24) + "h left";
    if (h > 0) return h + "h " + Math.floor(ms / 60000 - h * 60) + "m left";
    return Math.max(1, Math.floor(ms / 60000)) + "m left";
  }

  function paintGemshop() {
    for (const el of gemUpEls) {
      const k = el.dataset.gemup, u = GEM_UPG[k], on = gemOn(k);
      const afford = state.free || state.gems >= u.cost;
      el.classList.toggle("gemup--on", on);
      el.classList.toggle("gemup--poor", !on && !afford);
      el.disabled = on && k === "gifted";
      el.querySelector(".gemup__t").textContent =
        k === "gifted" ? (on ? "Owned" : "Permanent")
                       : (on ? gemLeft(k) : u.days + " days");
    }
  }

  function buyGemUp(k) {
    const u = GEM_UPG[k];
    if (k === "gifted" && gemOn(k)) return;
    if (!state.free && state.gems < u.cost) return;
    if (!state.free) state.gems -= u.cost;
    // Buying again while it runs extends rather than restarts.
    if (k === "gifted") state.gemBuf.gifted = 1;
    else state.gemBuf[k] = Math.max(Date.now(), state.gemBuf[k] || 0) + u.days * 864e5;
    paintIdent(); paintGemshop(); save();
  }
  gemUpEls.forEach(el => el.addEventListener("click", () => buyGemUp(el.dataset.gemup)));
  setInterval(() => { if (!leftGemshop.hidden) paintGemshop(); }, 1000);

  // Inventory section headers fold their grid away, like the nav groups.
  document.querySelectorAll(".inv__h--fold").forEach(h => {
    const body = h.nextElementSibling;
    h.addEventListener("click", () => {
      const open = h.getAttribute("aria-expanded") !== "true";
      h.setAttribute("aria-expanded", String(open));
      body.hidden = !open;
    });
  });

  document.querySelectorAll(".navgrp__h").forEach(h => {
    const body = h.nextElementSibling;
    h.addEventListener("click", () => {
      const open = h.getAttribute("aria-expanded") !== "true";
      h.setAttribute("aria-expanded", String(open));
      body.hidden = !open;
    });
  });

  ["shop-back", "inv-back", "equip-back", "prof-back", "museum-back", "forge-back",
   "scrolls-back", "invert-back", "gemshop-back"].forEach(id =>
    document.getElementById(id).addEventListener("click", () => {
      showLeft("main");
      const bars = [...document.querySelectorAll('[data-group="left"] .bar')];
      bars.forEach(b => b.setAttribute("aria-selected", "false"));
      state.tabs.left = "main";
    }));

