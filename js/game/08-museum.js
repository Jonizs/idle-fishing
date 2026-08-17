// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Museum ───────────────────────────────────────────────────────────────
  // One rail per set: every rarity at tier 1, plus event rarities at the only
  // tier they drop at. Donating consumes the piece for good.
  // Buffs are not designed yet — `buff` is the slot they will live in.
  // Every worn rarity at every tier, plus event rarities only at the tier they
  // drop at. Equipment is deliberately absent: those crates yield Standard gear, so
  // no worn item is ever Lucky and the rail could never be filled.
  // Derived, so a crate-only name can never leak into the wardrobe.
  const MUSEUM_RAR = Object.keys(RARITY).filter(r => !RARITY[r].crate && r !== "thunder");
  const MUSEUM_EVENT = { 5: ["thunder"] };
  const MUSEUM_BUFF = {
    std:       t => "+" + (2 * t) + "% catch speed",
    refined:   t => "+" + (0.02 * t).toFixed(2) + "x game speed",
    enchanted: t => "+" + t + "% double drop",
    awakened:  t => "+" + t + "% enchanted fish",
    ascended:  t => "x" + (1 + 0.02 * t).toFixed(2) + " crate drop rate",
    thunder:   () => "+2% lightning strike",
  };
  const MUSEUM_SETS = [];
  for (let t = 1; t <= LURE_MAX; t++)
    for (const r of MUSEUM_RAR.concat(MUSEUM_EVENT[t] || []))
      MUSEUM_SETS.push({ r, t, buff: MUSEUM_BUFF[r](t) });

  // Sum of the tiers of every completed set of a rarity. Every museum buff is
  // linear in that sum, so ten Ascended sets give 1 + 0.02*55 = 2.1x.
  function museumSum(rar) {
    let n = 0;
    for (const set of MUSEUM_SETS)
      if (set.r === rar && (state.museum[key(set.r, set.t)] || []).length === WEAR.length) n += set.t;
    return n;
  }
  const musSpeed = () => 0.02 * museumSum("std");
  const musGame  = () => 0.02 * museumSum("refined");
  const musDbl   = () => 0.01 * museumSum("enchanted");
  const musEnc   = () => 0.01 * museumSum("awakened");
  const musCrate = () => 1 + 0.02 * museumSum("ascended");
  const musBolt  = () => (museumSum("thunder") ? 0.02 : 0);

  // Every way a worn item can enter the game, derived from the live tables so
  // it stays honest if a drop source changes.
  // Built on first use, not at load: CRATES is declared further down the
  // file, so evaluating this eagerly would hit the temporal dead zone.
  let OBTAINABLE = null;
  function buildObtainable() {
    const set = new Set();
    const add = (kind, r, t) => set.add(kind + ":" + r + ":" + t);
    for (const t of [1, 2]) { add("lure", "std", t); add("bait", "std", t); }  // common drops
    for (const c of CRATES) for (const [t] of c.table) add("hat", "std", t);   // hat crates
    for (const t of [1, 2, 3, 4])                                              // equipment crates
      for (const k of WEAR) add(k, "std", t);
    for (const k of WEAR) add(k, "thunder", 5);                                // lightning crates
    for (let t = 1; t <= ROD_TIERS[ROD_TIERS.length - 1].length; t++)           // golden fish
      for (const r of ["std", "refined", "enchanted", "awakened"]) add("rod", r, t);
    // Forging lifts an item a rung, so obtainability propagates up the ladder
    // from whatever the drop tables actually provide.
    for (let i = 0; i < FORGE_LADDER.length - 1; i++)
      for (const kind of WEAR)
        for (let t = 1; t <= LURE_MAX; t++)
          if (set.has(kind + ":" + FORGE_LADDER[i] + ":" + t))
            add(kind, FORGE_LADDER[i + 1], t);
    return set;
  }
  // Forging walks this ladder; Lucky and Thunder sit outside it.
  const FORGE_LADDER = ["std", "refined", "enchanted", "awakened", "ascended"];
  const FORGE_COST = 5;
  const nextRar = r => {
    const i = FORGE_LADDER.indexOf(r);
    return i >= 0 && i < FORGE_LADDER.length - 1 ? FORGE_LADDER[i + 1] : null;
  };

  const canObtain = (kind, r, t) => {
    if (!OBTAINABLE) OBTAINABLE = buildObtainable();
    return OBTAINABLE.has(kind + ":" + r + ":" + t);
  };

  // True when a rail exists for this rarity and tier and that slot is empty.
  const MUSEUM_HAS = {};
  for (const set of MUSEUM_SETS) MUSEUM_HAS[key(set.r, set.t)] = true;
  const wantedByMuseum = (kind, r, t) => {
    const k = key(r, t);
    return !!MUSEUM_HAS[k] && (state.museum[k] || []).indexOf(kind) < 0;
  };

  const museumRails = document.getElementById("museum-rails");
  const railEls = [], groupEls = [], museumOpen = {};

  const setKey    = set => key(set.r, set.t);
  const donated   = set => state.museum[setKey(set)] || [];
  const hasDonated = (set, kind) => donated(set).indexOf(kind) >= 0;
  const setComplete = set => donated(set).length === WEAR.length;

  function donate(set, kind) {
    if (hasDonated(set, kind)) return;
    const bag = BAGS[kind](), k = setKey(set);
    if (!(bag[k] > 0)) return;
    bag[k]--;
    state.museum[k] = donated(set).concat(kind);
    dropToast("Donated " + itemName(kind, set.r, set.t), LURE_COL[set.t - 1]);
    // Refresh, not rebuild: buildMuseum() recreates every rail, which collapses
    // whichever tier group is open and jumps the whole list upward.
    refreshMuseum();
    refreshEquip(true);
    save();
  }

  // Built from RARITY and KIND_BONUS so it can never drift from the real rules.
  function buildMuseumInfo() {
    const body = document.getElementById("museum-info-body");
    let h = '<span class="minfo__h">Rarities</span>';
    for (const r of MUSEUM_RAR.concat(["thunder"])) {
      const b = RARITY[r].bonus || "no bonus";
      h += '<div class="minfo__row"><span class="minfo__k" style="color:' + RAR_COL[r] + '">' +
           RARITY[r].name + "</span><span>" + b + "</span></div>";
    }
    h += '<span class="minfo__h">Slots</span>';
    for (const k of WEAR)
      h += '<div class="minfo__row"><span class="minfo__k">' + KIND_NAME[k] +
           "</span><span>" + KIND_BONUS[k](1) + " per tier</span></div>";
    h += '<span class="minfo__h">Sets</span>' +
         "<div>A set is all five slots at one rarity and tier. " +
         "Donating is permanent. Special rarities only come in a single tier.</div>";
    body.innerHTML = h;
  }

  function buildMuseum() {
    museumRails.innerHTML = "";
    railEls.length = 0;
    groupEls.length = 0;
    for (let t = 1; t <= LURE_MAX; t++) {
      const sets = MUSEUM_SETS.filter(x => x.t === t);
      if (!sets.length) continue;

      const grp = document.createElement("div");
      grp.className = "mgrp";
      const head = document.createElement("button");
      head.className = "mgrp__head";
      head.setAttribute("aria-expanded", String(!!museumOpen[t]));
      head.innerHTML = '<span class="mgrp__caret">\u25b8</span>' +
                       '<span class="mgrp__name">Tier ' + t + "</span>" +
                       '<span class="mgrp__count"></span>';
      const body = document.createElement("div");
      body.className = "mgrp__body";
      body.hidden = !museumOpen[t];
      head.addEventListener("click", () => {
        museumOpen[t] = !museumOpen[t];
        body.hidden = !museumOpen[t];
        head.setAttribute("aria-expanded", String(!!museumOpen[t]));
      });
      grp.appendChild(head);
      grp.appendChild(body);
      museumRails.appendChild(grp);

      const rails = [];
      for (const set of sets) {
        const rail = document.createElement("div");
        rail.className = "rail";
        const top = document.createElement("div");
        top.className = "rail__top";
        top.innerHTML = '<span class="rail__name" style="color:' + RAR_COL[set.r] + '">' +
                        RARITY[set.r].name + "</span>" +
                        '<span class="rail__count"></span>';
        const slots = document.createElement("div");
        slots.className = "rail__slots";
        rail.appendChild(top);
        rail.appendChild(slots);
        if (set.buff) {
          const b = document.createElement("span");
          b.className = "rail__buff";
          b.textContent = set.buff;
          rail.appendChild(b);
        }
        const cells = {};
        for (const kind of WEAR) {
          const b = document.createElement("button");
          b.className = "rail__slot";
          b.innerHTML = itemIcon(kind, set.t);
          b.addEventListener("click", () => donate(set, kind));
          slots.appendChild(b);
          cells[kind] = b;
        }
        body.appendChild(rail);
        const entry = { set, rail, cells, count: top.querySelector(".rail__count") };
        railEls.push(entry);
        rails.push(entry);
      }
      groupEls.push({ tier: t, rails, head, count: head.querySelector(".mgrp__count") });
    }
    refreshMuseum();
  }

  function refreshMuseum() {
    if (leftMuseum.hidden) return;
    for (const g of groupEls) {
      const done = g.rails.filter(r => setComplete(r.set)).length;
      g.count.textContent = done + " / " + g.rails.length + " sets";
      const want = g.rails.some(r =>
        WEAR.some(k => !hasDonated(r.set, k) && (BAGS[k]()[setKey(r.set)] || 0) > 0));
      g.head.classList.toggle("mgrp__head--want", want);
    }
    for (const { set, rail, cells, count } of railEls) {
      const inCase = donated(set);
      count.textContent = inCase.length + " / " + WEAR.length;
      rail.className = "rail" + (setComplete(set) ? " rail--done" : "");
      for (const kind of WEAR) {
        const el = cells[kind];
        const done = inCase.indexOf(kind) >= 0;
        const have = (BAGS[kind]()[setKey(set)] || 0) > 0;
        const none = !done && !canObtain(kind, set.r, set.t);
        el.disabled = done || !have;
        el.className = "rail__slot" + (done ? " rail__slot--in"
                                     : have ? " rail__slot--have"
                                     : none ? " rail__slot--none" : "");
        el.title = done ? itemName(kind, set.r, set.t) + " \u00b7 in the museum"
                 : have ? "Donate " + itemName(kind, set.r, set.t)
                 : none ? itemName(kind, set.r, set.t) + " \u00b7 no source drops this"
                 : "Need " + itemName(kind, set.r, set.t);
      }
    }
  }

  // ── Forge ────────────────────────────────────────────────────────────────
  const forgeList = document.getElementById("forge-list");
  const forgeInv  = document.getElementById("forge-inv");
  const forgeSlots = [], forgeInvSlots = [];
  const FORGE_SLOTS = 20;
  let forgeSig = "";

  function forgeItem(kind, k) {
    const it = parse(k), up = nextRar(it.r);
    if (!up) return;
    const bag = BAGS[kind]();
    if (!(bag[k] >= FORGE_COST)) return;
    bag[k] -= FORGE_COST;
    if (!bag[k]) delete bag[k];
    const nk = key(up, it.t);
    bag[nk] = (bag[nk] || 0) + 1;
    dropToast("Forged " + itemName(kind, up, it.t), LURE_COL[it.t - 1]);
    refreshEquip(true);
    refreshForge(true);
    save();
  }

  function buildForge() {
    for (const [el, arr, n, onClick] of [
      [forgeList, forgeSlots, FORGE_SLOTS, (s) => forgeItem(s.dataset.kind, s.dataset.key)],
      [forgeInv, forgeInvSlots, INV_SLOTS, (s) => equipItem(s.dataset.kind, s.dataset.key)],
    ]) {
      el.innerHTML = "";
      arr.length = 0;
      for (let i = 0; i < n; i++) {
        const b = document.createElement("button");
        b.className = "slot";
        b.disabled = true;
        b.addEventListener("click", () => { if (b.dataset.kind) onClick(b); });
        el.appendChild(b);
        arr.push(b);
      }
    }
  }

  // One pass over everything forgeable. Repeats until nothing is left, so a
  // stack of 25 walks all the way up the ladder.
  function forgeAll() {
    let made = 0;
    for (let pass = 0; pass < 20; pass++) {
      let did = 0;
      for (const kind of WEAR) {
        const bag = BAGS[kind]();
        for (const k of Object.keys(bag)) {
          const it = parse(k), up = nextRar(it.r);
          if (!up) continue;
          while (bag[k] >= FORGE_COST) {
            bag[k] -= FORGE_COST;
            if (!bag[k]) delete bag[k];
            const nk = key(up, it.t);
            bag[nk] = (bag[nk] || 0) + 1;
            did++; made++;
          }
        }
      }
      if (!did) break;
    }
    if (!made) return;
    dropToast(made === 1 ? "Forged 1 item" : "Forged " + made + " items", "#e5bb4e");
    refreshEquip(true); refreshForge(true); save();
  }
  document.getElementById("forge-all").addEventListener("click", forgeAll);

  // ── Invertion ────────────────────────────────────────────────────────────
  // The scroll ladder's only rung: five tier 1 scrolls of one type, plus a
  // flat toll of ravens and one Spyglass, become one tier 2 of that type.
  const INVERT_SCROLLS = 5, INVERT_RAVENS = 1250, INVERT_GLASS = 1;
  const invertList = document.getElementById("invert-list");
  const invertSlots = [];
  const matRavens  = document.getElementById("mat-ravens");
  const matGlass   = document.getElementById("mat-glass");
  const matScrolls = document.getElementById("mat-scrolls");
  const matScrollN = document.getElementById("mat-scroll-n");
  const invertGo   = document.getElementById("invert-go");
  let invertSig = "";
  let invertPick = "";      // the chosen tier 1 scroll key, session only

  const canInvert = k => !!k && (state.scrolls[k] || 0) >= INVERT_SCROLLS &&
                         state.ravens >= INVERT_RAVENS &&
                         state.spyglass >= INVERT_GLASS;

  function pickInvert(k) {
    invertPick = invertPick === k ? "" : k;
    refreshInvert(true);
  }
  invertGo.addEventListener("click", () => invertScroll(invertPick));

  function invertScroll(k) {
    if (!canInvert(k)) return;
    const { id } = parseScroll(k);
    state.scrolls[k] -= INVERT_SCROLLS;
    if (!state.scrolls[k]) delete state.scrolls[k];
    state.ravens   -= INVERT_RAVENS;
    state.spyglass -= INVERT_GLASS;
    const nk = id + ":2";
    state.scrolls[nk] = (state.scrolls[nk] || 0) + 1;
    dropToast("Inverted " + SCROLL[id].name, scrollRarOf(2).col);
    refreshInvert(true); refreshScrollUI(true); refreshInventory(true); save();
  }

  function buildInvert() {
    invertList.innerHTML = "";
    invertSlots.length = 0;
    for (let i = 0; i < SCROLLS.length; i++) {
      const b = document.createElement("button");
      b.className = "slot";
      b.disabled = true;
      b.addEventListener("click", () => { if (b.dataset.key) pickInvert(b.dataset.key); });
      invertList.appendChild(b);
      invertSlots.push(b);
    }
  }

  function refreshInvert(force) {
    if (!invertSlots.length) return;
    if (leftInvert.hidden && !force) return;
    const rows = [];
    for (const s of SCROLLS) {
      const k = s.id + ":1", n = state.scrolls[k] || 0;
      if (n > 0) rows.push({ k, s, n });
    }
    rows.sort((a, b) => b.n - a.n || a.s.id.localeCompare(b.s.id));
    // A pick that ran out of scrolls stops being a pick.
    if (invertPick && !state.scrolls[invertPick]) invertPick = "";
    const sig = rows.map(x => x.k + ":" + x.n).join("|") +
                "#" + state.ravens + "#" + state.spyglass + "#" + invertPick;
    if (!force && sig === invertSig) return;
    invertSig = sig;

    const held = invertPick ? state.scrolls[invertPick] || 0 : 0;
    matScrollN.textContent = invertPick ? SCROLL[parseScroll(invertPick).id].name : "Scrolls";
    matScrolls.textContent = nf(Math.min(held, INVERT_SCROLLS)) + " / " + nf(INVERT_SCROLLS);
    matRavens.textContent = nf(state.ravens) + " / " + nf(INVERT_RAVENS);
    matGlass.textContent  = nf(state.spyglass) + " / " + nf(INVERT_GLASS);
    invertGo.disabled = !canInvert(invertPick);

    for (let i = 0; i < invertSlots.length; i++) {
      const el = invertSlots[i], x = rows[i];
      if (x) {
        el.className = "slot slot--full srar--common" +
                       (x.n >= INVERT_SCROLLS ? " slot--forge" : "") +
                       (x.k === invertPick ? " slot--pick" : "");
        el.disabled = false;
        el.dataset.key = x.k;
        el.title = x.s.name + "\n" + nf(x.n) + " / " + INVERT_SCROLLS + " tier 1" +
                   "\nClick to select it for inverting.";
        el.innerHTML = scrollIcon(x.s) + '<span class="slot__t">T1</span>' +
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

  function refreshForge(force) {
    if (leftForge.hidden && !force) return;
    const all = [], ready = [];
    for (const kind of WEAR) {
      const bag = BAGS[kind]();
      for (const k in bag) if (bag[k] > 0) {
        const it = parse(k);
        const x = { kind, k, r: it.r, t: it.t, n: bag[k] };
        all.push(x);
        if (nextRar(it.r) && bag[k] >= FORGE_COST) ready.push(x);
      }
    }
    all.sort(byTierThenRar);
    ready.sort(byTierThenRar);
    const sig = all.map(x => x.kind + x.k + ":" + x.n).join("|");
    if (!force && sig === forgeSig) return;
    forgeSig = sig;

    const fill = (slots, list, extra) => {
      for (let i = 0; i < slots.length; i++) {
        const el = slots[i], x = list[i];
        if (x) {
          el.className = "slot slot--full" + rarCls(x.r) + (extra ? " " + extra : "");
          el.style.setProperty("--sheen", sheenDelay());
          el.disabled = false;
          el.dataset.kind = x.kind;
          el.dataset.key  = x.k;
          el.title = extra
            ? "Forge 5 into " + itemName(x.kind, nextRar(x.r), x.t)
            : itemTip(x.kind, x.r, x.t);
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
    };
    const btn = document.getElementById("forge-all");
    btn.disabled = !ready.length;
    fill(forgeSlots, ready, "slot--forge");
    fill(forgeInvSlots, all, "");
  }

