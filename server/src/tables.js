// The game's own data tables, loaded into the Worker.
//
// These are the exact files the browser loads. `js/data/*.js` attaches to
// globalThis rather than window specifically so this could happen, and it
// means there is one set of numbers, not a client copy and a server copy that
// drift apart the first time the owner reprices something.
//
// The image files — map.js, scene.js, wade.js — are base64 artwork and are
// deliberately absent. They would add megabytes to the Worker bundle and the
// server has nothing to draw.
//
// Import order matches idle-fishing.html: formulas.js reads D.SCROLLS.
import "../../js/data/fish.js";
import "../../js/data/progression.js";
import "../../js/data/upgrades.js";
import "../../js/data/mutations.js";
import "../../js/data/pond.js";
import "../../js/data/scrolls.js";
import "../../js/data/dojo.js";
import "../../js/data/wadeup.js";
import "../../js/data/formulas.js";

export const D = globalThis.GAME_DATA;

// Lookups the server needs often enough to build once.
export const FISH_BY_ID = Object.fromEntries(
  [...D.FISH, ...(D.WADE_FISH || [])].map(f => [f.id, f]));
export const UPG_BY_ID = Object.fromEntries(D.UPGRADES.map(u => [u.id, u]));
