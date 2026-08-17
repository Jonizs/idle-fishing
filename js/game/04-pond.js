// Part of the game script, split out of idle-fishing.html.
// Classic script, deliberately NOT wrapped in an IIFE: every file here
// shares one top-level lexical scope, which is what lets these sections
// keep calling each other by name. Load order is the original order and
// must not change.
"use strict";
  // ── Pond simulation ──────────────────────────────────────────────────────
  const GRAVITY = 900;
  const ripples = [], droplets = [], jumpers = [], floaters = [];
  let rippleTimer = 0, jumpTimer = rand(1.5, 3.5), bobTimer = 1.6;

  function pointInPond(spread = 0.85) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * spread;
    return { x: pond.cx + Math.cos(a) * pond.rx * r, y: pond.cy + Math.sin(a) * pond.ry * r };
  }
  // col, when given, is an "r,g,b" tint; the alpha stays with the drawing code.
  const addRipple = (x, y, max, life, weight, col) =>
    ripples.push({ x, y, t: 0, life, max, weight, col: col || null });

  function addSplash(x, y, count, power) {
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.85, -Math.PI * 0.15), s = rand(power * 0.4, power);
      droplets.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                      r: rand(1.2, 3), t: 0, life: rand(0.45, 0.95) });
    }
    addRipple(x, y, rand(16, 30), 1.1, 2);
  }

  const RESON_RGB = "61,139,255";   // the blue of the RESONANCE! pop
  // Resonance: one heavy splash. Same droplets as a bobber landing, thrown
  // twice as far, under a ripple three times as thick.
  function addResonSplash(x, y) {
    for (let i = 0; i < 7; i++) {
      const a = rand(-Math.PI * 0.85, -Math.PI * 0.15), s = rand(136, 340);
      droplets.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                      r: rand(3.6, 9), t: 0, life: rand(0.45, 0.95), col: RESON_RGB });
    }
    addRipple(x, y, rand(32, 60), 1.3, 12, RESON_RGB);
  }

  // `big` marks the rare-fish pop: it never queues, never gets dropped to make
  // room, and draws 1.4x over the top of everything else.
  function addFloater(text, x, y, col, big) {
    // Drop the oldest one still waiting its turn, not the oldest overall. When
    // catches came in faster than the queue drained, every new pop inherited a
    // longer delay and was then shifted out before it ever showed, so nothing
    // appeared at all. Capping the delay bounds the queue as well.
    if (floaters.length > 24) {
      const i = floaters.findIndex(fl => fl.delay > 0 && !fl.big);
      floaters.splice(i >= 0 ? i : floaters.findIndex(fl => !fl.big), 1);
    }
    // Several effects can fire on one catch; queue them so they rise in
    // sequence instead of printing on top of each other.
    let queued = 0;
    for (const fl of floaters) if (fl.delay > 0) queued++;
    floaters.push({
      text, x, y, col: col || null, big: !!big,
      delay: big ? 0 : Math.min(queued, 3) * 0.18,
      t: 0,
      life: 1.5,
      rise: pond.ry * 0.95 + 40,
      drift: rand(-14, 14),
      wob: rand(0, TAU),
    });
  }

  function updateFloaters(dt) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const fl = floaters[i];
      if (fl.delay > 0) { fl.delay -= dt; if (fl.delay > 0) continue; }
      fl.t += dt;
      if (fl.t >= fl.life) floaters.splice(i, 1);
    }
  }

  function spawnJumper() {
    const p = pointInPond(0.7);
    const dir = rand(0, TAU), dist = rand(25, 80), peak = rand(45, 95);
    const vh = Math.sqrt(2 * GRAVITY * peak), T = (2 * vh) / GRAVITY;
    let tx = p.x + Math.cos(dir) * dist, ty = p.y + Math.sin(dir) * dist * 0.55;
    const nx = (tx - pond.cx) / pond.rx, ny = (ty - pond.cy) / pond.ry, d = Math.hypot(nx, ny);
    if (d > 0.85) { tx = pond.cx + (nx / d) * 0.85 * pond.rx; ty = pond.cy + (ny / d) * 0.85 * pond.ry; }
    jumpers.push({ x: p.x, y: p.y, vx: (tx - p.x) / T, vy: (ty - p.y) / T,
                   h: 0, vh, size: rand(9, 15) });
    addSplash(p.x, p.y, 9, 190);
  }

  // A catch reels the bobber up to the rod tip, then casts it back out.
  const REEL_IN = 0.32, REEL_OUT = 0.46;
  function reelIn(c) { c.phase = "in"; c.t = 0; }

  function updateCast(dt, b, c, tipX, tipY) {
    if (c.phase === "idle") { b.x = b.rx; b.y = b.ry; b.air = 0; return; }
    c.t += dt;
    if (c.phase === "in") {
      const k = Math.min(1, c.t / REEL_IN);
      const e = 1 - Math.pow(1 - k, 2);                     // quick off the water
      b.x = b.rx + (tipX - b.rx) * e;
      b.y = b.ry + (tipY - b.ry) * e;
      b.air = e;
      if (k >= 1) { c.phase = "out"; c.t = 0; }
    } else {
      const k = Math.min(1, c.t / REEL_OUT);
      const e = 1 - Math.pow(1 - k, 2);
      b.x = tipX + (b.rx - tipX) * e;
      b.y = tipY + (b.ry - tipY) * e - Math.sin(k * Math.PI) * angler.u * 1.1;   // arc
      b.air = 1 - e;
      if (k >= 1) {
        c.phase = "idle"; c.t = 0;
        b.x = b.rx; b.y = b.ry; b.air = 0;
        addSplash(b.x, b.y, 4, 110);                        // it lands
        addRipple(b.x, b.y, 9, 1.2, 1);
      }
    }
  }

  function updatePond(dt) {
    for (let i = 0, n = liveRods(); i < n; i++)
      updateCast(dt, rods[i].bob, rods[i].cast, rods[i].tipX, rods[i].tipY);
    for (const p of fog) {
      p.x += p.v * dt;
      if (p.v > 0 && p.x - p.r > view.w) p.x = -p.r;
      if (p.v < 0 && p.x + p.r < 0)      p.x = view.w + p.r;
    }
    updateFloaters(dt);
    rippleTimer -= dt;
    if (rippleTimer <= 0) {
      rippleTimer = rand(0.5, 1.6);
      const p = pointInPond();
      addRipple(p.x, p.y, rand(22, 55), rand(1.6, 2.6), 1);
    }
    bobTimer -= dt;
    if (bobTimer <= 0) { bobTimer = rand(1.8, 3.4); addRipple(bob.rx, bob.ry, rand(10, 18), 1.4, 1); }

    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].t += dt;
      if (ripples[i].t >= ripples[i].life) ripples.splice(i, 1);
    }
    for (let i = droplets.length - 1; i >= 0; i--) {
      const d = droplets[i];
      d.t += dt; d.vy += GRAVITY * 1.5 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.t >= d.life) { addRipple(d.x, d.y, rand(5, 11), 0.7, 1); droplets.splice(i, 1); }
    }

    jumpTimer -= dt;
    if (jumpTimer <= 0 && jumpers.length < 2) { jumpTimer = rand(2.5, 6.5); spawnJumper(); }
    for (let i = jumpers.length - 1; i >= 0; i--) {
      const f = jumpers[i];
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.vh -= GRAVITY * dt; f.h += f.vh * dt;
      if (f.h <= 0) { addSplash(f.x, f.y, 14, 240); jumpers.splice(i, 1); }
    }
  }

