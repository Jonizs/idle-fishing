# idle-fishing

An idle fishing game. Single-page, no build step, no server, no dependencies.
Canvas for the pond scene, DOM for the UI.

```
idle-fishing.html     markup + the script tags, no logic
css/                  base, fish, panels, inventory, layout, effects, scrolls
js/data/              fish, progression, upgrades, mutations, pond, scrolls, map
js/game/              the game script, 01-core … 11-boot
simulations/          curve.js, costs.js, model.js, tdz.js, *.test.js
```

`js/game/` is one program cut into eleven files. They are **not** wrapped in
IIFEs — they share one top-level lexical scope, which is what lets them keep
calling each other by name. **Load order is the original order and must not
change**, and a new file needs its `<script src>` tag adding by hand.

| File | Holds |
|---|---|
| `01-core.js` | canvas handle, palette, save/load, data destructure |
| `02-stats.js` | storm, scrolls, gem buffs, every stat formula, `state`, `save()` |
| `03-scene.js` | layout maths, painted scene, grass, scenery scatter |
| `04-pond.js` | ripples, droplets, jumpers, floaters |
| `05-draw.js` | scenery, dock, angler, water — all canvas drawing |
| `06-panels.js` | panel wiring, HUD, ident, inventory, scroll UI |
| `07-items.js` | equipment, sell dialog, scroll bag, crates |
| `08-museum.js` | museum, forge |
| `09-shop.js` | daily shop, selling, crate dialog, shop view, gem shop |
| `10-panes.js` | fish list, upgrades pane, pond pane |
| `11-boot.js` | layout mode, dev menu, name gate, pointer, the loop, startup |

Open `idle-fishing.html` in a browser. The folders must sit next to it.

`To do.txt` is the owner's own idea list. Do not read it, act on it, or tidy
it — it is not a task list for you.

---

## How to work here — read this first

The owner does not write code and tests every change by reloading the browser.
That makes **them** the test suite and **you** the typist. Optimise for a fast
loop, not for certainty before shipping.

### Do

- Make the change. Run `node simulations/tdz.js`. Say what changed in one or
  two sentences. Stop.
- Read only the lines you need to edit. A `grep -n` for the anchor beats
  reading the section.
- For multi-part edits, use one script that asserts every anchor before
  writing, so it all lands or none of it does.
- Flag a real design problem in one sentence if you see one, then move on.
  Don't turn it into a memo.

### Don't

- **Don't build test harnesses.** Two exist (`scrolls.test.js`,
  `crates.test.js`); run them if you touched those systems, but do not write
  more. They cost more than they catch — every regression that actually
  shipped in this project was one they could not see.
- **Don't re-verify what you just wrote** by dumping it back out, rendering
  previews, or grepping to confirm your own edit landed. The assert did that.
- **Don't over-explain.** No summaries of the architecture, no lists of files
  touched, no "two things I'd flag" unless one genuinely matters.
- **Don't gold-plate.** Asked for a button, build a button. No accompanying
  stats panel, no tooltip system, no refactor along the way.
- **Don't print long output.** Never `cat` a data file, never let base64 or a
  stack trace containing it reach the terminal. `js/data/map.js` is 280KB on
  one line — grep around it, never open it.

### Ask when

The request contradicts the code, or a name already exists, or two readings
are plausible. One short question beats a wrong build. This has paid off
repeatedly.

---

## Verification, honestly

`node simulations/tdz.js` executes every `<script src>` in one shared scope,
then the inline script, against a stubbed DOM. It proves the file loads. Run
it after every change. It takes a second.

**It cannot see any of these, and all four have shipped:**

| Failure | What it looked like |
|---|---|
| CSS split through a comment | stray `*/` killed the first rules of two files |
| `const` collision across scripts | data files silently didn't run, `0 / 0 XP` |
| New element missing from a CSS rule | crate dialog had no positioning, never appeared |
| `NaN` in canvas coordinates | raven drew nothing, no error anywhere |

