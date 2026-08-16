// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Layout ───────────────────────────────────────────────────────────────
  const view  = { w: 0, h: 0, dpr: 1, safe: { x: 0, w: 0, cx: 0, cy: 0 } };
  const pond  = { cx: 0, cy: 0, rx: 0, ry: 0 };
  const dock  = { x0: 0, x1: 0, y: 0, h: 0 };
  const angler = { x: 0, y: 0, u: 0, tipX: 0, tipY: 0 };
  // Up to eight rods. Two are reachable in game; the dev showcase uses all of
  // them. Each carries its own bobber, cast animation and catch timer.
  const ROD_MAX = 8;
  // Where each rod's bobber rests, as a fraction of the pond ellipse. Tuned by
  // eye against the painted basin: the ellipse is a bounding box, so its
  // corners and the shelf under the waterfall are rock, not water.
  const ROD_SPOT = [[-0.46, 0.09], [-0.20, 0.37], [-0.02, 0.05], [0.18, 0.28],
                    [-0.59, 0.37], [0.52, -0.03], [-0.07, -0.15], [0.26, 0.55]];
  const rods = ROD_SPOT.map(() => ({
    tipX: 0, tipY: 0, t: 0,
    bob:  { x: 0, y: 0, rx: 0, ry: 0, air: 0 },
    cast: { phase: "idle", t: 0 },
  }));
  const bob  = rods[0].bob,  bob2  = rods[1].bob;    // named for the debug hooks
  const cast = rods[0].cast, cast2 = rods[1].cast;
  const rodCount = () => (state.demo ? ROD_MAX : lvlOf("quatro") ? 4 : lvlOf("trifecta") ? 3
                                              : lvlOf("twoRods") ? 2 : 1);
  // the picks actually being fished right now, one per available rod
  const livePicks = () => state.picks.slice(0, rodCount());
  const liveRods  = () => Math.min(state.picks.length, rodCount());
  const props = [], fog = [];
  const flies = [];

  // Grass is baked once per layout into an offscreen canvas, then blitted each
  // frame — a few thousand blades per frame would be wasteful otherwise.
  // Unused since the painted scene replaced the procedural field; bakeGround
  // and the prop tables are still here in case the old look is ever wanted.
  const ground = document.createElement("canvas");
  const gctx   = ground.getContext("2d");

  // ── Painted scene ────────────────────────────────────────────────────────
  // Everything below is in the artwork's own pixel space, 2688x1536. fitScene()
  // maps it onto whatever the window is, so these numbers never change with
  // the viewport — nudge them here to move the pond or the angler.
  // One entry per fishable location. SCENE points at whichever is active, so
  // every drawing routine keeps reading a single object.
  const AREAS = {
    pond: {
      w: 2688, h: 1536,
      water: { cx: 1398, cy: 840, rx: 410, ry: 235 },  // the lower basin, as an ellipse
      seat:  { x: 947, y: 820 },                       // rim stone at the far left
      aim:   -0.25,                                    // first rod, radians from +x
      spread: 0.095,                                   // radians between rods
      rodLen: 3.8,                                     // rod length in angler units
      hand:  { x: 0.76, y: -0.88 },                    // grip, in angler units
      unit:  32,                                       // angler height unit at 1:1
      fill:  "#231f1c",                                // rock tone behind the art
      // Foam churning at the foot of each drop. w/h is the patch the blobs
      // wander inside, in artwork pixels.
      foam: [{ x: 1700, y: 548, w: 116, h: 34 },       // upper pool, under the drop
             { x: 1505, y: 706, w: 132, h: 40 }],      // spill into the main basin
      // 1 fills the strip between the panels, cropping whichever axis overflows
      // so there is never a bar. Below 1 pulls back and shows more of the
      // cavern; above 1 pushes in on the pond. The pond stays centred either way.
      zoom: 1,
      src:  window.SCENE_JPEG,
    },
    // Wade: the swamp. Same angler and rod fan as the pond, but he stands in
    // the channel instead of sitting on a bank, so his legs are underwater.
    wade: {
      w: 2720, h: 1568,
      water: { cx: 1360, cy: 952, rx: 408, ry: 176 },   // the swamp channel
      seat:  { x: 1500, y: 862 },                       // where he stands, waist line
      flip:  true,                                      // face left, not right
      // The swamp gets its own float positions rather than the pond's, spread
      // out across the channel to his left. Fractions of the water ellipse.
      // Listed by eye; resize() sorts them into the rod fan's order.
      spots: [[-0.72,  0.02], [-0.38, -0.05], [-0.90,  0.30], [-0.56,  0.24],
              [-0.64,  0.50], [-0.16,  0.12], [ 0.04, -0.12], [-0.28,  0.44]],
      // Same side-on pose and rod fan as the pond; he is just standing in the
      // water instead of sitting on a bank, so the legs are under the surface.
      aim:   -0.25,
      spread: 0.095,
      rodLen: 3.8,
      hand:  { x: 0.76, y: -0.88 },
      unit:  40,
      fill:  "#14231d",                                 // swamp shade behind the art
      foam:  [],
      zoom:  1,
      src:   window.WADE_JPEG,
      submerged: true,                                  // hide the legs, he is wading
    },
  };
  for (const k in AREAS) {
    const a = AREAS[k];
    a.ready = false;
    a.img = new Image();
    a.img.onload = () => { a.ready = true; };
    a.img.src = a.src;
  }
  let SCENE = AREAS.pond;
  const fit = { x: 0, y: 0, w: 0, h: 0, s: 1 };

  // Fit the scene into the strip between the panels, then slide it so the pond
  // sits in the middle of that strip. Anchoring on the pond rather than the
  // image keeps the water — and every bobber — off the panels at any zoom.
  function fitScene() {
    fit.s = Math.max(view.safe.w / SCENE.w, view.h / SCENE.h) * SCENE.zoom;
    fit.w = SCENE.w * fit.s;
    fit.h = SCENE.h * fit.s;
    fit.x = view.safe.cx - SCENE.water.cx * fit.s;
    fit.y = view.h / 2 - SCENE.water.cy * fit.s;
    // Centring on the pond can slide an edge inside the viewport even though
    // the image is big enough to cover it, which shows as a bar. Pull it back
    // just far enough to close the gap; the pond stays as centred as it can.
    if (fit.h >= view.h) fit.y = Math.min(0, Math.max(view.h - fit.h, fit.y));
    else                 fit.y = (view.h - fit.h) / 2;
    const L = view.safe.x, R = view.safe.x + view.safe.w;
    if (fit.w >= view.safe.w) fit.x = Math.min(L, Math.max(R - fit.w, fit.x));
    else                      fit.x = L + (view.safe.w - fit.w) / 2;
  }
  const sx = x => fit.x + x * fit.s;      // artwork space -> canvas space
  const sy = y => fit.y + y * fit.s;

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width  = Math.floor(view.w * view.dpr);
    canvas.height = Math.floor(view.h * view.dpr);
    canvas.style.width  = view.w + "px";
    canvas.style.height = view.h + "px";
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    const cs = getComputedStyle(document.documentElement);
    const L = parseFloat(cs.getPropertyValue("--panel-l")) || 0;
    const R = parseFloat(cs.getPropertyValue("--panel-r")) || 0;
    view.safe.x  = L;
    view.safe.w  = Math.max(0, view.w - L - R);
    view.safe.cx = L + view.safe.w / 2;
    view.safe.cy = view.h / 2;

    // The painted scene decides the geometry now; everything reads off it.
    fitScene();
    pond.cx = sx(SCENE.water.cx);
    pond.cy = sy(SCENE.water.cy);
    pond.rx = SCENE.water.rx * fit.s;
    pond.ry = SCENE.water.ry * fit.s;

    // The dock is painted out of the scene; keep the box off in a corner so
    // the old prop-scatter test can't match anything.
    dock.x0 = dock.x1 = dock.y = dock.h = -9999;

    angler.u = Math.max(7, SCENE.unit * fit.s);
    angler.x = sx(SCENE.seat.x);
    angler.y = sy(SCENE.seat.y);
    // dir -1 mirrors the whole pose, so one set of numbers covers both facings
    angler.dir = SCENE.flip ? -1 : 1;
    const mirror = a => (angler.dir < 0 ? Math.PI - a : a);
    angler.tipX = angler.x + Math.cos(mirror(SCENE.aim)) * angler.u * 4.2;
    angler.tipY = angler.y + Math.sin(mirror(SCENE.aim)) * angler.u * 4.2;
    // every rod is the same length, fanned out from the hand
    const hx = angler.x + angler.u * SCENE.hand.x * angler.dir;
    const hy = angler.y + angler.u * SCENE.hand.y;
    const rodLen = angler.u * SCENE.rodLen;
    for (let i = 0; i < rods.length; i++) {
      const a = mirror(SCENE.aim + i * SCENE.spread);
      rods[i].tipX = hx + Math.cos(a) * rodLen;
      rods[i].tipY = hy + Math.sin(a) * rodLen;
    }
    angler.tipX2 = rods[1].tipX;
    angler.tipY2 = rods[1].tipY;

    // Where each bobber rests, as fractions of this area's water ellipse. The
    // pond keeps ROD_SPOT in its original order — it was tuned against that
    // artwork and nothing here should disturb it.
    const spots = (SCENE.spots || ROD_SPOT).map(sp => ({
      x: pond.cx + pond.rx * sp[0],
      y: pond.cy + pond.ry * sp[1],
    }));
    // An area supplying its own spots gets them sorted into the rod fan's
    // order, so no two lines cross. Measuring the angle in the angler's own
    // facing keeps it clear of the atan2 wrap at +-pi.
    if (SCENE.spots) {
      const spotAngle = p => Math.atan2(p.y - hy, (p.x - hx) * angler.dir);
      spots.sort((p, q) => spotAngle(p) - spotAngle(q));
    }
    for (let i = 0; i < rods.length; i++) {
      const b = rods[i].bob;
      b.rx = spots[i].x; b.ry = spots[i].y;
      b.x = b.rx; b.y = b.ry;
    }

    // No procedural scenery to place or bake any more; leaving props empty
    // also turns the remaining prop loops in render() into no-ops. The
    // fireflies used to be seeded at the tail of layoutProps, so they get
    // their own pass now.
    props.length = 0;
    seedFlies();
  }

  // Fireflies drifting over the scene, the one bit of the old procedural
  // field worth keeping on top of the painting.
  function seedFlies() {
    flies.length = 0;
    const rnd = mulberry32(90210);
    const s = Math.max(0.35, pond.ry / 150);
    for (let i = 0; i < 14; i++) {
      flies.push({
        x: pond.cx + (rnd() - 0.5) * pond.rx * 2.6,
        y: pond.cy + (rnd() - 0.5) * pond.ry * 2.4,
        ax: (12 + rnd() * 30) * s, ay: (8 + rnd() * 22) * s,
        sx: 0.16 + rnd() * 0.3, sy: 0.2 + rnd() * 0.36,
        ph: rnd() * TAU, blink: 0.5 + rnd() * 1.6, r: (1.4 + rnd() * 1.3) * s,
      });
    }
  }
  window.addEventListener("resize", () => (typeof applyLayout === "function" ? applyLayout() : resize()));

  // ── Grass field ──────────────────────────────────────────────────────────
  // How far out of the pond a point sits: <1 is water, 1 is the waterline.
  function pondDist(x, y) {
    const nx = (x - pond.cx) / pond.rx, ny = (y - pond.cy) / pond.ry;
    return Math.hypot(nx, ny);
  }

  function bakeGround() {
    ground.width  = Math.max(1, Math.floor(view.w * view.dpr));
    ground.height = Math.max(1, Math.floor(view.h * view.dpr));
    gctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    gctx.clearRect(0, 0, view.w, view.h);

    const rnd = mulberry32(51724);
    const s = pond.ry / 150;

    // flat turf covering the entire viewport
    gctx.fillStyle = C.grassM;
    gctx.fillRect(0, 0, view.w, view.h);

    gctx.save();

    // blades, right up to the waterline and out past every edge
    gctx.lineCap = "round";
    const bladeCount = Math.min(6000, Math.round((view.w * view.h) / 620));
    for (let i = 0; i < bladeCount; i++) {
      const x = rnd() * view.w, y = rnd() * view.h;
      if (pondDist(x, y) < 1.015) continue;         // stop at the water
      const h = (4 + rnd() * 8) * s;
      const lean = (rnd() - 0.5) * h * 0.8;
      const c = rnd();
      gctx.strokeStyle = c < 0.4 ? C.grassD : c < 0.8 ? C.grassL : C.leafM;
      gctx.lineWidth = Math.max(0.8, 1.5 * s);
      gctx.beginPath();
      gctx.moveTo(x, y);
      gctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h);
      gctx.stroke();
    }

    // wildflowers
    const flowerCount = Math.min(400, Math.round((view.w * view.h) / 9000));
    for (let i = 0; i < flowerCount; i++) {
      const x = rnd() * view.w, y = rnd() * view.h;
      if (pondDist(x, y) < 1.05) continue;
      const c = rnd();
      gctx.fillStyle = c < 0.4 ? "#f2e3d0" : c < 0.75 ? "#e8d15a" : "#d98fb8";
      gctx.beginPath();
      gctx.arc(x, y - 2 * s, Math.max(1, 1.9 * s), 0, TAU);
      gctx.fill();
    }

    gctx.restore();
  }

  // ── Scenery scatter ──────────────────────────────────────────────────────
  function overDock(x, y) {
    return x > dock.x0 - 14 && x < dock.x1 + 14 &&
           y > dock.y - dock.h * 1.2 && y < dock.y + dock.h * 2.2;
  }

  function ringPoint(rnd, near, far) {
    const a = rnd() * TAU;
    const f = near + rnd() * (far - near);
    return { x: pond.cx + Math.cos(a) * pond.rx * f,
             y: pond.cy + Math.sin(a) * pond.ry * f };
  }

  function layoutProps() {
    props.length = 0;
    flies.length = 0;
    const rnd = mulberry32(20260806);
    const s = pond.ry / 150;

    const push = (o) => { if (!overDock(o.x, o.y)) props.push(o); };

    // boulders and stones hugging the bank
    for (let i = 0; i < 16; i++) {
      const p = ringPoint(rnd, 1.02, 1.34);
      push({ t: "stone", x: p.x, y: p.y, r: (7 + rnd() * 13) * s, tilt: rnd() * 0.6 - 0.3 });
    }
    // loose pebbles further out
    for (let i = 0; i < 30; i++) {
      const p = ringPoint(rnd, 1.05, 1.85);
      push({ t: "pebble", x: p.x, y: p.y, r: (2 + rnd() * 3.5) * s });
    }
    // swaying tufts, scattered across the whole field
    for (let i = 0; i < 120; i++) {
      const x = rnd() * view.w, y = rnd() * view.h;
      if (pondDist(x, y) < 1.03) continue;
      push({ t: "grass", x, y, h: (9 + rnd() * 17) * s, n: 3 + (rnd() * 4 | 0), ph: rnd() * TAU });
    }
    // fallen leaves on the ground
    for (let i = 0; i < 22; i++) {
      const p = ringPoint(rnd, 1.02, 1.95);
      push({ t: "leaf", x: p.x, y: p.y, r: (4 + rnd() * 4) * s, a: rnd() * TAU, c: rnd() });
    }
    // reeds, kept to the flanks so they don't block the view
    for (let i = 0; i < 14; i++) {
      const a = (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 1.5;
      const f = 0.99 + rnd() * 0.16;
      const x = pond.cx + Math.cos(a) * pond.rx * f;
      const y = pond.cy + Math.sin(a) * pond.ry * f;
      push({ t: "reed", x, y, h: (26 + rnd() * 34) * s, ph: rnd() * TAU, cat: rnd() < 0.55 });
    }
    // drifting fog banks that swallow the far field
    fog.length = 0;
    for (let i = 0; i < 16; i++) {
      let fx = 0, fy = 0, tries = 0;
      do { fx = rnd() * view.w; fy = rnd() * view.h; } while (pondDist(fx, fy) < 2.0 && ++tries < 24);
      fog.push({ x: fx, y: fy,
                 r: (70 + rnd() * 110) * s,
                 v: (3 + rnd() * 9) * (rnd() < 0.5 ? -1 : 1) * s,
                 a: 0.1 + rnd() * 0.14 });
    }

    // lily pads floating on the water
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU, f = Math.sqrt(rnd()) * 0.72;
      props.push({ t: "pad", x: pond.cx + Math.cos(a) * pond.rx * f,
                          y: pond.cy + Math.sin(a) * pond.ry * f,
                          r: (9 + rnd() * 9) * s, a: rnd() * TAU, ph: rnd() * TAU,
                          flower: rnd() < 0.35, water: true });
    }
    // leaves adrift on the surface
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU, f = Math.sqrt(rnd()) * 0.8;
      props.push({ t: "afloat", x: pond.cx + Math.cos(a) * pond.rx * f,
                             y: pond.cy + Math.sin(a) * pond.ry * f,
                             r: (3.5 + rnd() * 3) * s, a: rnd() * TAU, ph: rnd() * TAU,
                             c: rnd(), water: true });
    }

    for (const p of props) p.back = !p.water && p.y < pond.cy;

    // fireflies drifting over the scene
    for (let i = 0; i < 10; i++) {
      flies.push({
        x: pond.cx + (rnd() - 0.5) * pond.rx * 2.6,
        y: pond.cy + (rnd() - 0.5) * pond.ry * 2.4,
        ax: (12 + rnd() * 30) * s, ay: (8 + rnd() * 22) * s,
        sx: 0.16 + rnd() * 0.3, sy: 0.2 + rnd() * 0.36,
        ph: rnd() * TAU, blink: 0.5 + rnd() * 1.6, r: (1.4 + rnd() * 1.3) * s,
      });
    }
  }

  resize();

