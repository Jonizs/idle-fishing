// Fishing scrolls. Six rarities, nine types, one of each type equippable.
// Every effect is linear in the scroll's rarity tier (1-6).
//
// `stat` is the hook the game reads; `per` is the value added per rarity tier.
// `emblem` is the mark drawn on the scroll sheet, inside a 24x24 box — it is
// data rather than markup so the icon and the effect stay in one place.
//
// Wrapped: a top-level `const` in a classic script goes into the shared
// global lexical scope, so five files declaring `D` would collide.
(() => {
  const D = (globalThis.GAME_DATA = globalThis.GAME_DATA || {});

  // t6 Mythic is white, the same as t1 Common, exactly as specified.
  const SCROLL_RAR = [
    { t: 1, id: "common",    name: "Common",    col: "#ffffff" },
    { t: 2, id: "uncommon",  name: "Uncommon",  col: "#5ad46a" },
    { t: 3, id: "rare",      name: "Rare",      col: "#3a72d4" },
    { t: 4, id: "epic",      name: "Epic",      col: "#8a4fd0" },
    { t: 5, id: "legendary", name: "Legendary", col: "#e5bb4e" },
    { t: 6, id: "mythic",    name: "Mythic",    col: "#ffffff" },
  ];

  const SCROLLS = [
    { id: "raven", name: "Old Raven Scroll", stat: "raven", per: 0.05,
      desc: "{v} chance after a catch for a raven to fly out. Drops 1 sea raven, and that fish gives 2x XP.",
      fmt: "pct",
      emblem: '<path d="M8.2 13.6c1.5-2.6 3.4-3.4 5.2-3.2l1.9-1.5.5 1.4 1.6.5-1.4 1.1c.2 1.9-.9 3.6-3 4.2' +
              'l1 1.2H9.9l-.6-1.1-1.6.6z" fill="{c}"/>' },

    { id: "storm", name: "Old Storm Scroll", stat: "bolt", per: 0.005,
      desc: "{v} chance for a lightning strike.",
      fmt: "pct",
      emblem: '<path d="M13.4 8.4l-3.9 4.7h2.4l-1.3 3.9 4.3-5.1h-2.5z" fill="{c}"/>' },

    { id: "buccan", name: "Old Buccan's Scroll", stat: "speed", per: 0.05,
      desc: "{v} fishing speed.",
      fmt: "pct",
      emblem: '<circle cx="12" cy="12.4" r="3.4" fill="none" stroke="{c}" stroke-width="1.3"/>' +
              '<path d="M12 8.2v8.4M7.8 12.4h8.4M9 9.4l6 6M15 9.4l-6 6" stroke="{c}" stroke-width="1"/>' },

    { id: "caribbean", name: "Old Caribbean Scroll", stat: "dbl", per: 0.02,
      desc: "{v} double drop.",
      fmt: "pct",
      emblem: '<circle cx="10.4" cy="13.2" r="2.6" fill="none" stroke="{c}" stroke-width="1.2"/>' +
              '<circle cx="14.2" cy="11.4" r="2.6" fill="none" stroke="{c}" stroke-width="1.2"/>' },

    { id: "sea", name: "Old Sea Scroll", stat: "gold", per: 0.01,
      desc: "{v} gold drop chance.",
      fmt: "pct",
      emblem: '<path d="M7.6 11.2c1.1-1.3 2.2-1.3 3.3 0s2.2 1.3 3.3 0 2.2-1.3 3.3 0M7.6 14.4c1.1-1.3 2.2-1.3 3.3 0' +
              's2.2 1.3 3.3 0 2.2-1.3 3.3 0" fill="none" stroke="{c}" stroke-width="1.1" stroke-linecap="round"/>' },

    { id: "treasure", name: "Old Treasure Scroll", stat: "ench", per: 0.02,
      desc: "{v} enchanted drop.",
      fmt: "pct",
      emblem: '<path d="M7.6 11.4h8.8v5.2H7.6z" fill="none" stroke="{c}" stroke-width="1.2"/>' +
              '<path d="M7.6 11.4c0-2 1.9-2.6 4.4-2.6s4.4.6 4.4 2.6M11.2 13.2h1.6v1.8h-1.6z" fill="{c}"/>' },

    { id: "wind", name: "Old Wind Scroll", stat: "game", per: 0.04,
      desc: "+{v}x game speed.",
      fmt: "x",
      emblem: '<path d="M7.4 10.6h5.8a1.7 1.7 0 1 0-1.7-1.7M7.4 13.4h7.8a1.7 1.7 0 1 1-1.7 1.7M7.4 12h9.2"' +
              ' fill="none" stroke="{c}" stroke-width="1.1" stroke-linecap="round"/>' },

    { id: "sword", name: "Old Sword Scroll", stat: "timer", per: 0.025,
      desc: "-{v} to the base catch timer.",
      fmt: "pct",
      emblem: '<path d="M8.4 16.4l6.8-6.8M13.8 8.2h2.8v2.8" fill="none" stroke="{c}" stroke-width="1.3"' +
              ' stroke-linecap="round"/><path d="M7.4 15.2l1.8 1.8-2.4.6z" fill="{c}"/>' },

    { id: "skull", name: "Old Skull Scroll", stat: "xp", per: 0.01,
      desc: "{v} total XP gained.",
      fmt: "pct",
      emblem: '<path d="M12 8.4c2.8 0 4.6 1.8 4.6 4.2 0 1.4-.7 2.4-1.6 3v1.2H9v-1.2c-.9-.6-1.6-1.6-1.6-3' +
              ' 0-2.4 1.8-4.2 4.6-4.2z" fill="none" stroke="{c}" stroke-width="1.2"/>' +
              '<circle cx="10.3" cy="12.6" r="1" fill="{c}"/><circle cx="13.7" cy="12.6" r="1" fill="{c}"/>' },
  ];

  D.SCROLL_RAR = SCROLL_RAR;
  D.SCROLLS = SCROLLS;
})();