The pattern: **it checks JavaScript, not the browser.** CSS, layout, canvas
drawing, and whether a function is ever reached are all invisible to it. Don't
try to close that gap with more tooling — hand the build over and let the
owner reload.

---

## Traps, in the order they bit

1. **Classic scripts share one global lexical scope.** Every file in
   `js/data/` is wrapped in an IIFE because five files declaring `const D`
   collide and only the first runs. Keep the wrapper. Files in `js/game/`
   want the opposite — no wrapper, because they rely on that shared scope.
   Never add an IIFE to one, and never declare the same name in two of them.
2. **No ES modules.** `import` is CORS-fetched and `file://` has an opaque
   origin, so modules break "open the file in a browser". Classic
   `<script src>` and `<link>` only.
3. **`tdz.js` can't spot a missing `<script src>` tag.** Add a file under
   `js/`, add the tag.
4. **New overlays need adding to the shared CSS rule.** `#gate, #sell,
   #crate-dlg` in `css/inventory.css`. A new dialog with no entry there is
   invisible.
5. **Early returns.** `updateStorm()` returns in several branches; anything
   stepped from inside it stops running when the storm system is locked. Step
   per-frame things from the loop.
6. **Scene scale is `angler.u`.** There is no `view.u`. Canvas silently draws
   nothing for `NaN`.
7. **Declaration order matters inside the IIFE.** A const read above its
   declaration killed the page once.
8. **`build*()` must appear in both startup branches.** An unbuilt Museum
   shipped this way.
9. **The Museum is lazy-built.** Do not make it eager; that killed the page.
10. **Fish ids do not match display names.** Fish 1 is "Sardine" with id
    `lanternfish`; fish 6 is "Anchovy" with id `sardine`. Ids are what saves
    key off.
11. **Don't split CSS on line numbers.** Boundaries must land outside comment
    blocks.

---

## Which files does a task touch?

| Task | Files |
|---|---|
| Add / retune a fish | `js/data/fish.js` |
| Reprice or add an upgrade | `js/data/upgrades.js` |
| XP curve | `js/data/progression.js` |
| Mutations | `js/data/mutations.js` |
| Pond tab upgrades | `js/data/pond.js` |
| Scroll types, effects, icons | `js/data/scrolls.js` |
| Styling only | the matching `css/*.css` |
| Markup, a new element or dialog | `idle-fishing.html` |
| Everything else | the matching `js/game/*.js` — see the table up top |
| A catch formula (speed, double, gold, enchant) | `js/data/formulas.js` |
| Balance question | `simulations/` — run them, don't guess |

Pricing note: `UPGRADES` entries with `max > 1` are **split into two tiers
each at 45/55** on load, so a listed cost is not the in-game cost. `nosplit:
true` opts out. `POND_UPG` and `MUTATE` are never split.

---

## Data layer

Each file in `js/data/` attaches to `globalThis.GAME_DATA`; the IIFE
destructures the lot in one line near the top. `globalThis` rather than
`window` so Node can `require()` the same files — that is how the tools read
them.

| File | Exports |
|---|---|
| `fish.js` | `FISH` (nine fish, `idx` assigned here) |
| `progression.js` | `EARLY_XP`, `LATE_FROM`, `LATE_XP`, `xpToNext` |
| `upgrades.js` | `UPGRADES` (already split), `splitCost`, `tierLvl` |
| `mutations.js` | `MUTATE`, `MUT` |
| `pond.js` | `POND_UPG` |
| `scrolls.js` | `SCROLLS`, `SCROLL_RAR` |
| `map.js` | `MAP_JPEG` — 280KB base64, never open it |
| `formulas.js` | `makeFormulas(ctx)` — the catch formulas, DOM-free so Node can load them |

---

## Systems

**Fish.** Nine, unlocking by level. `rodCount()` is 1, 2 with `twoRods`, 3
with `trifecta`. Catches roll struck > enchanted (exclusive), then double drop.

**Storm.** Rolls every 300s, 1/10 rising to 1/3 after 50 dry minutes. 1.5x
catch speed, 5% struck fish (8x xp and price, electric-blue border). Lightning
crates only drop mid-storm.

