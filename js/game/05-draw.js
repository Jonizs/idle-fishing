// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Scenery drawing ──────────────────────────────────────────────────────
  function drawStone(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath(); ctx.ellipse(2, p.r * 0.32, p.r * 1.05, p.r * 0.44, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.stoneDark;
    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.72, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.stone;
    ctx.beginPath(); ctx.ellipse(0, -p.r * 0.14, p.r * 0.9, p.r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.stoneLit;
    ctx.beginPath(); ctx.ellipse(-p.r * 0.24, -p.r * 0.3, p.r * 0.42, p.r * 0.24, -0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawPebble(p) {
    ctx.fillStyle = C.stoneDark;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.66, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.stone;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - p.r * 0.16, p.r * 0.76, p.r * 0.46, 0, 0, TAU); ctx.fill();
  }

  function drawGrass(p, t) {
    const sway = Math.sin(t * 1.5 + p.ph) * p.h * 0.22;
    ctx.strokeStyle = C.leafD;
    ctx.lineCap = "round";
    for (let i = 0; i < p.n; i++) {
      const off = (i - (p.n - 1) / 2) * p.h * 0.16;
      const lean = sway * (0.6 + i * 0.14);
      ctx.strokeStyle = i % 2 ? C.leafM : C.leafD;
      ctx.lineWidth = Math.max(1, p.h * 0.075);
      ctx.beginPath();
      ctx.moveTo(p.x + off, p.y);
      ctx.quadraticCurveTo(p.x + off + lean * 0.4, p.y - p.h * 0.6, p.x + off + lean, p.y - p.h);
      ctx.stroke();
    }
  }

  function drawLeaf(p, alpha) {
    const col = p.c < 0.34 ? C.leafM : p.c < 0.67 ? C.rust : C.ember;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(46,19,13,.4)";
    ctx.lineWidth = Math.max(0.6, p.r * 0.1);
    ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(p.r, 0); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawReed(p, t) {
    const sway = Math.sin(t * 1.1 + p.ph) * p.h * 0.16;
    ctx.strokeStyle = C.leafD;
    ctx.lineWidth = Math.max(1.4, p.h * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + sway * 0.3, p.y - p.h * 0.55, p.x + sway, p.y - p.h);
    ctx.stroke();
    if (p.cat) {
      ctx.fillStyle = C.dark;
      ctx.save();
      ctx.translate(p.x + sway, p.y - p.h);
      ctx.rotate(sway * 0.02);
      ctx.beginPath();
      ctx.ellipse(0, -p.h * 0.06, p.h * 0.055, p.h * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPad(p, t) {
    const bobY = Math.sin(t * 1.2 + p.ph) * p.r * 0.06;
    ctx.save();
    ctx.translate(p.x, p.y + bobY);
    ctx.scale(1, 0.55);
    ctx.rotate(p.a);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.arc(2, 3, p.r, 0.42, TAU - 0.42); ctx.lineTo(2, 3); ctx.fill();
    ctx.fillStyle = C.leafD;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0.42, TAU - 0.42); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = "rgba(138,178,75,.5)";
    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.62, 0.5, TAU - 0.5); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
    if (p.flower) {
      ctx.fillStyle = C.cream;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + p.a;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * p.r * 0.26, p.y + bobY + Math.sin(a) * p.r * 0.14,
                    p.r * 0.2, p.r * 0.11, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = C.ember;
      ctx.beginPath(); ctx.arc(p.x, p.y + bobY, p.r * 0.13, 0, TAU); ctx.fill();
    }
  }

  function drawAfloat(p, t) {
    const dx = Math.sin(t * 0.22 + p.ph) * p.r * 2.4;
    const dy = Math.cos(t * 0.17 + p.ph) * p.r * 1.1;
    drawLeaf({ x: p.x + dx, y: p.y + dy, r: p.r, a: p.a + Math.sin(t * 0.3 + p.ph) * 0.3, c: p.c }, 0.9);
  }

  function drawProp(p, t) {
    switch (p.t) {
      case "stone":  return drawStone(p);
      case "pebble": return drawPebble(p);
      case "grass":  return drawGrass(p, t);
      case "leaf":   return drawLeaf(p);
      case "reed":   return drawReed(p, t);
      case "pad":    return drawPad(p, t);
      case "afloat": return drawAfloat(p, t);
    }
  }

  // ── Dock ─────────────────────────────────────────────────────────────────
  function drawDock(t) {
    const { x0, x1, y, h } = dock;
    const w = x1 - x0;
    const deckTop = y - h * 0.5, deckBot = y + h * 0.5;

    // posts, clipped to the pond so none of them stand on the grass
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pond.cx, pond.cy, pond.rx, pond.ry, 0, 0, TAU);
    ctx.clip();

    const pw = h * 0.3;
    for (const f of [0.42, 0.68, 0.93]) {
      const px = x0 + w * f - pw / 2;
      const py = deckBot - h * 0.12;
      const ph = h * 1.35;
      ctx.fillStyle = C.plankDark;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = "rgba(157,98,66,.55)";           // lit left face
      ctx.fillRect(px, py, pw * 0.34, ph);
      ctx.fillStyle = "rgba(0,0,0,.3)";                 // shaded right face
      ctx.fillRect(px + pw * 0.72, py, pw * 0.28, ph);
    }
    ctx.restore();

    // deck
    const g = ctx.createLinearGradient(0, deckTop, 0, deckBot);
    g.addColorStop(0, C.plankLit);
    g.addColorStop(1, C.plank);
    ctx.fillStyle = g;
    ctx.fillRect(x0, deckTop, w, h);

    // plank seams, inset so they never touch the deck edges
    ctx.strokeStyle = "rgba(46,19,13,.38)";
    ctx.lineWidth = 1.4;
    const planks = Math.max(6, Math.round(w / (h * 0.62)));
    for (let i = 1; i < planks; i++) {
      const px = Math.round(x0 + (w / planks) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, deckTop + h * 0.12);
      ctx.lineTo(px, deckBot - h * 0.12);
      ctx.stroke();
    }

    // top highlight and front lip
    ctx.fillStyle = "rgba(242,227,208,.14)";
    ctx.fillRect(x0, deckTop, w, h * 0.14);
    ctx.fillStyle = C.plankDark;
    ctx.fillRect(x0, deckBot - h * 0.18, w, h * 0.18);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(x1 - h * 0.14, deckTop, h * 0.14, h);
  }

  // ── The angler ───────────────────────────────────────────────────────────
  function drawAngler(t) {
    const u = angler.u, x = angler.x, y = angler.y;
    const breathe = Math.sin(t * 1.3) * u * 0.045;
    const castX = angler.tipX + Math.sin(t * 0.6) * u * 0.12;
    const castY = angler.tipY + Math.cos(t * 0.5) * u * 0.09;

    ctx.save();
    ctx.translate(x, y + breathe);
    // Mirror the whole pose when the area faces the other way. Everything
    // below is written facing right; the flip is the only thing that knows.
    if (angler.dir < 0) ctx.scale(-1, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Wading: the legs and boots are under the surface, so instead of drawing
    // them we put the water he displaces around his waist. Everything above
    // the hips is the same pose as on the bank.
    if (SCENE.submerged) {
      ctx.fillStyle = "rgba(16,54,46,.42)";
      ctx.beginPath(); ctx.ellipse(0, 0, u * 0.95, u * 0.28, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(226,247,255,.3)";
      ctx.lineWidth = Math.max(1, u * 0.06);
      ctx.beginPath();
      ctx.ellipse(0, 0, u * (1.02 + 0.04 * Math.sin(t * 1.6)), u * 0.3, 0, 0, TAU);
      ctx.stroke();
    } else {
      // dangling legs
      ctx.strokeStyle = C.pants;
      ctx.lineWidth = u * 0.52;
      ctx.beginPath();
      ctx.moveTo(-u * 0.1, -u * 0.15);
      ctx.quadraticCurveTo(u * 0.75, -u * 0.1, u * 0.9, u * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-u * 0.1, -u * 0.15);
      ctx.quadraticCurveTo(u * 0.6, u * 0.02, u * 0.68, u * 0.72);
      ctx.stroke();

      // boots
      ctx.fillStyle = C.dark;
      ctx.beginPath(); ctx.ellipse(u * 0.98, u * 0.66, u * 0.3, u * 0.19, 0.25, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(u * 0.74, u * 0.84, u * 0.3, u * 0.19, 0.25, 0, TAU); ctx.fill();
    }

    // torso, leaning forward a touch
    ctx.fillStyle = C.shirt;
    ctx.beginPath();
    ctx.moveTo(-u * 0.5, -u * 0.1);
    ctx.quadraticCurveTo(-u * 0.62, -u * 1.25, -u * 0.18, -u * 1.62);
    ctx.lineTo(u * 0.34, -u * 1.5);
    ctx.quadraticCurveTo(u * 0.42, -u * 0.5, u * 0.28, -u * 0.06);
    ctx.closePath();
    ctx.fill();

    // arm out to the rod
    ctx.strokeStyle = C.shirt;
    ctx.lineWidth = u * 0.32;
    ctx.beginPath();
    ctx.moveTo(-u * 0.02, -u * 1.32);
    ctx.quadraticCurveTo(u * 0.5, -u * 1.2, u * 0.72, -u * 0.92);
    ctx.stroke();
    ctx.fillStyle = C.skin;
    ctx.beginPath(); ctx.arc(u * 0.76, -u * 0.88, u * 0.17, 0, TAU); ctx.fill();

    // neck and head
    ctx.fillStyle = C.skin;
    ctx.fillRect(-u * 0.16, -u * 1.78, u * 0.3, u * 0.28);
    ctx.beginPath(); ctx.arc(u * 0.02, -u * 2.12, u * 0.52, 0, TAU); ctx.fill();

    // eye and a small smile
    ctx.fillStyle = C.deep;
    ctx.beginPath(); ctx.arc(u * 0.3, -u * 2.16, u * 0.07, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(46,19,13,.7)";
    ctx.lineWidth = u * 0.06;
    ctx.beginPath(); ctx.arc(u * 0.24, -u * 2.0, u * 0.16, -0.2, 1.0); ctx.stroke();

    // straw hat
    ctx.fillStyle = C.hat;
    ctx.beginPath(); ctx.ellipse(u * 0.02, -u * 2.44, u * 0.86, u * 0.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(u * 0.02, -u * 2.56, u * 0.44, u * 0.34, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "rgba(74,35,27,.45)";
    ctx.beginPath(); ctx.ellipse(u * 0.02, -u * 2.44, u * 0.45, u * 0.1, 0, 0, TAU); ctx.fill();

    ctx.restore();

    // rod, line and bobber, once per rod. Absolute coordinates, so the grip
    // has to be mirrored by hand rather than by the transform above.
    const handX = x + u * 0.76 * angler.dir, handY = y + breathe - u * 0.88;

    for (let i = liveRods() - 1; i >= 1; i--) {      // extra rods behind the first
      const r = rods[i];
      drawRod(t, u, handX, handY,
              r.tipX + Math.sin(t * 0.5 + i * 1.4) * u * 0.12,
              r.tipY + Math.cos(t * 0.7 + i * 1.4) * u * 0.09, r.bob, u * 1.3);
    }
    if (liveRods() > 0) drawRod(t, u, handX, handY, castX, castY, bob, u * 1.3);
  }

  // One rod: a straight shaft out of the grip, the line sagging to the float,
  // and the float itself. Shared, so the seated angler and the wader cannot
  // drift apart on how a cast looks.
  function drawRod(t, u, handX, handY, cx, cy, b, lift) {
    ctx.strokeStyle = C.plankDark;
    ctx.lineWidth = Math.max(1.6, u * 0.11);
    ctx.beginPath();
    // The butt sits in the hand itself, and the tip rides a little above the
    // cast point so the shaft angles up. The line hangs off the raised tip.
    const tipY = cy - u * 1.1;
    ctx.moveTo(handX, handY);
    ctx.lineTo(cx, tipY);
    ctx.stroke();

    // line, with a little sag
    ctx.strokeStyle = "rgba(242,227,208,.55)";
    ctx.lineWidth = 1;
    const bobY = b.y + Math.sin(t * 2.1) * 1.8 * (1 - b.air);
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.quadraticCurveTo((cx + b.x) / 2, (tipY + bobY) / 2 + u * 0.7, b.x, bobY);
    ctx.stroke();

    // bobber
    ctx.fillStyle = C.cream;
    ctx.beginPath(); ctx.arc(b.x, bobY, u * 0.19, 0, TAU); ctx.fill();
    ctx.fillStyle = "#d9483c";
    ctx.beginPath(); ctx.arc(b.x, bobY - u * 0.06, u * 0.19, Math.PI, TAU); ctx.fill();
  }

  // ── Water ────────────────────────────────────────────────────────────────
  function drawShore() {
    // nothing here — grass runs straight to the water's edge
  }

  // Foam churning where each drop lands. Blobs drift outward from the middle
  // of the patch, swell, then thin out, so the surface keeps turning over
  // without anything visibly looping. Not clipped to the pond — the upper pool
  // sits outside that ellipse.
  function drawFoam(t) {
    const N = 11;
    for (const f of SCENE.foam) {
      const cx = sx(f.x), cy = sy(f.y);
      const hw = f.w * 0.5 * fit.s, hh = f.h * 0.5 * fit.s;
      for (let i = 0; i < N; i++) {
        // stable per-blob variation, no allocation and no state to keep
        const seed = Math.sin(i * 12.9898) * 43758.5453;
        const j = seed - Math.floor(seed);
        const k = ((t * (0.34 + j * 0.3)) + i / N) % 1;
        const dir = i % 2 ? 1 : -1;
        const x = cx + dir * hw * (0.12 + 0.88 * k) * (0.45 + 0.55 * j);
        const y = cy + Math.sin(t * (0.8 + j) + i) * hh * 0.34 + hh * (j - 0.5) * 0.5;
        const grow = Math.sin(k * Math.PI);              // swell then thin
        const r = Math.max(0.9, (2.4 + j * 3.4) * fit.s * (0.35 + 0.65 * grow));
        ctx.fillStyle = "rgba(232,250,255," + (grow * 0.3).toFixed(3) + ")";
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Shimmer and ripples only. The painted scene supplies the water itself, so
  // filling the ellipse here would just cover the art.
  function drawWater(t) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pond.cx, pond.cy, pond.rx, pond.ry, 0, 0, TAU);
    ctx.clip();

    for (let i = 0; i < 6; i++) {
      const yy = pond.cy - pond.ry * 0.62 + (i / 5) * pond.ry * 1.24;
      const w  = pond.rx * (0.20 + 0.16 * Math.sin(t * 0.8 + i * 1.3));
      const xx = pond.cx + Math.sin(t * 0.35 + i * 2.1) * pond.rx * 0.32;
      ctx.fillStyle = "rgba(242,227,208," + (0.035 + 0.025 * Math.sin(t + i)).toFixed(3) + ")";
      ctx.beginPath(); ctx.ellipse(xx, yy, w, 2.2, 0, 0, TAU); ctx.fill();
    }

    const squash = pond.ry / pond.rx;
    for (const rp of ripples) {
      const k = rp.t / rp.life, r = rp.max * (0.15 + 0.85 * k);
      ctx.strokeStyle = "rgba(" + (rp.col || "242,227,208") + "," +
                        ((1 - k) * (rp.col ? 0.85 : 0.34)).toFixed(3) + ")";
      ctx.lineWidth = rp.weight * (1 - k * 0.5);
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, r, r * squash, 0, 0, TAU); ctx.stroke();
    }

    ctx.restore();
  }

  function drawBank() {
    ctx.strokeStyle = C.light;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(pond.cx, pond.cy, pond.rx, pond.ry, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "rgba(46,19,13,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(pond.cx, pond.cy, pond.rx + 3.5, pond.ry + 3.5, 0, 0, TAU); ctx.stroke();
  }

  function drawFish(f) {
    const sx = f.x, sy = f.y - f.h;
    const angle = Math.atan2(f.vy - f.vh, f.vx);
    const L = f.size, H = f.size * 0.62;
    const shade = Math.max(0, 1 - f.h / 160);
    ctx.fillStyle = "rgba(0,0,0," + (0.28 * shade).toFixed(3) + ")";
    ctx.beginPath(); ctx.ellipse(f.x, f.y, L * 0.9 * shade + 3, L * 0.4 * shade + 2, 0, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.fillStyle = C.bark;
    ctx.beginPath();
    ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.5, -H * 0.85);
    ctx.lineTo(-L * 1.35, 0); ctx.lineTo(-L * 1.5, H * 0.85);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.ember;
    ctx.beginPath(); ctx.ellipse(0, 0, L, H, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(242,227,208,.55)";
    ctx.beginPath(); ctx.ellipse(L * 0.05, H * 0.42, L * 0.7, H * 0.34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.light;
    ctx.beginPath();
    ctx.moveTo(-L * 0.15, -H * 0.8); ctx.lineTo(L * 0.2, -H * 1.5); ctx.lineTo(L * 0.45, -H * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.deep;
    ctx.beginPath(); ctx.arc(L * 0.55, -H * 0.22, Math.max(1.1, L * 0.11), 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawDroplets() {
    for (const d of droplets) {
      const k = 1 - d.t / d.life;
      ctx.fillStyle = "rgba(" + (d.col || "207,232,235") + "," + (0.35 + 0.5 * k).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (0.5 + 0.5 * k), 0, TAU); ctx.fill();
    }
  }

  // The fog. Drawn on the canvas rather than as a DOM veil so it covers the
  // scene and nothing else, and so the floaters — which come after it — stay
  // fully readable through it.
  // Three banks at their own heights, each drifting on its own sine.
  const FOG_BANKS = [{ y: 0.16, h: 0.30, o: 0.30, sp: 0.055, ph: 0.0 },
                     { y: 0.50, h: 0.34, o: 0.22, sp: 0.038, ph: 2.1 },
                     { y: 0.82, h: 0.28, o: 0.15, sp: 0.047, ph: 4.3 }];
  // Named drawFogEvent, not drawFog: the old night fog below still owns that
  // name, and the later declaration would win.
  function drawFogEvent(t) {
    const a = fogEv.a;
    if (a <= 0.002) return;
    const w = view.w, h = view.h;
    ctx.save();
    // Pale wash, heaviest at the top where the distance is. Nothing but
    // light grey goes down: the fog only ever lightens the scene.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0,    "rgba(206,210,210,.34)");
    g.addColorStop(0.38, "rgba(206,210,210,.24)");
    g.addColorStop(0.70, "rgba(206,210,210,.14)");
    g.addColorStop(1,    "rgba(206,210,210,.08)");
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Banks: a wide radial squashed onto each band's height, so they read as
    // rolling sheets rather than blobs.
    const rad = w * 0.7;
    for (const b of FOG_BANKS) {
      const cx = w * (0.5 + 0.16 * Math.sin(t * b.sp + b.ph));
      ctx.save();
      ctx.translate(cx, h * b.y);
      ctx.scale(1, (h * b.h) / rad);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      rg.addColorStop(0, "rgba(232,234,233," + b.o.toFixed(3) + ")");
      rg.addColorStop(1, "rgba(232,234,233,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFloaters() {
    if (!floaters.length) return;
    const size = Math.max(13, pond.ry * 0.15);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    // Two passes: the rare-fish pops are 1.4x and go last, so they always sit
    // on top of whatever else is in the air.
    for (const big of [false, true]) {
      const sz = size * (big ? 1.4 : 1);
      ctx.font = "600 " + sz.toFixed(1) + "px " + FONT;
      for (const fl of floaters) {
        if (!!fl.big !== big) continue;
        if (fl.delay > 0) continue;               // still queued behind another
        const k = fl.t / fl.life;
        const ease = 1 - Math.pow(1 - k, 2.2);          // quick launch, slow drift
        const y = fl.y - fl.rise * ease;
        const x = fl.x + fl.drift * ease + Math.sin(fl.wob + k * 5) * 3;
        const a = k < 0.12 ? k / 0.12 : 1 - Math.pow((k - 0.12) / 0.88, 1.7);
        const pop = k < 0.14 ? 0.7 + (k / 0.14) * 0.3 : 1;

        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(x, y);
        ctx.scale(pop, pop);
        ctx.lineWidth = Math.max(3, sz * 0.22);
        ctx.strokeStyle = "rgba(28,12,8,.85)";
        ctx.strokeText(fl.text, 0, 0);
        ctx.fillStyle = fl.col || C.ember;
        ctx.fillText(fl.text, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Fog: a distance falloff in pond space, plus slow drifting banks on top.
  const FOG = "0,0,0";   // night
  function drawFog() {
    // Everything fog draws is clipped to outside the pond, or a low bank
    // drifting past the near bank washes over the water and the dock.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, view.w, view.h);
    ctx.ellipse(pond.cx, pond.cy, pond.rx * 1.5, pond.ry * 1.5, 0, 0, TAU);
    ctx.clip("evenodd");

    ctx.save();
    ctx.translate(pond.cx, pond.cy);
    ctx.scale(1, pond.ry / pond.rx);
    const g = ctx.createRadialGradient(0, 0, pond.rx * 1.5, 0, 0, pond.rx * 3.1);
    g.addColorStop(0,    "rgba(" + FOG + ",0)");
    g.addColorStop(0.5,  "rgba(" + FOG + ",.6)");
    g.addColorStop(1,    "rgba(" + FOG + ",1)");
    ctx.fillStyle = g;
    const ext = (view.w + view.h) * (pond.rx / pond.ry + 1);
    ctx.fillRect(-ext, -ext, ext * 2, ext * 2);
    ctx.restore();

    for (const p of fog) {
      const d = pondDist(p.x, p.y);
      const near = Math.max(0, Math.min(1, (d - 1.75) / 0.8));
      if (near <= 0) continue;
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      gr.addColorStop(0, "rgba(" + FOG + "," + (p.a * near).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(" + FOG + ",0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlies(t) {
    for (const f of flies) {
      const x = f.x + Math.sin(t * f.sx + f.ph) * f.ax;
      const y = f.y + Math.cos(t * f.sy + f.ph * 1.7) * f.ay;
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * f.blink + f.ph));
      const g = ctx.createRadialGradient(x, y, 0, x, y, f.r * 5);
      g.addColorStop(0, "rgba(240,224,140," + (0.8 * a).toFixed(3) + ")");
      g.addColorStop(1, "rgba(240,224,140,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, f.r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,247,205," + a.toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, TAU); ctx.fill();
    }
  }

