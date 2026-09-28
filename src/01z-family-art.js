/* Dino Giungla — procedural art library (namespace `A`).
   Everything is drawn with canvas paths: no images, no external fonts, no emoji.
   House style: chubby rounded shapes, thick dark outline, warm saturated colors,
   big friendly eyes with a specular dot.
   Outline technique used everywhere: build the path (one or more subpaths),
   stroke it thick with INK, then fill it — the fill covers the inner half of the
   stroke and merges overlapping subpaths into a single silhouette. */
(function () {
  'use strict';

  var G = window.G || {};
  var C = G.C || {};
  var INK = C.ink || '#2b1d12';
  var TAU = 6.2831853;
  var A = (window.A = window.A || {});

  /* ------------------------------------------------------------- primitives */
  function _clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function _shade(col, amt) { return G.shade ? G.shade(col, amt) : col; }
  function _rgba(hex, a) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return 'rgba(40,25,10,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }
  // deterministic pseudo-random, stable across frames
  function _rnd(i) { var v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  // outline width for a shape of size s
  function _lw(s) { return _clamp(s * 0.034, 2.2, 5.5); }

  // subpath adders: always moveTo first, otherwise arc/ellipse joins the previous subpath
  function _cp(c, x, y, r) { r = Math.max(0.2, r); c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
  function _ep(c, x, y, rx, ry, rot) {
    rx = Math.max(0.2, rx); ry = Math.max(0.2, ry); rot = rot || 0;
    c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
    c.ellipse(x, y, rx, ry, rot, 0, TAU);
  }
  function _smile(c, cx, cy, r, k) {
    c.moveTo(cx - r, cy); c.quadraticCurveTo(cx, cy + r * k * 2, cx + r, cy);
  }
  function _circ(c, x, y, r) { c.beginPath(); _cp(c, x, y, r); }
  function _ell(c, x, y, rx, ry, rot) { c.beginPath(); _ep(c, x, y, rx, ry, rot); }

  /* Stroke-then-fill the path already built on `c`. lw = visible outline width. */
  function _shape(c, col, lw) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (lw > 0) { c.strokeStyle = INK; c.lineWidth = lw * 2; c.stroke(); }
    c.fillStyle = col; c.fill();
  }
  /* Thick round limb: dark casing + colored core, one path, two strokes. */
  function _limb(c, x0, y0, x1, y1, w, col, lw) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.strokeStyle = INK; c.lineWidth = w + lw * 2; c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.stroke();
  }
  function _starPath(c, x, y, r, inner) {
    var i, a, rr; inner = inner || 0.46;
    c.beginPath();
    for (i = 0; i < 10; i++) {
      a = -Math.PI / 2 + i * Math.PI / 5;
      rr = i % 2 ? r * inner : r;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }
  /* Small glossy highlight, the thing that makes plastic toys look like toys. */
  function _gloss(c, x, y, rx, ry, rot, a) {
    c.save(); c.globalAlpha = a === undefined ? 0.30 : a;
    _ell(c, x, y, rx, ry, rot); c.fillStyle = '#ffffff'; c.fill();
    c.restore();
  }

  /* cached gradients (fixed screen coordinates only — never per-entity) */
  var _gc = {};
  function _lgrad(c, key, x0, y0, x1, y1, stops) {
    var g = _gc[key], i;
    if (!g) {
      g = c.createLinearGradient(x0, y0, x1, y1);
      for (i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      _gc[key] = g;
    }
    return g;
  }
  function _rgrad(c, key, x, y, r0, r1, stops) {
    var g = _gc[key], i;
    if (!g) {
      g = c.createRadialGradient(x, y, r0, x, y, r1);
      for (i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      _gc[key] = g;
    }
    return g;
  }

  /* ==================================================================== EYES */
  /* mode: 'open' | 'closed' | 'star' | 'up'. blink 0..1 = vertical openness. */
  function _eye(c, x, y, r, mode, blink, look, lw, rot) {
    var pr = r * 0.52, px = x + look * r * 0.30, py = y + r * 0.10;
    if (mode === 'star') {
      c.fillStyle = C.sun || '#ffd75e';
      _starPath(c, x, y, r * 1.15, 0.42);
      c.strokeStyle = INK; c.lineWidth = lw * 1.2; c.lineJoin = 'round';
      c.stroke(); c.fill();
      return;
    }
    if (mode === 'closed') {
      c.strokeStyle = INK; c.lineWidth = lw * 1.35; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y - r * 0.25, r * 0.92, 0.62, Math.PI - 0.62); c.stroke();
      return;
    }
    var open = _clamp(blink, 0.05, 1);
    if (open < 0.22) {
      c.strokeStyle = INK; c.lineWidth = lw * 1.35; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - r * 0.8, y); c.lineTo(x + r * 0.8, y); c.stroke();
      return;
    }
    _ell(c, x, y, r, r * 1.06 * open, rot || 0);
    _shape(c, '#ffffff', lw * 0.85);
    if (mode === 'up') py = y - r * 0.18;
    c.fillStyle = INK;
    _ell(c, px, py, pr, pr * 1.05 * open, rot || 0); c.fill();
    c.fillStyle = '#ffffff';
    _ell(c, px - pr * 0.34, py - pr * 0.42 * open, pr * 0.42, pr * 0.40 * open, 0); c.fill();
    c.globalAlpha = 0.6;
    _ell(c, px + pr * 0.30, py + pr * 0.40 * open, pr * 0.20, pr * 0.18 * open, 0); c.fill();
    c.globalAlpha = 1;
  }

  /* =================================================================== DINO */
  A.dino = function (ctx, x, y, s, o) {
    o = o || {};
    s = s > 0 ? s : 160;
    var t = (o.t === undefined || o.t === null) ? (G.t || 0) : o.t;
    var face = o.facing === -1 ? -1 : 1;
    var pose = o.pose || 'idle';
    var col = o.color || C.dino || '#57c98a';
    var dk = _shade(col, -48), lt = _shade(col, 32);
    var lw = _lw(s), u = s, i, a;

    /* What this dino is wearing (see G.look in 01c-art-gear.js).
       Contract: a caller that specifies appearance must specify ALL of it. If
       `gear` is given we use it; if only `hat` is given the caller is drawing
       somebody else's dino, so we add nothing; only when neither is given do we
       fall back to the current save. That is what keeps the "Chi gioca?" cards
       from putting the current player's glasses on every sibling. */
    var L = o.gear || ((o.hat === undefined && typeof G.look === 'function') ? G.look() : null);
    var hatId = o.hat !== undefined ? o.hat : (L ? L.testa : null);

    /* ---- pose parameters */
    var breath = Math.sin(t * 2.1) * 0.010;
    var bob = 0, hop = 0, tailA = Math.sin(t * 1.5) * 0.12, tilt = 0;
    var legPh = 0, armF = 0.80, armB = 1.05, eyes = 'open', blink = 1, walking = 0;
    if (pose === 'walk') {
      walking = 1;
      legPh = Math.sin(t * 8.4);
      bob = Math.abs(Math.sin(t * 8.4)) * 0.020;
      tailA = Math.sin(t * 8.4 + 1.2) * 0.34;
      armF = 0.80 + legPh * 0.55; armB = 1.05 - legPh * 0.55;
      tilt = 0.03;
    } else if (pose === 'happy') {
      hop = Math.abs(Math.sin(t * 5.0)) * 0.10;
      tailA = Math.sin(t * 9.0) * 0.38;
      armF = -1.80 + Math.sin(t * 13) * 0.26;
      armB = -2.05 - Math.sin(t * 13) * 0.26;
      eyes = 'star';
      bob = -hop * 0.10;
    } else if (pose === 'think') {
      tilt = 0.16; eyes = 'up';
      armB = 1.10;
      bob = Math.sin(t * 1.6) * 0.006;
    } else if (pose === 'sleep') {
      breath = Math.sin(t * 1.05) * 0.024;
      eyes = 'closed'; armF = 1.30; armB = 1.42;
      bob = 0.010 + Math.sin(t * 1.05) * 0.005;
      tailA = Math.sin(t * 0.9) * 0.05;
      tilt = 0.10;
    } else {
      bob = Math.sin(t * 2.1) * 0.008;
      var bt = t % 3.7;
      if (bt < 0.16) blink = _clamp(Math.abs(bt - 0.08) / 0.08, 0.05, 1);
    }

    /* ---- geometry (local space: origin at the feet, y up = negative) */
    var byy = -0.475 * u - bob * u;                 // body centre
    var brx = 0.288 * u, bry = (0.272 + breath) * u;
    var hr = 0.205 * u;
    var hx = 0.055 * u, hy = -0.795 * u - bob * u - breath * u * 0.5;
    var pvx = hx, pvy = hy + hr * 0.86;             // head tilt pivot (the neck)
    var cs = Math.cos(tilt), sn = Math.sin(tilt);
    function rx_(px, py) { var dx = px - pvx, dy = py - pvy; return pvx + dx * cs - dy * sn; }
    function ry_(px, py) { var dx = px - pvx, dy = py - pvy; return pvy + dx * sn + dy * cs; }

    var sxr = hx + hr * 0.86, syr = hy + hr * 0.34;  // snout (pre-tilt)
    var srx = hr * 0.66, sry = hr * 0.50;
    var sx = rx_(sxr, syr), sy = ry_(sxr, syr);
    var hcx = rx_(hx, hy), hcy = ry_(hx, hy);

    ctx.save();

    /* ---- ground shadow (stays put while hopping) */
    ctx.globalAlpha = 0.22 * (1 - hop * 3.2);
    if (ctx.globalAlpha > 0.01) {
      _ell(ctx, x, y - u * 0.012, u * 0.30 * (1 - hop * 1.2), u * 0.072 * (1 - hop * 0.9), 0);
      ctx.fillStyle = '#1b2a10'; ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.translate(x, y - hop * u);
    ctx.scale(face, 1);

    /* ---- tail (behind everything) */
    var tipx = -0.60 * u, tipy = byy - 0.05 * u - tailA * 0.20 * u;
    ctx.beginPath();
    ctx.moveTo(-0.20 * u, byy - 0.11 * u);
    ctx.quadraticCurveTo(-0.44 * u, byy - 0.30 * u - tailA * 0.16 * u, tipx, tipy);
    ctx.quadraticCurveTo(-0.42 * u, byy + 0.20 * u - tailA * 0.08 * u, -0.18 * u, byy + 0.16 * u);
    ctx.closePath();
    _shape(ctx, col, lw);

    /* ---- crest: spikes along the back + three on the tail */
    ctx.beginPath();
    for (i = 0; i < 4; i++) {
      a = -2.56 + i * 0.20;
      var e0 = a - 0.11, e1 = a + 0.11;
      ctx.moveTo(brx * Math.cos(e0), byy + bry * Math.sin(e0));
      ctx.lineTo(brx * 1.30 * Math.cos(a), byy + bry * 1.32 * Math.sin(a));
      ctx.lineTo(brx * Math.cos(e1), byy + bry * Math.sin(e1));
      ctx.closePath();
    }
    for (i = 0; i < 3; i++) {
      var p = 0.34 + i * 0.24, q = 1 - p;
      var qx = q * q * (-0.20 * u) + 2 * q * p * (-0.44 * u) + p * p * tipx;
      var qy = q * q * (byy - 0.11 * u) + 2 * q * p * (byy - 0.30 * u - tailA * 0.16 * u) + p * p * tipy;
      var sz = (0.062 - i * 0.012) * u;
      ctx.moveTo(qx - sz * 0.8, qy + sz * 0.30);
      ctx.lineTo(qx - sz * 0.15, qy - sz * 1.25);
      ctx.lineTo(qx + sz * 0.7, qy + sz * 0.10);
      ctx.closePath();
    }
    _shape(ctx, _shade(col, -22), lw * 0.9);

    /* ---- tail gear: sits on the tail, behind the body, and rides the wag.
       Drawn at p = 0.70 along the quadratic, where the tail still has some
       thickness, rotated onto the curve's tangent so it never floats. */
    if (L && L.coda && A.gear) {
      var tp = 0.70, tq = 1 - tp;
      var tcx = tq * tq * (-0.20 * u) + 2 * tq * tp * (-0.44 * u) + tp * tp * tipx;
      var tcy = tq * tq * (byy - 0.11 * u) + 2 * tq * tp * (byy - 0.30 * u - tailA * 0.16 * u) + tp * tp * tipy;
      var tdx = 2 * tq * (-0.24 * u) + 2 * tp * (tipx + 0.44 * u);
      var tdy = 2 * tq * (-0.19 * u - tailA * 0.16 * u) + 2 * tp * (tipy - byy + 0.30 * u + tailA * 0.16 * u);
      ctx.save();
      ctx.translate(tcx, tcy);
      ctx.rotate(Math.atan2(tdy, tdx));
      A.gear(ctx, L.coda, 0, 0, u * 0.088, { lw: lw });
      ctx.restore();
    }

    /* ---- far limbs (darker, read as depth) */
    var hipY = byy + 0.16 * u;
    var bLegX = -0.055 * u - (walking ? legPh * 0.10 * u : 0);
    var bLift = walking ? Math.max(0, -legPh) * 0.075 * u : 0;
    _limb(ctx, -0.05 * u, hipY, bLegX, -0.045 * u - bLift, u * 0.125, dk, lw);
    _ell(ctx, bLegX + u * 0.012, -u * 0.036 - bLift, u * 0.098, u * 0.052, 0);
    _shape(ctx, dk, lw);

    var shx = 0.135 * u, shy = byy - 0.045 * u, aL = u * 0.185;
    var bhx = shx + Math.cos(armB) * aL, bhy = shy + Math.sin(armB) * aL;
    _limb(ctx, shx, shy, bhx, bhy, u * 0.085, dk, lw);
    _circ(ctx, bhx, bhy, u * 0.055); _shape(ctx, dk, lw);

    /* ---- body + head + snout as one merged silhouette */
    ctx.beginPath();
    _ep(ctx, 0, byy, brx, bry, 0);
    _ep(ctx, 0.03 * u, byy - bry * 0.62, brx * 0.62, bry * 0.62, 0);   // chest/neck filler
    _ep(ctx, hcx, hcy, hr, hr * 0.98, tilt);
    _ep(ctx, sx, sy, srx, sry, tilt);
    _shape(ctx, col, lw);

    /* ---- belly + volume highlight */
    ctx.globalAlpha = 0.95;
    _ell(ctx, 0.085 * u, byy + 0.055 * u, 0.168 * u, 0.185 * u, 0);
    ctx.fillStyle = C.dinoBelly || '#f6e7c1'; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = _rgba(_shade(C.dinoBelly || '#f6e7c1', -40), 0.55);
    ctx.lineWidth = lw * 0.55; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.03 * u, byy + 0.01 * u); ctx.quadraticCurveTo(0.085 * u, byy + 0.055 * u, 0.20 * u, byy + 0.01 * u);
    ctx.moveTo(-0.02 * u, byy + 0.115 * u); ctx.quadraticCurveTo(0.085 * u, byy + 0.155 * u, 0.19 * u, byy + 0.115 * u);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    _ell(ctx, -0.03 * u, byy - bry * 0.66, brx * 0.42, bry * 0.20, -0.25);
    ctx.fillStyle = lt; ctx.fill();
    ctx.globalAlpha = 1;

    /* ---- neck gear: anchored to the tilt pivot, NOT to the chest ellipse.
       pvy carries bob plus half the breath while bry carries the whole breath,
       so anchoring on the chest opens a gap in time with the breathing.
       Drawn before the near limbs on purpose: in 'happy' the raised arm passes
       over it, which is where an arm belongs. */
    if (L && L.collo && A.gear) {
      A.gear(ctx, L.collo, 0.03 * u, pvy + hr * 0.30, u * 0.26, { lw: lw });
    }

    /* ---- near limbs */
    var fLegX = 0.105 * u + (walking ? legPh * 0.10 * u : 0);
    var fLift = walking ? Math.max(0, legPh) * 0.075 * u : 0;
    _limb(ctx, 0.075 * u, hipY, fLegX, -0.045 * u - fLift, u * 0.135, col, lw);
    _ell(ctx, fLegX + u * 0.016, -u * 0.036 - fLift, u * 0.105, u * 0.056, 0);
    _shape(ctx, col, lw);
    ctx.strokeStyle = _rgba(INK, 0.45); ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.moveTo(fLegX + u * 0.055, -u * 0.062 - fLift); ctx.lineTo(fLegX + u * 0.062, -u * 0.020 - fLift);
    ctx.moveTo(fLegX + u * 0.008, -u * 0.070 - fLift); ctx.lineTo(fLegX + u * 0.010, -u * 0.016 - fLift);
    ctx.stroke();

    var fhx, fhy;
    if (pose === 'think') { fhx = sx + srx * 0.30; fhy = sy + sry * 1.35; }
    else { fhx = shx + Math.cos(armF) * aL; fhy = shy + Math.sin(armF) * aL; }
    _limb(ctx, shx, shy, fhx, fhy, u * 0.095, col, lw);
    _circ(ctx, fhx, fhy, u * 0.062); _shape(ctx, col, lw);

    /* ---- face */
    var mx = sx + Math.sin(tilt) * 0 + srx * 0.02, my = sy + sry * 0.40;
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.05; ctx.lineCap = 'round';
    if (pose === 'happy') {
      ctx.beginPath();
      ctx.moveTo(mx - srx * 0.55, my - sry * 0.18);
      ctx.quadraticCurveTo(mx, my + sry * 0.85, mx + srx * 0.58, my - sry * 0.18);
      ctx.closePath();
      ctx.fillStyle = '#5b2233'; ctx.fill(); ctx.stroke();
      _ell(ctx, mx + srx * 0.02, my + sry * 0.42, srx * 0.30, sry * 0.24, 0);
      ctx.fillStyle = C.pinkPop || '#ff6fae'; ctx.fill();
    } else if (pose === 'sleep') {
      ctx.beginPath(); _smile(ctx, mx, my, srx * 0.46, 0.35); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(mx - srx * 0.48, my - sry * 0.12);
      ctx.quadraticCurveTo(mx, my + sry * 0.52, mx + srx * 0.52, my - sry * 0.14);
      ctx.stroke();
    }
    // nostril
    ctx.fillStyle = _rgba(INK, 0.7);
    _ell(ctx, sx + srx * 0.42 - sn * sry * 0.4, sy - sry * 0.42, srx * 0.13, sry * 0.15, tilt); ctx.fill();
    // cheek
    ctx.globalAlpha = 0.32;
    _ell(ctx, rx_(hx + hr * 0.62, hy + hr * 0.40), ry_(hx + hr * 0.62, hy + hr * 0.40), hr * 0.24, hr * 0.16, tilt);
    ctx.fillStyle = C.pinkPop || '#ff6fae'; ctx.fill();
    ctx.globalAlpha = 1;

    // eyes
    var e1x = hx - hr * 0.24, e1y = hy - hr * 0.20;
    var e2x = hx + hr * 0.46, e2y = hy - hr * 0.16;
    var lk = pose === 'think' ? -0.6 : 0.55;
    _eye(ctx, rx_(e1x, e1y), ry_(e1x, e1y), hr * 0.29, eyes, blink, lk, lw, tilt);
    _eye(ctx, rx_(e2x, e2y), ry_(e2x, e2y), hr * 0.31, eyes, blink, lk, lw, tilt);
    // brows for the "think" pose
    if (pose === 'think') {
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.1; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rx_(e1x - hr * 0.24, e1y - hr * 0.46), ry_(e1x - hr * 0.24, e1y - hr * 0.46));
      ctx.lineTo(rx_(e1x + hr * 0.20, e1y - hr * 0.58), ry_(e1x + hr * 0.20, e1y - hr * 0.58));
      ctx.moveTo(rx_(e2x - hr * 0.18, e2y - hr * 0.60), ry_(e2x - hr * 0.18, e2y - hr * 0.60));
      ctx.lineTo(rx_(e2x + hr * 0.26, e2y - hr * 0.44), ry_(e2x + hr * 0.26, e2y - hr * 0.44));
      ctx.stroke();
    }

    /* ---- eye gear + hat (both ride with the head tilt, drawn pre-tilt) */
    if (L && L.occhi && A.gear) {
      ctx.save();
      ctx.translate(pvx, pvy); ctx.rotate(tilt); ctx.translate(-pvx, -pvy);
      // midpoint of the two pupils: they sit at hx-0.24hr and hx+0.46hr
      A.gear(ctx, L.occhi, hx + hr * 0.11, hy - hr * 0.18, hr * 0.70, { eyes: eyes, lw: lw });
      ctx.restore();
    }
    if (hatId) {
      ctx.save();
      ctx.translate(pvx, pvy); ctx.rotate(tilt); ctx.translate(-pvx, -pvy);
      A.hat(ctx, hx + hr * 0.06, hy - hr * 0.86, hr * 1.95, hatId);
      ctx.restore();
    }

    ctx.restore();

    /* ---- floating extras, drawn unmirrored so text is never flipped */
    if (pose === 'sleep') {
      ctx.save();
      for (i = 0; i < 3; i++) {
        var ph = ((t * 0.42) + i * 0.34) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        if (G.text) {
          G.text('z', x + face * (0.24 * u + ph * 0.16 * u), y - u * (1.02 + ph * 0.34), {
            ctx: ctx, size: u * (0.11 + ph * 0.09), color: C.cream || '#fff6e0',
            stroke: _rgba(INK, 0.55)
          });
        }
      }
      ctx.restore();
    } else if (pose === 'think') {
      ctx.save();
      for (i = 0; i < 3; i++) {
        var ph2 = ((t * 0.55) + i * 0.33) % 1;
        ctx.globalAlpha = Math.sin(ph2 * Math.PI) * 0.85;
        _circ(ctx, x - face * (0.16 * u) - face * ph2 * 0.10 * u, y - u * (1.02 + ph2 * 0.30), u * (0.018 + ph2 * 0.030));
        _shape(ctx, C.cream || '#fff6e0', lw * 0.55);
      }
      ctx.restore();
    }
  };

  /* ================================================================== FRUIT */
  /* (x,y) = centre, r ≈ half the height. Must stay readable down to r = 18
     because the core HUD and the reward flyers draw fruit at ~20px. */
  A.fruit = function (ctx, x, y, r, kind) {
    r = r > 0 ? r : 20;
    var lw = _clamp(r * 0.16, 1.8, 4.2);
    ctx.save();
    switch (kind) {
      case 'banana':
        ctx.beginPath();
        ctx.moveTo(x - r * 0.86, y - r * 0.52);
        ctx.quadraticCurveTo(x - r * 0.30, y + r * 1.02, x + r * 0.90, y + r * 0.46);
        ctx.quadraticCurveTo(x - r * 0.10, y + r * 0.46, x - r * 0.52, y - r * 0.62);
        ctx.closePath();
        _shape(ctx, '#ffd93d', lw);
        ctx.fillStyle = '#e0a53a';
        _ell(ctx, x - r * 0.70, y - r * 0.56, r * 0.16, r * 0.13, -0.5); ctx.fill();
        _ell(ctx, x + r * 0.84, y + r * 0.48, r * 0.14, r * 0.12, 0.3); ctx.fill();
        _gloss(ctx, x - r * 0.10, y + r * 0.05, r * 0.42, r * 0.11, 0.55, 0.38);
        break;

      case 'uva':
        ctx.strokeStyle = C.bark || '#7a4a26'; ctx.lineWidth = lw * 1.1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y - r * 0.62); ctx.lineTo(x + r * 0.10, y - r * 1.02); ctx.stroke();
        ctx.beginPath();
        _cp(ctx, x - r * 0.44, y - r * 0.26, r * 0.36);
        _cp(ctx, x + r * 0.40, y - r * 0.28, r * 0.36);
        _cp(ctx, x, y - r * 0.02, r * 0.38);
        _cp(ctx, x - r * 0.40, y + r * 0.40, r * 0.35);
        _cp(ctx, x + r * 0.38, y + r * 0.38, r * 0.35);
        _cp(ctx, x, y + r * 0.72, r * 0.32);
        _shape(ctx, C.plum || '#8f5bd6', lw);
        ctx.fillStyle = C.leaf || '#2f8f4e';
        _ell(ctx, x + r * 0.44, y - r * 0.92, r * 0.30, r * 0.17, -0.5);
        _shape(ctx, C.leaf || '#2f8f4e', lw * 0.8);
        _gloss(ctx, x - r * 0.44, y - r * 0.38, r * 0.16, r * 0.11, -0.6, 0.45);
        _gloss(ctx, x + r * 0.02, y - r * 0.14, r * 0.15, r * 0.10, -0.6, 0.4);
        break;

      case 'melone':
        ctx.beginPath();
        ctx.moveTo(x - r, y + r * 0.46);
        ctx.arc(x, y + r * 0.46, r, Math.PI, 0);
        ctx.closePath();
        _shape(ctx, '#6fbf5a', lw);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.80, y + r * 0.44);
        ctx.arc(x, y + r * 0.44, r * 0.80, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = '#fff0c6'; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.68, y + r * 0.42);
        ctx.arc(x, y + r * 0.42, r * 0.68, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = '#ff9f43'; ctx.fill();
        ctx.fillStyle = '#5b3a16';
        _ell(ctx, x - r * 0.30, y + r * 0.10, r * 0.09, r * 0.13, 0.2); ctx.fill();
        _ell(ctx, x + r * 0.04, y - r * 0.06, r * 0.09, r * 0.13, -0.1); ctx.fill();
        _ell(ctx, x + r * 0.36, y + r * 0.12, r * 0.09, r * 0.13, 0.3); ctx.fill();
        break;

      case 'mela':
        ctx.beginPath();
        _ep(ctx, x - r * 0.30, y + r * 0.06, r * 0.66, r * 0.74, -0.08);
        _ep(ctx, x + r * 0.30, y + r * 0.06, r * 0.66, r * 0.74, 0.08);
        _shape(ctx, C.berry || '#e8536b', lw);
        ctx.strokeStyle = C.barkDark || '#4e2f18'; ctx.lineWidth = lw * 1.1; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.58); ctx.quadraticCurveTo(x + r * 0.10, y - r * 0.92, x + r * 0.02, y - r * 1.06);
        ctx.stroke();
        _ell(ctx, x + r * 0.38, y - r * 0.86, r * 0.34, r * 0.18, -0.42);
        _shape(ctx, C.leafLight || '#63c777', lw * 0.8);
        _gloss(ctx, x - r * 0.34, y - r * 0.30, r * 0.24, r * 0.14, -0.6, 0.5);
        break;

      case 'cocco':
        ctx.beginPath(); _cp(ctx, x, y, r * 0.92);
        _shape(ctx, '#8a5a30', lw);
        ctx.strokeStyle = _rgba('#4e2f18', 0.45); ctx.lineWidth = lw * 0.7;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.55, y - r * 0.42); ctx.quadraticCurveTo(x - r * 0.10, y, x - r * 0.48, y + r * 0.48);
        ctx.moveTo(x + r * 0.10, y - r * 0.70); ctx.quadraticCurveTo(x + r * 0.34, y, x + r * 0.06, y + r * 0.68);
        ctx.stroke();
        ctx.fillStyle = '#4a2c14';
        _cp2(ctx, x - r * 0.26, y - r * 0.20, r * 0.13);
        _cp2(ctx, x + r * 0.20, y - r * 0.26, r * 0.13);
        _cp2(ctx, x - r * 0.02, y + r * 0.14, r * 0.13);
        _gloss(ctx, x - r * 0.36, y - r * 0.48, r * 0.26, r * 0.13, -0.6, 0.30);
        break;

      default: /* fragola */
        ctx.beginPath();
        ctx.moveTo(x, y + r * 0.98);
        ctx.quadraticCurveTo(x - r * 0.92, y + r * 0.10, x - r * 0.58, y - r * 0.46);
        ctx.quadraticCurveTo(x, y - r * 0.86, x + r * 0.58, y - r * 0.46);
        ctx.quadraticCurveTo(x + r * 0.92, y + r * 0.10, x, y + r * 0.98);
        ctx.closePath();
        _shape(ctx, C.berry || '#e8536b', lw);
        ctx.fillStyle = '#ffe9a8';
        var si, sj, sx2, sy2;
        for (si = 0; si < 3; si++) {
          for (sj = 0; sj < 2 + (si < 2 ? 1 : 0); sj++) {
            sx2 = x + (sj - (si < 2 ? 1 : 0.5)) * r * 0.40 + (si % 2) * r * 0.10;
            sy2 = y - r * 0.24 + si * r * 0.40;
            _ell(ctx, sx2, sy2, r * 0.08, r * 0.12, 0.2); ctx.fill();
          }
        }
        ctx.beginPath();
        for (si = 0; si < 5; si++) {
          var aa = -Math.PI / 2 + (si - 2) * 0.52;
          ctx.moveTo(x, y - r * 0.44);
          ctx.lineTo(x + Math.cos(aa) * r * 0.76, y - r * 0.44 + Math.sin(aa) * r * 0.48);
          ctx.lineTo(x + Math.cos(aa + 0.26) * r * 0.30, y - r * 0.40 + Math.sin(aa + 0.26) * r * 0.20);
          ctx.closePath();
        }
        _shape(ctx, C.leaf || '#2f8f4e', lw * 0.75);
        _gloss(ctx, x - r * 0.28, y + r * 0.06, r * 0.20, r * 0.12, -0.5, 0.45);
        break;
    }
    ctx.restore();
  };
  function _cp2(c, x, y, r) { c.beginPath(); _cp(c, x, y, r); c.fill(); }

  /* ==================================================================== EGG */
  /* (x,y) = centre, s = height. o.crack 0..1 — at 1 the shell is split in two. */
  A.egg = function (ctx, x, y, s, o) {
    o = o || {};
    s = s > 0 ? s : 120;
    var crack = _clamp(o.crack || 0, 0, 1);
    var col = o.color || '#fff3d6';
    var lw = _lw(s * 0.9);
    var rx = s * 0.355, ry = s * 0.50;
    var i, zx, zy;
    var cy = -ry * 0.06;                     // crack line, in egg-local coords
    var split = crack > 0.62 ? (crack - 0.62) / 0.38 : 0;
    var gap = split * s * 0.17;

    function eggPath(c) {
      c.beginPath();
      c.moveTo(0, -ry);
      c.bezierCurveTo(rx * 0.82, -ry * 0.88, rx * 1.06, ry * 0.28, 0, ry);
      c.bezierCurveTo(-rx * 1.06, ry * 0.28, -rx * 0.82, -ry * 0.88, 0, -ry);
      c.closePath();
    }
    function speckles(c) {
      c.fillStyle = _rgba(_shade(col, -60), 0.30);
      for (i = 0; i < 7; i++) {
        c.beginPath();
        c.ellipse(_rnd(i * 3 + 1) * rx * 1.3 - rx * 0.65, _rnd(i * 3 + 2) * ry * 1.5 - ry * 0.75,
          s * 0.030 * (0.6 + _rnd(i * 3 + 3)), s * 0.024 * (0.6 + _rnd(i * 3 + 3)), 0, 0, TAU);
        c.fill();
      }
    }
    // zigzag used both as the visible crack and as the split boundary
    function zig(c, from) {
      var n = 9, px, py;
      for (i = 0; i <= n; i++) {
        px = -rx * 1.25 + (i / n) * rx * 2.5;
        py = cy + (i % 2 ? -ry * 0.11 : ry * 0.05);
        if (i === 0 && from) c.moveTo(px, py); else c.lineTo(px, py);
      }
    }

    ctx.save();
    ctx.translate(x, y);
    // ground contact shadow
    ctx.globalAlpha = 0.18;
    _ell(ctx, 0, ry * 0.92, rx * 0.86, ry * 0.14, 0);
    ctx.fillStyle = '#1b2a10'; ctx.fill();
    ctx.globalAlpha = 1;

    if (split <= 0) {
      eggPath(ctx); _shape(ctx, col, lw);
      speckles(ctx);
      _gloss(ctx, -rx * 0.36, -ry * 0.40, rx * 0.24, ry * 0.16, -0.5, 0.55);
      if (crack > 0.02) {
        var shown = _clamp(crack / 0.60, 0, 1);
        ctx.save();
        ctx.beginPath(); ctx.rect(-rx * 1.3, cy - ry * 0.4, rx * 2.6 * shown, ry * 0.8); ctx.clip();
        ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); zig(ctx, true); ctx.stroke();
        ctx.restore();
      }
    } else {
      // bottom bowl
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-rx * 1.4, ry * 1.6); ctx.lineTo(-rx * 1.4, cy + ry * 0.05); zig(ctx, false);
      ctx.lineTo(rx * 1.4, ry * 1.6); ctx.closePath();
      ctx.clip();
      eggPath(ctx); _shape(ctx, col, lw); speckles(ctx);
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); zig(ctx, true); ctx.stroke();
      // lifted top half
      ctx.save();
      ctx.translate(gap * 0.35, -gap); ctx.rotate(-split * 0.22);
      ctx.beginPath();
      ctx.moveTo(-rx * 1.4, -ry * 1.6); ctx.lineTo(-rx * 1.4, cy + ry * 0.05); zig(ctx, false);
      ctx.lineTo(rx * 1.4, -ry * 1.6); ctx.closePath();
      ctx.clip();
      eggPath(ctx); _shape(ctx, col, lw); speckles(ctx);
      _gloss(ctx, -rx * 0.36, -ry * 0.42, rx * 0.24, ry * 0.16, -0.5, 0.55);
      ctx.restore();
    }
    ctx.restore();
  };

  /* ================================================================== CHICK */
  /* Newborn dino. (x,y) = centre (per contract), s = height. */
  A.chick = function (ctx, x, y, s, o) {
    o = o || {};
    s = s > 0 ? s : 80;
    var t = (o.t === undefined || o.t === null) ? (G.t || 0) : o.t;
    var col = o.color || C.dino || '#57c98a';
    var dk = _shade(col, -46);
    var lw = _lw(s * 1.4), u = s, i;
    var wob = Math.sin(t * 2.4) * 0.05;
    var brt = Math.sin(t * 3.1) * 0.012;
    var feet = y + u * 0.48;
    var byy = y + u * 0.12, brx = u * 0.335, bry = u * (0.315 + brt);
    var hy = y - u * 0.20, hr = u * 0.30;
    var blink = 1, bt = t % 3.1;
    if (bt < 0.15) blink = _clamp(Math.abs(bt - 0.075) / 0.075, 0.05, 1);

    ctx.save();
    ctx.globalAlpha = 0.18;
    _ell(ctx, x, feet + u * 0.03, u * 0.30, u * 0.06, 0);
    ctx.fillStyle = '#1b2a10'; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(x, feet); ctx.rotate(wob * 0.12); ctx.translate(-x, -feet);

    // tiny tail
    ctx.beginPath();
    ctx.moveTo(x - brx * 0.60, byy - u * 0.04);
    ctx.quadraticCurveTo(x - brx * 1.70, byy - u * 0.16 + wob * u * 0.10, x - brx * 1.52, byy + u * 0.10);
    ctx.quadraticCurveTo(x - brx * 1.10, byy + u * 0.12, x - brx * 0.62, byy + u * 0.10);
    ctx.closePath();
    _shape(ctx, col, lw * 0.9);
    // crest
    ctx.beginPath();
    for (i = 0; i < 3; i++) {
      var ca = -2.42 + i * 0.30, cx0 = x + hr * 0.98 * Math.cos(ca), cy0 = hy + hr * 0.98 * Math.sin(ca);
      ctx.moveTo(cx0 - u * 0.045, cy0 + u * 0.020);
      ctx.lineTo(x + hr * 1.34 * Math.cos(ca - 0.06), hy + hr * 1.36 * Math.sin(ca - 0.06));
      ctx.lineTo(cx0 + u * 0.035, cy0 + u * 0.045);
      ctx.closePath();
    }
    _shape(ctx, _shade(col, -20), lw * 0.8);
    // legs
    _limb(ctx, x - u * 0.09, byy + bry * 0.72, x - u * 0.11, feet - u * 0.02, u * 0.075, dk, lw * 0.8);
    _limb(ctx, x + u * 0.09, byy + bry * 0.72, x + u * 0.12, feet - u * 0.02, u * 0.080, col, lw * 0.8);
    ctx.beginPath();
    _ep(ctx, x - u * 0.105, feet - u * 0.015, u * 0.085, u * 0.045, 0);
    _ep(ctx, x + u * 0.125, feet - u * 0.015, u * 0.088, u * 0.047, 0);
    _shape(ctx, _shade(col, -10), lw * 0.8);
    // body + head, one blob
    ctx.beginPath();
    _ep(ctx, x, byy, brx, bry, 0);
    _ep(ctx, x, hy, hr, hr * 0.96, 0);
    _shape(ctx, col, lw);
    // belly
    ctx.globalAlpha = 0.95;
    _ell(ctx, x, byy + u * 0.055, brx * 0.62, bry * 0.66, 0);
    ctx.fillStyle = C.dinoBelly || '#f6e7c1'; ctx.fill();
    ctx.globalAlpha = 1;
    // stubby arms
    _limb(ctx, x - brx * 0.72, byy - u * 0.05, x - brx * 1.02, byy + u * 0.06 + wob * u * 0.03, u * 0.062, col, lw * 0.8);
    _limb(ctx, x + brx * 0.72, byy - u * 0.05, x + brx * 1.02, byy + u * 0.06 - wob * u * 0.03, u * 0.062, col, lw * 0.8);
    // face
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = C.pinkPop || '#ff6fae';
    _ell(ctx, x - hr * 0.66, hy + hr * 0.34, hr * 0.22, hr * 0.14, 0); ctx.fill();
    _ell(ctx, x + hr * 0.66, hy + hr * 0.34, hr * 0.22, hr * 0.14, 0); ctx.fill();
    ctx.globalAlpha = 1;
    _eye(ctx, x - hr * 0.36, hy - hr * 0.06, hr * 0.30, 'open', blink, 0.25, lw * 0.9, 0);
    _eye(ctx, x + hr * 0.36, hy - hr * 0.06, hr * 0.30, 'open', blink, 0.25, lw * 0.9, 0);
    // little beaky smile
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.95; ctx.lineCap = 'round';
    ctx.beginPath(); _smile(ctx, x, hy + hr * 0.50, hr * 0.24, 0.5); ctx.stroke();
    // eggshell cap — freshly hatched
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.86, hy - hr * 0.52);
    ctx.quadraticCurveTo(x, hy - hr * 1.62, x + hr * 0.86, hy - hr * 0.52);
    ctx.lineTo(x + hr * 0.60, hy - hr * 0.66);
    ctx.lineTo(x + hr * 0.30, hy - hr * 0.48);
    ctx.lineTo(x, hy - hr * 0.68);
    ctx.lineTo(x - hr * 0.32, hy - hr * 0.48);
    ctx.lineTo(x - hr * 0.62, hy - hr * 0.66);
    ctx.closePath();
    _shape(ctx, '#fff3d6', lw * 0.9);
    ctx.restore();
  };

  /* =================================================================== STAR */
  A.star = function (ctx, x, y, r, color) {
    r = r > 0 ? r : 20;
    ctx.save();
    _starPath(ctx, x, y, r, 0.46);
    _shape(ctx, color || C.sun || '#ffd75e', _clamp(r * 0.15, 1.6, 4));
    _gloss(ctx, x - r * 0.26, y - r * 0.34, r * 0.20, r * 0.11, -0.6, 0.5);
    ctx.restore();
  };

  /* ================================================================= SHAPES */
  /* Filled silhouettes for the matching minigame: colour-blind children must be
     able to pair them by form alone. Every one is (ctx, x, y, r, color). */
  function _mk(fn) {
    return function (ctx, x, y, r, color) {
      r = r > 0 ? r : 30;
      ctx.save();
      fn(ctx, x, y, r);
      _shape(ctx, color || C.berry || '#e8536b', _clamp(r * 0.16, 2, 5));
      _gloss(ctx, x - r * 0.30, y - r * 0.42, r * 0.26, r * 0.13, -0.55, 0.34);
      ctx.restore();
    };
  }
  A.SHAPES = {
    cerchio: _mk(function (c, x, y, r) { _circ(c, x, y, r); }),
    quadrato: _mk(function (c, x, y, r) {
      var d = r * 0.86;
      if (G.roundRect) G.roundRect(c, x - d, y - d, d * 2, d * 2, r * 0.26);
      else { c.beginPath(); c.rect(x - d, y - d, d * 2, d * 2); }
    }),
    triangolo: _mk(function (c, x, y, r) {
      c.beginPath();
      c.moveTo(x, y - r * 1.02);
      c.lineTo(x + r * 0.94, y + r * 0.68);
      c.lineTo(x - r * 0.94, y + r * 0.68);
      c.closePath();
    }),
    cuore: _mk(function (c, x, y, r) {
      c.beginPath();
      c.moveTo(x, y + r * 0.92);
      c.bezierCurveTo(x - r * 1.42, y - r * 0.18, x - r * 0.68, y - r * 1.18, x, y - r * 0.42);
      c.bezierCurveTo(x + r * 0.68, y - r * 1.18, x + r * 1.42, y - r * 0.18, x, y + r * 0.92);
      c.closePath();
    }),
    stella: _mk(function (c, x, y, r) { _starPath(c, x, y, r, 0.46); }),
    fiore: _mk(function (c, x, y, r) {
      var i, a;
      c.beginPath();
      for (i = 0; i < 6; i++) {
        a = i * TAU / 6;
        _ep(c, x + Math.cos(a) * r * 0.56, y + Math.sin(a) * r * 0.56, r * 0.46, r * 0.36, a);
      }
      _cp(c, x, y, r * 0.40);
    }),
    luna: _mk(function (c, x, y, r) {
      var a = 0.62, dx = r * 0.55;
      var px = r * Math.cos(a) - dx, py = r * Math.sin(a);
      var r2 = Math.sqrt(px * px + py * py), ang = Math.atan2(py, px);
      c.beginPath();
      c.arc(x, y, r, a, -a, false);
      c.arc(x + dx, y, r2, -ang, ang, true);
      c.closePath();
    }),
    rombo: _mk(function (c, x, y, r) {
      c.beginPath();
      c.moveTo(x, y - r * 1.04);
      c.lineTo(x + r * 0.76, y);
      c.lineTo(x, y + r * 1.04);
      c.lineTo(x - r * 0.76, y);
      c.closePath();
    })
  };

  A._ok = true;
})();