**Museum.** Ten tier groups, one rail per rarity, five slots each. Donating is
permanent. Set buffs are linear in completed tiers. **Standard sets are the
strongest thing in the game** — all ten give +110% catch speed against ~+90%
from the whole upgrade tree. Unresolved.

**Forge.** 5 identical → 1 of the next rarity: Standard → Refined → Enchanted
→ Awakened → Ascended. Thunder and Equipment sit outside the ladder, so
**Thunder duplicates have no sink**. "Forge all" loops until nothing is left.

**Scrolls.** Nine types, six rarities, one of each type equippable, nine bar
slots. Effects are linear in the equipped scroll's rarity. Dropped by Pirate
Loot (Lv 32) at 0.005% per fish tier, **common only** — tiers 2-6 are
currently unreachable in play. Old Raven Scroll drops a sea raven and doubles
that catch's XP; ravens live in the normal fish inventory, are not one of the
nine fish, and stay out of `stacks()` and `sellAllValue()`.

**Gem shop.** Three gem-bought buffs (`GEM_UPG`, state `gemBuf`): Speed Demon,
Premium Fishing, Gifted Fisherman. The first two run 14 real days, extended by
rebuying; Gifted is permanent. **They are premium purchases and must never
enter any silver or gold calculation** — keep them out of `simulations/`,
out of pricing and payback maths, and out of any balance argument. Four
real-money gem packs sit below them and are display-only.

**Crates.** Clicking one opens a dialog with 1 / 10 / Half / All. `rollCrate`
does one; `openCrate(key, n)` loops and refreshes once.

**Map.** Screenshot of the map screen, base64 in `js/data/map.js`, viewBox
`0 0 1440 720`. Four `.map__zone` polygons; **only Starter pond is live** —
the rest carry `data-lvl` (Wade 54, Altitude 125, Deep 180) and show a padlock
plus `LV n`, but lead nowhere. Area names are live SVG text, not baked in.
There is a faint ghost of the old Altitude label under its replacement; only a
label-free source image fixes that properly.

**Dev menu.** Free (lifts all gates), Showcase, Storm, Thunder set, Reset
(wipes the save, confirmed).

**Save.** `localStorage`, guarded. Keys added over time: `mutated`, `struck`,
`museum`, `stats.levelAt`, `scrolls`, `scrollEq`, `ravens`. All guarded
individually — `Object.assign` would leave new keys undefined for old saves.
Never break an existing save.

---

## Balance tools

`simulations/curve.js` — Lv 1 to 52 from the real tables. Currently ~27h with
golden fish, ~33h without. Storms are rolled, so runs vary a few percent.

`simulations/costs.js` — prices tiers by marginal payback, calibrated against
the tuned pond lines (band: 10m-14h per tier). Findings still open:

- **Mutations are mispriced by construction.** Mutation changes `xp`/`price`
  but not `time`, which inverts the fish order — mutated Sardine beats Bass.
  Once the best `rodCount()` fish are mutated, the rest are worth nothing at
  any price. The fix is the formula, not the costs.
- **The Storm's tier 10 pays back in 52h** against 45m for tier 1.
- **Lightning Crate tiers all reach the same ceiling**; they buy time, not
  power, then are worth zero.

`simulations/model.js` — older Lv 32+ model behind the Fish Food prices.

The owner reprices often. When they do, don't re-derive the whole curve unless
asked; change the numbers and move on.

---

## Open questions

1. Museum Standard sets dwarf the upgrade tree.
2. Golden fish 2.2x target is unreachable as specced.
3. Mutation / Storm / Lightning Crate pricing — modelled, needs a decision.
4. Wade / Altitude / Deep water are outlined and gated but lead nowhere.
5. Scroll rarities above common have no source.
6. Mythic and Common are both white, per spec — indistinguishable by border.
7. Fish ids vs display names.
8. The JS is now eleven files in `js/game/`, but it is still one scope: ~170
   names cross file boundaries. Real encapsulation — each file exposing an
   interface instead of everything seeing everything — is still open, and is
   a rewrite rather than a file move.
