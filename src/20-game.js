/* Dino Salto — the platformer.

   Everything the game remembers between frames lives in S, and S is plain
   data: the level grid itself is immutable (G.LEVELS) and S only keeps the
   tiles that changed. That is what lets test/smoke.js snapshot the game with
   JSON and search for a way through every level — the same step() the child
   plays with, at a fixed 1/60 s, with no Math.random anywhere in the rules.

   Rules, in the order a child meets them:
   - hearts, not lives: three at the start, up to five; a bump costs one and
     leaves 2 s of blinking; a melon makes you big and a bump only shrinks you;
   - Piccolo (3 years) never pays for a fall: the dino comes back on the last
     safe ground; Grande (6 years) pays one heart;
   - no clock, no score to lose: out of hearts, the level restarts from the
     last flag and the fruit collected up to it. */
(function () {
  'use strict';
  var C = G.C, W = G.W, H = G.H, T = 48, ROWS = 15, DT = 1 / 60;
  var S = null, LV = null, quiet = false, acc = 0;
  var touches = {}, keys = {};

  var SOLID = { '#': 1, S: 1, B: 1, '?': 1, M: 1, H: 1, T: 1, U: 1, P: 1, p: 1, L: 1, Z: 1, J: 1 };
  var BLOCKS = { '?': 1, M: 1, H: 1, T: 1 };
  var SIZE = [{ w: 30, h: 44, s: 52 }, { w: 40, h: 86, s: 96 }, { w: 40, h: 86, s: 96 }];

  function tune() {
    var small = G.level === 1;
    return {
      maxV: small ? 255 : 295, jump: small ? 870 : 835, accel: 1700, air: 1250, fric: 2100,
      gHold: 1560, gRel: 3700, gFall: 3000, maxFall: 1100, coyote: small ? .14 : .09, buffer: small ? .16 : .11,
      foe: small ? .62 : 1, star: small ? 10 : 8
    };
  }

  /* v2: twenty levels. The four old ones moved (Grotta 1 -> 4, Alberi 2 -> 8, Vulcano 3 -> 19). */
  function saved() {
    var s = G.save.mario || (G.save.mario = { open: 0, best: {}, done: {}, v: 2 });
    if (s.v !== 2) {
      var map = [0, 4, 8, 19], done = {}, best = {}, open = 0;
      Object.keys(s.done || {}).forEach(function (k) { done[map[k]] = true; best[map[k]] = (s.best || {})[k] || 0; open = Math.max(open, map[k] + 1); });
      s.done = done; s.best = best; s.open = Math.max(Math.min(open, 19), map[s.open] === undefined ? 0 : Math.min(map[s.open], open)); s.v = 2;
    }
    return s;
  }

  /* ------------------------------------------------------------ tiles */
  function key(tx, ty) { return tx + ty * 1000; }
  function tile(tx, ty) {
    if (ty < 0 || ty >= ROWS) return ' ';
    if (tx < 0 || tx >= LV.w) return 'S';
    var m = S.mod[key(tx, ty)];
    return m === undefined ? LV.grid[ty][tx] : m;
  }
  function solid(tx, ty) { return !!SOLID[tile(tx, ty)]; }
  function semi(tx, ty) { return tile(tx, ty) === '='; }

  /* Axis-separated movement against the grid. Speeds stay well under one
     tile per frame (max fall 1100 px/s = 18 px), so there is no tunnelling. */
  function move(b, dt) {
    var tx, ty, c0, c1, r0, r1;
    b.wall = false; b.head = null;
    b.x += b.vx * dt;
    r0 = Math.floor(b.y / T); r1 = Math.floor((b.y + b.h - .01) / T);
    if (b.vx > 0) {
      tx = Math.floor((b.x + b.w) / T);
      for (ty = r0; ty <= r1; ty++) if (solid(tx, ty)) { b.x = tx * T - b.w - .01; b.wall = true; break; }
    } else if (b.vx < 0) {
      tx = Math.floor(b.x / T);
      for (ty = r0; ty <= r1; ty++) if (solid(tx, ty)) { b.x = (tx + 1) * T + .01; b.wall = true; break; }
    }
    var prevBottom = b.y + b.h;
    b.y += b.vy * dt; b.on = false;
    c0 = Math.floor(b.x / T); c1 = Math.floor((b.x + b.w - .01) / T);
    if (b.vy > 0) {
      ty = Math.floor((b.y + b.h) / T);
      for (tx = c0; tx <= c1; tx++) if (solid(tx, ty) || (semi(tx, ty) && prevBottom <= ty * T + .5)) { b.y = ty * T - b.h; b.vy = 0; b.on = true; break; }
    } else if (b.vy < 0) {
      ty = Math.floor(b.y / T);
      var hit = [];
      for (tx = c0; tx <= c1; tx++) if (solid(tx, ty)) hit.push(tx);
      if (hit.length) {
        b.y = (ty + 1) * T; b.vy = 0;
        var mid = Math.floor((b.x + b.w / 2) / T);
        b.head = { tx: hit.indexOf(mid) >= 0 ? mid : hit[0], ty: ty };
      }
    }
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  /* ------------------------------------------------------------ effects */
  function sfx(n) { if (!quiet) G.sfx(n); }
  function say(s) { if (!quiet) G.say(s); }
  function burst(x, y, o) { if (!quiet) G.fx.burst(x - S.cam, y, o); }
  function float(x, y, s, col) { if (!quiet) G.fx.text(x - S.cam, y, s, col, 34); }

  /* ------------------------------------------------------------ build */
  var ENEMY = {
    beetle: { w: 40, h: 34, v: 55, stomp: 1 },
    snail: { w: 42, h: 44, v: 42, stomp: 1 },
    hedgehog: { w: 44, h: 38, v: 48, stomp: 0 },
    bird: { w: 46, h: 34, v: 70, stomp: 1, fly: 1 },
    bat: { w: 44, h: 32, v: 0, stomp: 1, fly: 1 },
    drop: { w: 34, h: 34, v: 0, stomp: 0, fly: 1, fireproof: 1 },
    boss: { w: 96, h: 96, v: 70, stomp: 0 }
  };

  function build(li, fromCheck) {
    LV = G.LEVELS[li];
    var tn = tune(), startX = fromCheck && LV.check !== null ? LV.check : LV.start;
    S = {
      li: li, phase: 'ready', t: 0, timer: 0, cam: 0, mod: {}, bumps: [], pops: [], items: [], fire: [], ens: [], plats: [], fruits: [], marks: [],
      hearts: 3, got: fromCheck ? (S && S.checkFruits || 0) : 0, checkFruits: 0, checked: !!fromCheck, star: 0, safe: startX * T, bridge: -1, over: 0,
      p: { x: startX * T + 8, y: 0, w: 30, h: 44, vx: 0, vy: 0, on: false, face: 1, coy: 0, buf: 0, inv: 0, power: 0, prevJ: false, prevF: false, plat: -1, dead: false, auto: 0, hide: false, grow: 0 }
    };
    S.checkFruits = S.got;
    S.p.y = groundBelow(startX) - S.p.h;
    LV.ents.forEach(function (e, i) {
      if (e.only === 2 && G.level !== 2) return;
      var type = G.level === 1 && e.alt ? e.alt : e.type, d = ENEMY[type];
      if (type === 'fruit') { S.fruits.push({ x: e.x * T + 8, y: e.y * T + 8, w: 32, h: 32, got: false }); return; }
      if (type === 'plat') {
        S.plats.push({ x: e.x * T, y: e.y * T, w: e.w * T, h: 22, bx: e.x * T, by: e.y * T, axis: e.axis, range: e.range * T, speed: e.speed, ph: 0, dx: 0, dy: 0 });
        return;
      }
      if (!d) { S.marks.push({ type: type, x: e.x * T, y: e.y * T, on: false, t: 0, col: e.col || 0 }); return; }
      var w = d.w, h = d.h;
      if (type === 'boss' && G.level === 1) { w = 80; h = 80; }
      var en = { id: i, type: type, x: e.x * T + (T - w) / 2, y: (e.y + 1) * T - h, w: w, h: h, vx: -d.v * tn.foe, vy: 0, bx: e.x * T, by: e.y * T, act: false, dead: 0, squash: 0, st: 'walk', kick: 0, hp: G.level === 1 ? 3 : 5, jt: 1.6, hurt: 0 };
      if (d.fly) en.y = e.y * T;
      if (type === 'drop') en.y = ROWS * T + 40;
      S.ens.push(en);
    });
    acc = 0;
  }
  /* The floor a dino is (re)born on: scanned from the BOTTOM, the first
     standable tile with air above it. Scanning from the top found the cave
     ceiling and put the dino on the roof of La Grotta for the whole level. */
  function groundBelow(tx) {
    for (var ty = ROWS - 1; ty > 0; ty--) if ((solid(tx, ty) || semi(tx, ty)) && !solid(tx, ty - 1)) return ty * T;
    return 12 * T;
  }

  function start() { if (S.phase !== 'ready') return; S.phase = 'play'; sfx('win'); say(LV.bridge ? LV.name + '! Salva il piccolo dino.' : LV.name + '! Corri fino alla bandiera.'); }

  /* ------------------------------------------------------------ player */
  function setPower(n) {
    var P = S.p, old = SIZE[P.power], nw = SIZE[n];
    P.power = n; P.x += (old.w - nw.w) / 2; P.y += old.h - nw.h; P.w = nw.w; P.h = nw.h; P.grow = .5;
  }
  function hurt(from) {
    var P = S.p;
    if (P.inv > 0 || S.star > 0 || S.phase !== 'play' || P.dead) return;
    sfx('bad'); if (!quiet) G.shake(5);
    if (P.power > 0) { setPower(0); P.inv = 2; say('Ops! Di nuovo piccolo'); return; }
    S.hearts--; P.inv = 2; P.vy = -430; P.vx = (from && from.x + from.w / 2 > P.x + P.w / 2 ? -1 : 1) * 220;
    if (S.hearts <= 0) die();
  }
  function die() { var P = S.p; P.dead = true; P.vy = -720; P.vx = 0; S.phase = 'dying'; S.timer = 1.3; say('Ci riproviamo!'); }
  function respawn() {
    var P = S.p, tx = Math.floor((S.safe + P.w / 2) / T);
    S.falls = (S.falls || 0) + 1; P.x = S.safe; P.y = groundBelow(tx) - P.h; P.vx = 0; P.vy = 0; P.inv = 1.6; P.plat = -1;
    burst(P.x + P.w / 2, P.y + P.h / 2, { color: C.cream, count: 16 });
  }
  function addFruit(n, x, y) {
    S.got += n; sfx('coin');
    if (Math.floor((S.got - n) / 25) < Math.floor(S.got / 25)) gainHeart(x, y);
  }
  function gainHeart(x, y) {
    if (S.hearts < 5) { S.hearts++; float(x, y - 30, '+1 cuore', C.pinkPop); sfx('good'); }
  }

  function hitBlock(tx, ty) {
    var ch = tile(tx, ty), P = S.p, k = key(tx, ty), x = tx * T, y = ty * T;
    if (BLOCKS[ch]) {
      S.mod[k] = 'U'; S.bumps.push({ k: k, t: .18 });
      if (ch === '?') { addFruit(1, x + T / 2, y); S.pops.push({ x: x + T / 2, y: y, t: 0 }); }
      else {
        var kind = ch === 'H' ? 'heart' : ch === 'T' ? 'star' : P.power === 0 ? 'melon' : 'pepper';
        S.items.push({ kind: kind, x: x + 6, y: y, w: 36, h: 36, vx: 0, vy: 0, rise: T, on: false });
        sfx('pop');
      }
    } else if (ch === 'B') {
      if (P.power > 0) {
        S.mod[k] = ' '; sfx('hatch');
        burst(x + T / 2, y + T / 2, { color: '#c8703a', count: 14, shape: 'rect', size: 12, speed: 320 });
      } else { S.bumps.push({ k: k, t: .18 }); sfx('tap'); }
    } else return;
    // whatever stands on a bumped block is knocked off it
    S.ens.forEach(function (e) {
      if (!e.dead && e.type !== 'boss' && Math.abs(e.y + e.h - y) < 6 && e.x + e.w > x - 4 && e.x < x + T + 4) kill(e, true);
    });
  }

  function kill(e, fromBelow) {
    if (e.dead || e.type === 'drop') return;
    if (e.type === 'boss') { e.hp--; e.hurt = .4; sfx('bad'); if (e.hp > 0) return; say('Il grande scarabeo scappa!'); }
    e.dead = 1; e.vy = fromBelow ? -520 : -380; e.vx = e.vx >= 0 ? 90 : -90; sfx('pop');
    burst(e.x + e.w / 2, e.y + e.h / 2, { color: C.sun, count: 10 });
  }
  function stomp(e) {
    var P = S.p;
    P.vy = P.prevJ ? -760 : -470; sfx('pop');
    if (e.type === 'snail') {
      if (e.st === 'walk') { e.st = 'shell'; e.y += e.h - 32; e.h = 32; e.vx = 0; }
      else if (e.vx !== 0) e.vx = 0;
      else { e.vx = P.x + P.w / 2 < e.x + e.w / 2 ? 520 : -520; e.kick = .25; }
      return;
    }
    e.squash = .45; e.dead = 2;
    burst(e.x + e.w / 2, e.y + e.h, { color: C.cream, count: 8, speed: 180 });
  }

  function input() {
    var o = { l: !!(keys.l), r: !!(keys.r), j: !!(keys.j), f: !!(keys.f) };
    for (var id in touches) o[touches[id]] = true;
    return o;
  }

  /* ------------------------------------------------------------ step */
  function step(inp) {
    var tn = tune(), P = S.p, i, e;
    S.t += DT;
    if (S.phase === 'ready' || S.phase === 'pause' || S.phase === 'over' || S.phase === 'clear') return;

    // moving platforms first, so the rider can be carried
    S.plats.forEach(function (pl) {
      pl.ph += DT * pl.speed;
      var k = .5 - .5 * Math.cos(pl.ph), nx = pl.axis === 'x' ? pl.bx + pl.range * k : pl.bx, ny = pl.axis === 'y' ? pl.by + pl.range * k : pl.by;
      pl.dx = nx - pl.x; pl.dy = ny - pl.y; pl.x = nx; pl.y = ny;
    });
    S.bumps = S.bumps.filter(function (b) { return (b.t -= DT) > 0; });
    S.pops = S.pops.filter(function (p) { return (p.t += DT) < .55; });

    if (S.phase === 'dying') {
      P.vy = Math.min(P.vy + tn.gFall * DT, tn.maxFall); P.y += P.vy * DT;
      if ((S.timer -= DT) <= 0) { S.phase = 'over'; S.over++; }
      return;
    }
    if (S.phase === 'goal') return goalStep(tn);
    if (S.phase === 'bridge') return bridgeStep(tn);

    // ---- player
    if (P.plat >= 0) { var rp = S.plats[P.plat]; P.x += rp.dx; P.y += rp.dy; }
    var dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (P.inv > 1.7 && S.hearts > 0) dir = 0;     // a short knock-back the child can see
    if (dir) {
      var a = P.on ? tn.accel : tn.air;
      if (dir * P.vx < 0) a += tn.fric;
      P.vx = G.clamp(P.vx + dir * a * DT, -tn.maxV, tn.maxV); P.face = dir;
    } else if (P.on) {
      var f = tn.fric * DT; P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f;
    }
    if (inp.j && !P.prevJ) P.buf = tn.buffer;
    if (P.on) P.coy = tn.coyote;
    if (P.buf > 0 && P.coy > 0) { P.vy = -tn.jump; P.buf = 0; P.coy = 0; P.on = false; P.plat = -1; sfx('tap'); }
    if (P.vy >= 0) P.boost = false;
    var g = P.vy < 0 ? (inp.j || P.boost ? tn.gHold : tn.gRel) : tn.gFall;
    P.vy = Math.min(P.vy + g * DT, tn.maxFall);
    P.prevBottom = P.y + P.h;
    move(P, DT);
    if (P.head) hitBlock(P.head.tx, P.head.ty);
    // the spring: land on it and fly, whether or not the jump is held
    if (P.on) { var sty = Math.floor((P.y + P.h + 1) / T); for (var sx = Math.floor(P.x / T); sx <= Math.floor((P.x + P.w - 1) / T); sx++) if (tile(sx, sty) === 'J') { P.vy = -1180; P.boost = true; P.on = false; S.springT = .3; sfx('pop'); break; } }
    S.springT = Math.max(0, (S.springT || 0) - DT);
    // land on a moving platform (from above only)
    P.plat = -1;
    if (P.vy >= 0 && !P.on) for (i = 0; i < S.plats.length; i++) {
      var pl = S.plats[i];
      if (P.x + P.w > pl.x && P.x < pl.x + pl.w && P.prevBottom <= pl.y - pl.dy + 2 && P.y + P.h >= pl.y) { P.y = pl.y - P.h; P.vy = 0; P.on = true; P.plat = i; break; }
    }
    if (P.on && P.plat < 0) {
      var ty = Math.floor((P.y + P.h + 1) / T);
      if ((solid(Math.floor(P.x / T), ty) || semi(Math.floor(P.x / T), ty)) && (solid(Math.floor((P.x + P.w) / T), ty) || semi(Math.floor((P.x + P.w) / T), ty))) S.safe = P.x;
    }
    P.coy = Math.max(0, P.coy - DT); P.buf = Math.max(0, P.buf - DT); P.inv = Math.max(0, P.inv - DT); P.grow = Math.max(0, P.grow - DT);
    S.star = Math.max(0, S.star - DT);
    if (inp.f && !P.prevF && P.power === 2 && S.fire.length < 2) {
      S.fire.push({ x: P.x + P.w / 2 + P.face * 20 - 10, y: P.y + P.h * .35, w: 20, h: 20, vx: P.face * 520, vy: 120, life: 2.2 });
      sfx('whoosh');
    }
    P.prevJ = inp.j; P.prevF = inp.f;

    // falling out of the world
    if (P.y > ROWS * T + 30) {
      if (G.level === 1) { sfx('whoosh'); respawn(); say('Ops! Ti riporto su'); }
      else { S.hearts--; sfx('bad'); if (S.hearts <= 0) { P.dead = true; S.phase = 'dying'; S.timer = .6; } else respawn(); }
    }

    // ---- fruit
    S.fruits.forEach(function (fr) { if (!fr.got && overlap(P, fr)) { fr.got = true; addFruit(1, fr.x + 16, fr.y); } });

    // ---- items
    for (i = S.items.length - 1; i >= 0; i--) {
      var it = S.items[i];
      if (it.rise > 0) { var d = Math.min(it.rise, 70 * DT); it.y -= d; it.rise -= d; if (it.rise <= 0) it.vx = it.kind === 'pepper' ? 0 : it.kind === 'star' ? 170 : 115; }
      else {
        it.vy = Math.min(it.vy + 2000 * DT, 900); var wasVx = it.vx; move(it, DT);
        if (it.wall) it.vx = -wasVx;
        if (it.kind === 'star' && it.on) it.vy = -560;
        if (it.y > ROWS * T + 60) { S.items.splice(i, 1); continue; }
      }
      if (overlap(P, it) && it.rise <= 0) {
        S.items.splice(i, 1);
        if (it.kind === 'melon') { if (P.power === 0) setPower(1); sfx('good'); say('Super dino!'); }
        else if (it.kind === 'pepper') { setPower(2); sfx('good'); say('Fuoco! Premi il tasto rosso'); }
        else if (it.kind === 'star') { S.star = tn.star; sfx('win'); say('Stella! Sei invincibile'); }
        else { if (S.hearts < 5) gainHeart(it.x, it.y); else addFruit(5, it.x, it.y); }
        burst(it.x + 18, it.y + 18, { color: C.sun, count: 14 });
      }
    }

    // ---- fireballs
    for (i = S.fire.length - 1; i >= 0; i--) {
      var fb = S.fire[i], fvx = fb.vx;
      fb.vy = Math.min(fb.vy + 2000 * DT, 900); move(fb, DT);
      if (fb.on) fb.vy = -430;
      fb.life -= DT;
      var gone = fb.wall || fb.life <= 0 || fb.y > ROWS * T || fb.x < S.cam - 60 || fb.x > S.cam + W + 60;
      if (!gone) for (var j = 0; j < S.ens.length; j++) { e = S.ens[j]; if (!e.dead && e.act && !ENEMY[e.type].fireproof && overlap(fb, e)) { kill(e); gone = true; break; } }
      if (gone) { burst(fb.x + 10, fb.y + 10, { color: C.tangerine, count: 6, speed: 120 }); S.fire.splice(i, 1); }
      else fb.vx = fvx;
    }

    // ---- enemies
    for (i = S.ens.length - 1; i >= 0; i--) {
      e = S.ens[i];
      if (!e.act) { if (e.x < S.cam + W + 120) e.act = true; else continue; }
      if (e.dead === 2) { if ((e.squash -= DT) <= 0) S.ens.splice(i, 1); continue; }
      if (e.dead === 1) { e.vy += 1800 * DT; e.x += e.vx * DT; e.y += e.vy * DT; if (e.y > ROWS * T + 100) S.ens.splice(i, 1); continue; }
      enemyStep(e, tn);
      if (e.y > ROWS * T + 60) { S.ens.splice(i, 1); continue; }
      if (overlap(P, e) && !P.dead) touch(e);
    }
    // moving shells knock the others over
    S.ens.forEach(function (sh) {
      if (sh.dead || sh.st !== 'shell' || sh.vx === 0) return;
      S.ens.forEach(function (o) { if (o !== sh && !o.dead && o.act && o.type !== 'drop' && o.type !== 'boss' && overlap(sh, o)) kill(o); });
    });

    // ---- marks: checkpoint, flag, lever
    S.marks.forEach(function (m) {
      if (m.type === 'check' && !m.on && P.x > m.x) {
        m.on = true; S.checked = true; S.checkFruits = S.got; sfx('chime'); say('Bandierina! Da qui riparti'); burst(m.x + 24, m.y, { color: C.sun, count: 18 });
      }
      if (m.type === 'flag' && P.x + P.w > m.x + 20) {
        S.phase = 'goal'; S.goal = m; P.vx = 0; P.vy = 0; P.x = m.x + 20 - P.w; S.flagY = 3 * T;
        var bonus = Math.max(1, Math.round((12 * T - P.y) / T));
        addFruit(bonus, P.x, P.y); float(P.x, P.y - 20, '+' + bonus, C.sun); sfx('win');
      }
      if (m.type === 'lever' && P.x + P.w > m.x + 6 && !m.on) {
        m.on = true; S.phase = 'bridge'; S.bridge = LV.bridge.x1; S.timer = .1; P.vx = 0; sfx('chime'); say('Giù il ponte!');
      }
    });

    // camera: the dino sits a bit left of centre, looking at what is coming
    var target = G.clamp(P.x - 480, 0, LV.w * T - W);
    S.cam += (target - S.cam) * Math.min(1, DT * 8);
  }

  function enemyStep(e, tn) {
    var d = ENEMY[e.type];
    e.kick = Math.max(0, e.kick - DT); e.hurt = Math.max(0, e.hurt - DT);
    if (e.type === 'bird') { e.x += e.vx * DT; e.y = e.by + Math.sin(S.t * 2.4 + e.id) * 34; return; }
    if (e.type === 'bat') { e.x = e.bx + Math.sin(S.t * 1.2 * tn.foe + e.id) * 110; e.y = e.by + Math.sin(S.t * 2.4 * tn.foe + e.id) * 52; e.vx = Math.cos(S.t * 1.2 + e.id); return; }
    if (e.type === 'drop') {
      var per = 3.2, ph = (S.t + e.id * .7) % per, base = ROWS * T + 40;
      e.y = ph < 1.37 ? base - (960 * ph - 700 * ph * ph) : base;
      return;
    }
    if (e.type === 'boss') {
      var P = S.p;
      if (S.phase === 'play' && e.on) {
        if ((e.jt -= DT) <= 0) { e.vy = G.level === 1 ? -520 : -640; e.jt = G.level === 1 ? 3 : 2.2; }
        var lo = e.bx - 6 * T, hi = e.bx + 4 * T;
        if (e.x < lo) e.vx = Math.abs(e.vx); if (e.x > hi) e.vx = -Math.abs(e.vx);
      }
      e.face = P.x < e.x ? -1 : 1;
      e.vy = Math.min(e.vy + 1800 * DT, 900); move(e, DT);
      return;
    }
    var vx = e.vx;
    e.vy = Math.min(e.vy + 2000 * DT, 900); move(e, DT);
    if (e.wall) e.vx = -vx;
    else if (e.on && !(e.st === 'shell')) {
      // walkers turn at ledges: enemies stay on the platform where the child saw them
      var fx = vx > 0 ? e.x + e.w + 2 : e.x - 2, ty = Math.floor((e.y + e.h + 2) / T), tx = Math.floor(fx / T);
      if (!solid(tx, ty) && !semi(tx, ty)) e.vx = -vx;
    }
  }

  function touch(e) {
    var P = S.p, d = ENEMY[e.type];
    if (S.star > 0 && e.type !== 'boss' && e.type !== 'drop') { kill(e); return; }
    if (e.st === 'shell' && e.vx === 0) {
      if (P.vy > 0 && P.prevBottom <= e.y + 14) { P.vy = -470; }
      e.vx = P.x + P.w / 2 < e.x + e.w / 2 ? 520 : -520; e.kick = .25; sfx('pop'); return;
    }
    if (d.stomp && P.vy > 0 && P.prevBottom <= e.y + 16) { stomp(e); return; }
    if (e.kick > 0) return;
    hurt(e);
  }

  function goalStep(tn) {
    var P = S.p, m = S.goal, ground = groundBelow(Math.floor((m.x + 20) / T));
    S.flagY = Math.min(S.flagY + 300 * DT, ground - T);
    if (P.auto === 0) {
      P.y = Math.min(P.y + 300 * DT, ground - P.h);
      if (P.y >= ground - P.h) { P.auto = 1; P.x = m.x + 30; P.face = 1; }
    } else if (!P.hide) {
      P.vx = 150; P.vy += tn.gFall * DT; move(P, DT);
      if (P.x > m.x + 5 * T + 45) { P.hide = true; S.timer = 1; sfx('win'); if (!quiet) G.fx.confetti(); }
    } else if ((S.timer -= DT) <= 0) clear();
    S.cam += (G.clamp(P.x - 480, 0, LV.w * T - W) - S.cam) * Math.min(1, DT * 4);
  }
  function bridgeStep(tn) {
    var P = S.p;
    P.vy = Math.min(P.vy + tn.gFall * DT, tn.maxFall); P.vx = 0; move(P, DT);
    if (S.bridge >= LV.bridge.x0) {
      if ((S.timer -= DT) <= 0) { S.mod[key(S.bridge, LV.bridge.row)] = ' '; S.bridge--; S.timer = .06; sfx('tap'); }
    } else if (S.bridge > -5) {
      P.vx = 140; P.face = 1; move(P, DT);
      var chick = S.marks.filter(function (m) { return m.type === 'chick'; })[0];
      if (P.x + P.w > chick.x) { S.bridge = -10; S.timer = 1.4; if (!quiet) G.fx.confetti(); sfx('win'); say('Hai salvato il piccolo dino!'); }
    } else if ((S.timer -= DT) <= 0) clear();
    S.ens.forEach(function (e) { if (e.type === 'boss' && !e.dead) { e.vx = 0; e.vy = Math.min(e.vy + 1800 * DT, 900); move(e, DT); if (e.y > ROWS * T) e.dead = 1; } else if (e.dead === 1) { e.vy += 1800 * DT; e.y += e.vy * DT; } });
  }
  function clear() {
    S.phase = 'clear';
    var s = saved(); s.done[S.li] = true; s.best[S.li] = Math.max(s.best[S.li] || 0, S.got); s.open = Math.max(s.open, Math.min(G.LEVELS.length - 1, S.li + 1));
    G.saveNow(); say(S.li === G.LEVELS.length - 1 ? 'Hai finito tutti i mondi! Bravissimo!' : 'Bravissimo! Livello finito');
  }

  function action(a) {
    if (a === 'pause') { if (S.phase === 'play') { S.phase = 'pause'; G.hush(); } else if (S.phase === 'pause') S.phase = 'play'; }
  }

  /* ================================================================ drawing */
  var CHICK = [C.pinkPop, C.blueberry, C.mint, C.tangerine, C.pinkPop];
  var THEME = {
    prato: { sky: ['#7fd0f0', '#cdf0f7'], hill: '#8fcf7a', hill2: '#6bb862', grass: '#5cbf4f', dirt: '#b9773f', dirt2: '#9a5f30', liquid: '#3fb6c9' },
    grotta: { sky: ['#1e1b33', '#3b3150'], hill: '#2c2744', hill2: '#3a3358', grass: '#7f8fb8', dirt: '#56607f', dirt2: '#454e6b', liquid: '#2a5c7a' },
    alberi: { sky: ['#ffc98a', '#ffeccb'], hill: '#9bcf8a', hill2: '#78b76c', grass: '#5cbf4f', dirt: '#b9773f', dirt2: '#9a5f30', liquid: '#3fb6c9' },
    spiaggia: { sky: ['#5ccdf2', '#e6f8f4'], hill: '#9fdcef', hill2: '#f0d9a0', grass: '#f7e2a8', dirt: '#e8c27a', dirt2: '#d6a95c', liquid: '#2fb5d9' },
    vulcano: { sky: ['#3a1622', '#8a3a2a'], hill: '#4a2330', hill2: '#5c2a33', grass: '#e0623a', dirt: '#4a3a3f', dirt2: '#3a2c30', liquid: '#ff7a1a' }
  };
  function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fill(); }

  function background(c, th, theme, cam) {
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    cam = cam === undefined ? (S ? S.cam : 0) : cam; theme = theme || (LV ? LV.theme : 'prato'); var i, x;
    if (theme === 'vulcano') {
      c.fillStyle = '#ffb04a33'; c.beginPath(); c.arc(900 - cam * .05, 250, 160, 0, 7); c.fill();
      poly(c, [[620 - cam * .08, 520], [840 - cam * .08, 230], [960 - cam * .08, 230], [1220 - cam * .08, 520]], '#2a1018');
      c.fillStyle = '#ff7a1a'; c.fillRect(846 - cam * .08, 226, 108, 10);
    } else if (theme === 'grotta') {
      for (i = 0; i < 14; i++) { x = ((i * 157 - cam * .3) % 2200 + 2200) % 2200 - 200; poly(c, [[x, 140], [x + 30, 140], [x + 15, 200 + (i % 3) * 30]], '#2c2744'); }
      for (i = 0; i < 10; i++) { x = ((i * 263 - cam * .45) % 2400 + 2400) % 2400 - 200; c.fillStyle = i % 2 ? '#8f5bd666' : '#38d9a966'; poly(c, [[x, 600], [x + 14, 560], [x + 28, 600]], c.fillStyle); }
    } else {
      if (theme === 'spiaggia') { c.fillStyle = '#3fa9d6'; c.fillRect(0, 470, W, 60); c.fillStyle = 'rgba(255,255,255,.5)'; for (i = 0; i < 12; i++) { x = ((i * 137 - cam * .2) % 1400 + 1400) % 1400 - 60; c.fillRect(x, 488 + (i % 3) * 12, 40, 3); } }
      c.fillStyle = theme === 'alberi' ? '#fff3c4' : '#fff7d0'; c.beginPath(); c.arc(1060, 150, 56, 0, 7); c.fill();
      for (i = 0; i < 6; i++) { x = ((i * 390 - cam * .15) % 2400 + 2400) % 2400 - 250; cloud(c, x, 150 + (i % 3) * 50, 1 + (i % 2) * .3); }
    }
    // castle levels: the castle waits on the horizon, a little closer at every step
    if (LV && LV.bridge && theme !== 'grotta') {
      var cx0 = 1500 - cam * .18, cy0 = 470, stone = theme === 'vulcano' ? '#3a2430' : '#9aa0a6', dark = theme === 'vulcano' ? '#2a1420' : '#7b8188';
      c.fillStyle = stone; c.fillRect(cx0, cy0 - 150, 260, 150);
      [[-30, 230], [100, 280], [230, 230]].forEach(function (tw) { c.fillStyle = stone; c.fillRect(cx0 + tw[0], cy0 - tw[1], 60, tw[1]); poly(c, [[cx0 + tw[0] - 8, cy0 - tw[1]], [cx0 + tw[0] + 30, cy0 - tw[1] - 50], [cx0 + tw[0] + 68, cy0 - tw[1]]], dark); });
      c.fillStyle = dark; G.roundRect(c, cx0 + 105, cy0 - 70, 50, 70, 25); c.fill();
      c.fillStyle = C.berry; poly(c, [[cx0 + 130, cy0 - 330], [cx0 + 170, cy0 - 318], [cx0 + 130, cy0 - 306]], C.berry);
    }
    for (i = -1; i < 5; i++) { x = i * 420 - (cam * .3) % 420; hill(c, x, 560, 260, 170, th.hill); }
    for (i = -1; i < 6; i++) { x = i * 300 - (cam * .5) % 300 + 120; hill(c, x, 600, 190, 110, th.hill2); }
    if (theme === 'alberi') for (i = -1; i < 7; i++) { x = i * 240 - (cam * .6) % 240; c.fillStyle = '#6b8f4a55'; c.fillRect(x + 90, 0, 44, H); }
  }
  function cloud(c, x, y, s) { c.fillStyle = 'rgba(255,255,255,.9)'; [[0, 0, 44], [40, -14, 38], [78, 0, 34], [36, 12, 40]].forEach(function (p) { c.beginPath(); c.arc(x + p[0] * s, y + p[1] * s, p[2] * s, 0, 7); c.fill(); }); }
  function hill(c, x, y, w, h, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x - w, H); c.quadraticCurveTo(x, y - h * 1.6, x + w, H); c.fill(); }

  function drawTile(c, ch, x, y, tx, ty, th) {
    var up = tile(tx, ty - 1);
    switch (ch) {
      case '#':
        c.fillStyle = th.dirt; c.fillRect(x, y, T, T);
        c.fillStyle = th.dirt2; c.fillRect(x + ((tx * 7) % 3) * 12 + 6, y + 18 + (ty % 2) * 10, 10, 7); c.fillRect(x + 30 - ((tx * 5) % 3) * 8, y + 34, 8, 6);
        if (up !== '#') { c.fillStyle = th.grass; c.fillRect(x, y, T, 14); c.beginPath(); for (var k = 0; k < 4; k++) c.arc(x + 6 + k * 12, y + 14, 7, 0, Math.PI); c.fill(); }
        break;
      case 'S':
        c.fillStyle = LV.theme === 'vulcano' ? '#6a5057' : '#8e8a86'; c.fillRect(x, y, T, T);
        c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x, y, T, 6); c.fillRect(x, y, 6, T);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y + T - 6, T, 6); c.fillRect(x + T - 6, y, 6, T);
        break;
      case 'B':
        c.fillStyle = '#c8703a'; c.fillRect(x, y, T, T);
        c.fillStyle = '#7a3b1a'; c.fillRect(x, y + 22, T, 4); c.fillRect(x, y + T - 3, T, 3); c.fillRect(x + 22, y, 4, 22); c.fillRect(x + 8, y + 26, 4, 22); c.fillRect(x + 36, y + 26, 4, 22);
        c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x, y, T, 4);
        break;
      case '?': case 'M': case 'H': case 'T':
        var glow = .5 + .5 * Math.sin(S.t * 4);
        c.fillStyle = '#b3701e'; G.roundRect(c, x + 1, y + 1, T - 2, T - 2, 8); c.fill();
        c.fillStyle = 'rgb(' + (240 + glow * 15 | 0) + ',' + (190 + glow * 25 | 0) + ',60)'; G.roundRect(c, x + 3, y + 3, T - 6, T - 9, 7); c.fill();
        c.fillStyle = '#b3701e'; [[8, 8], [T - 11, 8], [8, T - 14], [T - 11, T - 14]].forEach(function (p) { c.fillRect(x + p[0], y + p[1], 4, 4); });
        G.text('?', x + T / 2, y + T / 2 - 1, { size: 32, color: '#fff6e0', stroke: '#8a4d10', strokeWidth: 6 });
        break;
      case 'U':
        c.fillStyle = '#8a5a32'; G.roundRect(c, x + 1, y + 1, T - 2, T - 2, 8); c.fill();
        c.fillStyle = '#6a4222'; [[8, 8], [T - 11, 8], [8, T - 12], [T - 11, T - 12]].forEach(function (p) { c.fillRect(x + p[0], y + p[1], 4, 4); });
        break;
      case 'P': case 'p':
        var left = ch === 'P', top = up !== ch;
        c.fillStyle = '#8a5a32'; c.fillRect(x + (left ? 4 : 0), y, T - 4, T);
        c.fillStyle = '#6a4222'; for (var r = 0; r < 3; r++) c.fillRect(x + (left ? 10 + r * 12 : 4 + r * 12), y, 4, T);
        c.fillStyle = left ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.15)'; c.fillRect(x + (left ? 4 : 0), y, T - 4, T);
        if (top) {
          c.fillStyle = '#5a9a3a'; c.fillRect(x + (left ? 0 : -2), y, T + 2, 16);
          if (left) { c.fillStyle = '#e8c38a'; c.beginPath(); c.ellipse(x + T, y + 8, T - 8, 6, 0, 0, 7); c.fill(); c.fillStyle = '#4a2c14'; c.beginPath(); c.ellipse(x + T, y + 8, T - 18, 3, 0, 0, 7); c.fill(); }
        }
        break;
      case 'L':
        var lft = tile(tx - 1, ty) !== 'L', rgt = tile(tx + 1, ty) !== 'L';
        c.fillStyle = '#2f8f4e'; G.roundRect(c, x - (lft ? 6 : 0), y, T + (lft ? 6 : 0) + (rgt ? 6 : 0), T - 8, lft || rgt ? 18 : 0); c.fill();
        c.fillStyle = '#63c777'; G.roundRect(c, x - (lft ? 4 : 0), y + 2, T + (lft ? 4 : 0) + (rgt ? 4 : 0), 16, 8); c.fill();
        c.fillStyle = '#1c5c33'; c.beginPath(); c.arc(x + 14, y + 28, 5, 0, 7); c.arc(x + 34, y + 30, 4, 0, 7); c.fill();
        break;
      case 'K':
        c.fillStyle = '#8a5a32'; c.fillRect(x + 6, y, T - 12, T); c.fillStyle = '#6a4222'; c.fillRect(x + 16, y, 4, T); c.fillRect(x + 30, y, 3, T);
        break;
      case 'Z':
        c.fillStyle = '#8a5a32'; c.fillRect(x, y, T, 18); c.fillStyle = '#6a4222'; c.fillRect(x + T - 4, y, 4, 18);
        c.strokeStyle = '#b5b0a8'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + 3); c.quadraticCurveTo(x + T / 2, y + 12, x + T, y + 3); c.stroke();
        break;
      case 'J':
        var sq = S.springT > 0 ? 10 : 0;
        c.fillStyle = '#6a4222'; c.fillRect(x + 4, y + T - 10, T - 8, 10);
        c.strokeStyle = '#8e969c'; c.lineWidth = 5; c.beginPath(); for (var z = 0; z <= 4; z++) c.lineTo(x + (z % 2 ? T - 12 : 12), y + T - 10 - z * (T - 22 - sq) / 4); c.stroke();
        c.fillStyle = C.berry; G.roundRect(c, x + 2, y + 6 + sq, T - 4, 12, 6); c.fill();
        break;
      case '=':
        c.fillStyle = '#b07a44'; c.fillRect(x, y, T, 14); c.fillStyle = '#7a4a26'; c.fillRect(x, y + 10, T, 4);
        break;
    }
  }

  function drawLevel(c) {
    var th = THEME[LV.theme], tx0 = Math.max(0, Math.floor(S.cam / T)), tx1 = Math.min(LV.w - 1, tx0 + Math.ceil(W / T) + 1), tx, ty;
    // liquid at the bottom of every pit
    c.fillStyle = th.liquid; c.fillRect(0, 13 * T + 20, W, H);
    c.fillStyle = 'rgba(255,255,255,.25)';
    for (var w = 0; w < 30; w++) { var wx = ((w * 70 - S.cam + Math.sin(S.t * 2 + w) * 10) % (W + 70) + W + 70) % (W + 70) - 35; c.fillRect(wx, 13 * T + 26 + (w % 3) * 18, 34, 4); }
    // trunks behind everything
    for (tx = tx0; tx <= tx1; tx++) for (ty = 0; ty < ROWS; ty++) if (tile(tx, ty) === 'K') drawTile(c, 'K', tx * T - S.cam, ty * T, tx, ty, th);
    for (tx = tx0; tx <= tx1; tx++) for (ty = 0; ty < ROWS; ty++) {
      var ch = tile(tx, ty);
      if (ch === ' ' || ch === 'K') continue;
      var bump = 0, k = key(tx, ty);
      for (var b = 0; b < S.bumps.length; b++) if (S.bumps[b].k === k) bump = Math.sin((S.bumps[b].t / .18) * Math.PI) * 10;
      drawTile(c, ch, tx * T - S.cam, ty * T - bump, tx, ty, th);
    }
  }

  function drawMarks(c) {
    S.marks.forEach(function (m) {
      var x = m.x - S.cam;
      if (x < -400 || x > W + 400) return;
      if (m.type === 'check') {
        var gy = groundBelow(Math.floor(m.x / T) + 0);
        c.fillStyle = '#6a4222'; c.fillRect(x + 20, gy - 120, 6, 120);
        poly(c, [[x + 26, gy - 120], [x + 70, gy - 104], [x + 26, gy - 88]], m.on ? C.sun : '#b9ada0');
        if (m.on) A.star(c, x + 40, gy - 104, 8, C.cream);
      } else if (m.type === 'flag') {
        var ground = groundBelow(Math.floor((m.x + 20) / T));
        c.fillStyle = '#e9e2d0'; c.fillRect(x + 18, 3 * T, 6, ground - 3 * T);
        c.fillStyle = C.sun; c.beginPath(); c.arc(x + 21, 3 * T - 6, 10, 0, 7); c.fill();
        var fy = S.phase === 'goal' || S.phase === 'clear' ? S.flagY : 3 * T;
        poly(c, [[x + 18, fy + 6], [x - 44, fy + 26], [x + 18, fy + 46]], C.leaf);
        A.SHAPES.stella(c, x - 4, fy + 26, 10, C.sun);
        // the hut the dino walks into
        var hx = x + 5 * T;
        c.fillStyle = '#b07a44'; c.fillRect(hx - 10, ground - 130, 150, 130);
        poly(c, [[hx - 30, ground - 126], [hx + 65, ground - 200], [hx + 160, ground - 126]], '#c8703a');
        c.fillStyle = '#3a2412'; G.roundRect(c, hx + 40, ground - 80, 50, 80, 22); c.fill();
        c.fillStyle = '#8fd8e8'; c.fillRect(hx + 102, ground - 104, 26, 26);
      } else if (m.type === 'lever') {
        var ly = m.y + T;
        c.fillStyle = '#8e8a86'; G.roundRect(c, x + 6, ly - 20, 36, 20, 6); c.fill();
        c.save(); c.translate(x + 24, ly - 16); c.rotate(m.on ? .7 : -.7);
        c.fillStyle = '#6a4222'; c.fillRect(-4, -56, 8, 56); c.fillStyle = C.berry; c.beginPath(); c.arc(0, -58, 12, 0, 7); c.fill(); c.restore();
      } else if (m.type === 'chick') {
        var cy = m.y + T, free = S.bridge === -10 || S.phase === 'clear' || (S.bridge < LV.bridge.x0 && S.bridge > -5 && S.phase === 'bridge');
        if (A.chick) A.chick(c, x + 24, cy - 30, 60, { t: S.t, color: CHICK[m.col] });
        if (!free) { c.strokeStyle = '#3a2c30'; c.lineWidth = 5; for (var i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x - 16 + i * 16, cy - 84); c.lineTo(x - 16 + i * 16, cy); c.stroke(); } c.fillStyle = '#3a2c30'; c.fillRect(x - 22, cy - 90, 92, 10); }
      }
    });
  }

  function drawEnemy(c, e) {
    var x = e.x - S.cam, y = e.y, cx = x + e.w / 2, dir = e.vx > 0 ? 1 : -1, t = S.t;
    if (x < -120 || x > W + 120) return;
    c.save();
    if (e.dead === 1) { c.translate(cx, y + e.h / 2); c.scale(1, -1); c.translate(-cx, -(y + e.h / 2)); }
    if (e.dead === 2) { c.translate(cx, y + e.h); c.scale(1.2, .35); c.translate(-cx, -(y + e.h)); }
    if (e.hurt > 0 && Math.sin(t * 50) > 0) c.globalAlpha = .45;
    var step = Math.sin(t * 12 + e.id) * 4;
    function eyes(ex, ey, r) { c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - r * 1.1, ey, r, 0, 7); c.arc(ex + r * 1.1, ey, r, 0, 7); c.fill(); c.fillStyle = C.ink; c.beginPath(); c.arc(ex - r * 1.1 + dir * r * .4, ey, r * .5, 0, 7); c.arc(ex + r * 1.1 + dir * r * .4, ey, r * .5, 0, 7); c.fill(); }
    switch (e.type) {
      case 'beetle':
        c.fillStyle = C.ink; c.fillRect(cx - 14 + step, y + e.h - 8, 8, 8); c.fillRect(cx + 6 - step, y + e.h - 8, 8, 8);
        c.fillStyle = '#b3423a'; c.beginPath(); c.ellipse(cx, y + e.h - 16, 20, 17, 0, Math.PI, 0); c.fill(); c.fillRect(cx - 20, y + e.h - 17, 40, 8);
        c.strokeStyle = '#7a2420'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, y + 2); c.lineTo(cx, y + e.h - 10); c.stroke();
        c.fillStyle = '#e8536b'; c.beginPath(); c.arc(cx - 9, y + 12, 4, 0, 7); c.arc(cx + 9, y + 14, 3, 0, 7); c.fill();
        c.fillStyle = '#2b1d12'; c.beginPath(); c.ellipse(cx + dir * 17, y + e.h - 14, 11, 10, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + dir * 20, y + e.h - 17, 4, 0, 7); c.fill();
        break;
      case 'snail':
        if (e.st === 'walk') { c.fillStyle = '#e9cf8a'; G.roundRect(c, x - 2, y + e.h - 14, e.w + 4, 14, 7); c.fill(); c.strokeStyle = '#e9cf8a'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx + dir * 18, y + e.h - 12); c.lineTo(cx + dir * 24, y + 6); c.stroke(); c.fillStyle = C.ink; c.beginPath(); c.arc(cx + dir * 24, y + 6, 4, 0, 7); c.fill(); }
        var sy = e.st === 'walk' ? y + e.h - 26 : y + e.h - 16, sr = e.st === 'walk' ? 18 : 16;
        c.fillStyle = C.tangerine; c.beginPath(); c.arc(cx - (e.st === 'walk' ? dir * 4 : 0), sy, sr, 0, 7); c.fill();
        c.strokeStyle = '#b35f10'; c.lineWidth = 4; c.beginPath();
        for (var a = 0; a < 12; a++) { var rr = sr * (1 - a / 13), an = a * .9 + (e.st === 'shell' ? e.x * .05 : 0); c.lineTo(cx - (e.st === 'walk' ? dir * 4 : 0) + Math.cos(an) * rr, sy + Math.sin(an) * rr); } c.stroke();
        break;
      case 'hedgehog':
        var hy = y + e.h - 14;
        for (var s = 0; s < 9; s++) { var an = Math.PI * (1.08 + s * .105), bx = cx - dir * 4 + Math.cos(an) * 20, by = hy + Math.sin(an) * 16; poly(c, [[bx + Math.cos(an + 1.3) * 7, by + Math.sin(an + 1.3) * 7], [bx + Math.cos(an) * 16, by + Math.sin(an) * 16], [bx + Math.cos(an - 1.3) * 7, by + Math.sin(an - 1.3) * 7]], '#3a2412'); }
        c.fillStyle = '#6a4222'; c.beginPath(); c.ellipse(cx - dir * 4, hy, 21, 15, 0, 0, 7); c.fill();
        c.fillStyle = '#e9cf8a'; c.beginPath(); c.ellipse(cx + dir * 15, hy + 3, 11, 9, 0, 0, 7); c.fill();
        c.fillStyle = C.ink; c.beginPath(); c.arc(cx + dir * 25, hy + 3, 3.5, 0, 7); c.arc(cx + dir * 14, hy - 1, 3, 0, 7); c.fill();
        c.fillRect(cx - 12 + step, y + e.h - 5, 7, 5); c.fillRect(cx + 5 - step, y + e.h - 5, 7, 5);
        break;
      case 'bird': case 'bat':
        var flap = Math.sin(t * 16 + e.id) * 14, col = e.type === 'bird' ? C.blueberry : C.plum;
        c.fillStyle = col; poly(c, [[cx - 4, y + 16], [cx - 30, y + 6 - flap], [cx - 10, y + 22]], col); poly(c, [[cx + 4, y + 16], [cx + 30, y + 6 - flap], [cx + 10, y + 22]], col);
        c.beginPath(); c.ellipse(cx, y + 18, 16, 13, 0, 0, 7); c.fill();
        if (e.type === 'bird') poly(c, [[cx + dir * 14, y + 14], [cx + dir * 28, y + 19], [cx + dir * 14, y + 23]], C.sun);
        eyes(cx + dir * 4, y + 14, 4);
        break;
      case 'drop':
        if (y > ROWS * T) break;
        if (LV.theme !== 'vulcano') {
          // out of the water it is a fish, not a lava drop
          c.fillStyle = C.tangerine; c.beginPath(); c.ellipse(cx, y + 17, 12, 18, 0, 0, 7); c.fill();
          poly(c, [[cx, y + 30], [cx - 12, y + 42], [cx + 12, y + 42]], C.tangerine);
          c.fillStyle = '#fff'; c.beginPath(); c.arc(cx - 5, y + 10, 4, 0, 7); c.arc(cx + 5, y + 10, 4, 0, 7); c.fill(); c.fillStyle = C.ink; c.beginPath(); c.arc(cx - 5, y + 10, 2, 0, 7); c.arc(cx + 5, y + 10, 2, 0, 7); c.fill();
          break;
        }
        c.fillStyle = '#ffb04a'; c.beginPath(); c.arc(cx, y + 17, 17, 0, 7); c.fill();
        c.fillStyle = '#ff7a1a'; poly(c, [[cx - 14, y + 12], [cx, y - 12], [cx + 14, y + 12]], '#ff7a1a');
        eyes(cx, y + 17, 4);
        break;
      case 'boss':
        var bw = e.w, bh = e.h;
        c.fillStyle = C.ink; c.fillRect(x + bw * .2 + step, y + bh - 12, 16, 12); c.fillRect(x + bw * .65 - step, y + bh - 12, 16, 12);
        c.fillStyle = '#5b2a7a'; c.beginPath(); c.ellipse(cx, y + bh * .58, bw * .5, bh * .45, 0, 0, 7); c.fill();
        for (var sp = 0; sp < 5; sp++) poly(c, [[x + bw * (.1 + sp * .17), y + bh * .25], [x + bw * (.18 + sp * .17), y - 6], [x + bw * (.26 + sp * .17), y + bh * .25]], '#ffd75e');
        c.fillStyle = '#8f5bd6'; c.beginPath(); c.ellipse(cx, y + bh * .5, bw * .38, bh * .3, 0, 0, 7); c.fill();
        var fd = e.face || -1;
        c.fillStyle = '#2b1d12'; c.beginPath(); c.ellipse(cx + fd * bw * .38, y + bh * .62, bw * .22, bh * .22, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + fd * bw * .42, y + bh * .56, 8, 0, 7); c.fill(); c.fillStyle = C.berry; c.beginPath(); c.arc(cx + fd * bw * .44, y + bh * .56, 4, 0, 7); c.fill();
        c.strokeStyle = '#fff6e0'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx + fd * bw * .3, y + bh * .46); c.lineTo(cx + fd * bw * .52, y + bh * .5); c.stroke();
        break;
    }
    c.restore();
  }

  function drawItem(c, it) {
    var x = it.x - S.cam + 18, y = it.y + 18;
    if (it.kind === 'melon') A.fruit(c, x, y, 18, 'melone');
    else if (it.kind === 'heart') A.SHAPES.cuore(c, x, y, 18, C.pinkPop);
    else if (it.kind === 'star') A.star(c, x, y, 20, C.sun);
    else {
      c.save(); c.translate(x, y); c.rotate(-.5);
      c.fillStyle = '#e8362b'; c.beginPath(); c.ellipse(0, 2, 9, 19, 0, 0, 7); c.fill();
      c.fillStyle = '#ff8a7a'; c.beginPath(); c.ellipse(-3, -2, 3, 9, 0, 0, 7); c.fill();
      c.fillStyle = C.leaf; c.fillRect(-3, -24, 6, 8); c.restore();
    }
  }

  function drawPlayer(c) {
    var P = S.p;
    if (P.hide) return;
    if (P.inv > 0 && S.phase === 'play' && Math.sin(S.t * 30) > 0) return;
    var sz = SIZE[P.power], s = sz.s * (P.grow > 0 ? 1 + Math.sin(P.grow * 30) * .08 : 1), x = P.x + P.w / 2 - S.cam, feet = P.y + P.h;
    var col = (G.account && G.account.color) || C.dino;
    if (S.star > 0) col = [C.sun, C.pinkPop, C.mint, C.blueberry, C.tangerine][Math.floor(S.t * 12) % 5];
    var pose = S.phase === 'clear' ? 'happy' : !P.on ? 'walk' : Math.abs(P.vx) > 20 ? 'walk' : 'idle';
    c.save();
    if (P.dead) { c.translate(x, feet - s / 2); c.rotate(Math.PI); c.translate(-x, -(feet - s / 2)); }
    if (P.power === 2) { c.fillStyle = 'rgba(255,140,40,.28)'; c.beginPath(); c.ellipse(x, feet - s * .5, s * .5, s * .58, 0, 0, 7); c.fill(); }
    A.dino(c, x, feet, s, { facing: P.face, pose: pose, t: P.on ? S.t : 0.3, color: col, hat: null });
    if (P.power === 2) poly(c, [[x - 14 + P.face * 6, feet - s * .96], [x + P.face * 6, feet - s * 1.2 - Math.sin(S.t * 14) * 4], [x + 14 + P.face * 6, feet - s * .96]], '#ff5a2a');
    c.restore();
  }

  function drawWorld(c) {
    background(c, THEME[LV.theme]);
    drawLevel(c);
    drawMarks(c);
    S.plats.forEach(function (pl) {
      var x = pl.x - S.cam;
      c.fillStyle = '#7a4a26'; G.roundRect(c, x, pl.y, pl.w, pl.h, 8); c.fill();
      c.fillStyle = '#b07a44'; G.roundRect(c, x + 3, pl.y + 2, pl.w - 6, 9, 5); c.fill();
      c.strokeStyle = '#b5b0a8'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 12, pl.y); c.lineTo(x + 12, 0); c.moveTo(x + pl.w - 12, pl.y); c.lineTo(x + pl.w - 12, 0); c.stroke();
    });
    S.fruits.forEach(function (fr, i) { if (!fr.got && fr.x - S.cam > -40 && fr.x - S.cam < W + 40) A.fruit(c, fr.x + 16 - S.cam, fr.y + 16 + Math.sin(S.t * 3 + i) * 3, 15, ['fragola', 'banana', 'uva', 'mela'][i % 4]); });
    S.pops.forEach(function (p) { c.globalAlpha = 1 - p.t / .55; A.fruit(c, p.x - S.cam, p.y - 20 - p.t * 140, 15, 'fragola'); c.globalAlpha = 1; });
    S.items.forEach(function (it) { drawItem(c, it); });
    S.ens.forEach(function (e) { drawEnemy(c, e); });
    drawPlayer(c);
    S.fire.forEach(function (fb) { var x = fb.x - S.cam + 10, y = fb.y + 10; c.fillStyle = '#ffb04a'; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); c.fillStyle = '#ff5a2a'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); });
  }

  /* ------------------------------------------------------------ HUD + pads */
  var PADS = { l: { x: 24, y: 566, w: 150, h: 134 }, r: { x: 194, y: 566, w: 150, h: 134 }, j: { cx: 1168, cy: 626, r: 84 }, f: { cx: 988, cy: 648, r: 66 } };
  function ctrlAt(p) {
    function inR(b) { return p.x >= b.x - 10 && p.x <= b.x + b.w + 10 && p.y >= b.y - 14 && p.y <= b.y + b.h + 10; }
    if (inR(PADS.l)) return 'l';
    if (inR(PADS.r)) return 'r';
    if (S && S.p.power === 2 && G.dist(p.x, p.y, PADS.f.cx, PADS.f.cy) < PADS.f.r + 12) return 'f';
    if (p.x > 640 && p.y > 110) return 'j';      // the whole right half jumps: small hands miss buttons
    return null;
  }
  function drawPads(c) {
    var held = input();
    function arrow(b, d, on) {
      c.fillStyle = on ? 'rgba(255,246,224,.72)' : 'rgba(255,246,224,.38)'; G.roundRect(c, b.x, b.y, b.w, b.h, 30); c.fill();
      c.strokeStyle = 'rgba(43,29,18,.35)'; c.lineWidth = 4; c.stroke();
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      poly(c, [[cx + d * 30, cy], [cx - d * 22, cy - 34], [cx - d * 22, cy + 34]], on ? C.leafDeep : 'rgba(18,61,41,.8)');
    }
    arrow(PADS.l, -1, held.l); arrow(PADS.r, 1, held.r);
    var j = PADS.j;
    c.fillStyle = held.j ? 'rgba(99,199,119,.85)' : 'rgba(99,199,119,.55)'; c.beginPath(); c.arc(j.cx, j.cy, j.r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(18,61,41,.5)'; c.lineWidth = 5; c.stroke();
    poly(c, [[j.cx, j.cy - 36], [j.cx + 32, j.cy + 6], [j.cx + 12, j.cy + 6], [j.cx + 12, j.cy + 30], [j.cx - 12, j.cy + 30], [j.cx - 12, j.cy + 6], [j.cx - 32, j.cy + 6]], C.cream);
    if (S.p.power === 2) {
      var f = PADS.f;
      c.fillStyle = held.f ? 'rgba(255,90,42,.9)' : 'rgba(255,90,42,.6)'; c.beginPath(); c.arc(f.cx, f.cy, f.r, 0, 7); c.fill();
      c.fillStyle = '#ffd75e'; c.beginPath(); c.arc(f.cx, f.cy + 6, 20, 0, 7); c.fill(); poly(c, [[f.cx - 18, f.cy], [f.cx, f.cy - 34], [f.cx + 18, f.cy]], '#ffd75e');
    }
  }
  function drawHud(c) {
    c.fillStyle = 'rgba(23,63,55,.86)'; G.roundRect(c, 16, 10, 1000, 76, 24); c.fill();
    for (var h = 0; h < Math.max(3, S.hearts); h++) A.SHAPES.cuore(c, 58 + h * 50, 48, 20, h < S.hearts ? C.pinkPop : '#637c70');
    A.fruit(c, 340, 48, 20, 'fragola');
    G.text(String(S.got), 372, 49, { size: 34, color: C.cream, align: 'left' });
    G.text(LV.id + ' · ' + LV.name, 740, 49, { size: 30, color: C.cream, maxWidth: 480 });
    if (S.star > 0) A.star(c, 980, 48, 22, C.sun);
    G.ui.button({ id: 'pause', x: 1080, y: 6, w: 180, h: 88, r: 24, color: C.water, label: 'Ⅱ', fontSize: 40, onTap: function () { action('pause'); } });
  }
  function panel(c, title, sub) {
    c.fillStyle = 'rgba(18,61,41,.72)'; c.fillRect(0, 0, W, H);
    c.fillStyle = C.cream; G.roundRect(c, 290, 130, 700, 440, 36); c.fill();
    G.text(title, 640, 208, { size: 54, color: C.leafDeep });
    if (sub) G.text(sub, 640, 272, { size: 28, color: C.ink, maxWidth: 640 });
  }

  function draw(c) {
    drawWorld(c);
    if (S.phase === 'play' || S.phase === 'pause') drawPads(c);
    drawHud(c);
    if (S.phase === 'ready') {
      panel(c, LV.id + ' · ' + LV.name, S.li === 3 ? 'Salva il piccolo dino!' : 'Corri fino alla bandiera!');
      A.dino(c, 470, 440, 110, { t: G.t, pose: 'happy', color: G.account && G.account.color, hat: null });
      G.text('◀ ▶  cammina    ⬆  salta', 700, 350, { size: 28, color: C.ink });
      G.ui.button({ id: 'go', x: 560, y: 420, w: 330, h: 110, r: 28, color: C.leaf, label: 'VIA!', onTap: start });
    } else if (S.phase === 'pause') {
      panel(c, 'Pausa', 'Riparti quando vuoi');
      G.ui.button({ id: 'resume', x: 330, y: 400, w: 300, h: 112, color: C.leaf, label: 'Continua', onTap: function () { action('pause'); } });
      G.ui.button({ id: 'menu', x: 650, y: 400, w: 300, h: 112, color: C.tangerine, label: 'Mappa', onTap: function () { G.go('menu'); } });
    } else if (S.phase === 'over') {
      panel(c, 'Ci riproviamo!', S.checked ? 'Si riparte dalla bandierina' : 'Si riparte dall\'inizio');
      A.dino(c, 640, 380, 100, { t: G.t, pose: 'think', color: G.account && G.account.color, hat: null });
      G.ui.button({ id: 'retry', x: 330, y: 420, w: 300, h: 112, color: C.leaf, label: 'Riprova', onTap: function () { build(S.li, S.checked); start(); } });
      G.ui.button({ id: 'menu2', x: 650, y: 420, w: 300, h: 112, color: C.tangerine, label: 'Mappa', onTap: function () { G.go('menu'); } });
    } else if (S.phase === 'clear') {
      var last = S.li === G.LEVELS.length - 1, saved_ = !!LV.bridge, cm = S.marks.filter(function (m) { return m.type === 'chick'; })[0];
      panel(c, last ? 'Hai finito tutti i mondi!' : saved_ ? 'Hai salvato il piccolo!' : 'Livello finito!', 'Frutti raccolti: ' + S.got);
      A.dino(c, 520, 400, 110, { t: G.t, pose: 'happy', color: G.account && G.account.color, hat: null });
      if (saved_ && cm && A.chick) A.chick(c, 640, 370, 70, { t: G.t, color: CHICK[cm.col] });
      if (!last) G.ui.button({ id: 'next', x: 660, y: 300, w: 300, h: 112, color: C.leaf, label: 'Avanti', onTap: function () { build(S.li + 1); } });
      G.ui.button({ id: 'menu3', x: 660, y: last ? 330 : 430, w: 300, h: 112, color: C.tangerine, label: 'Mappa', onTap: function () { G.go('menu'); } });
    }
  }

  G.scene('gioco', {
    hud: false, back: false,
    enter: function (o) { touches = {}; keys = {}; build(o && o.level || 0); },
    exit: function () { touches = {}; keys = {}; },
    update: function (dt) {
      acc += dt; var n = 0;
      while (acc >= DT && n < 4) { step(input()); acc -= DT; n++; }
      if (n === 4) acc = 0;
    },
    draw: draw,
    onDown: function (p) { if (S.phase !== 'play') return; var k = ctrlAt(p); if (k) touches[p.id] = k; },
    onMove: function (p) { if (touches[p.id] === 'l' || touches[p.id] === 'r') { var k = ctrlAt(p); if (k === 'l' || k === 'r') touches[p.id] = k; } },
    onUp: function (p) { delete touches[p.id]; },
    onCancel: function () { touches = {}; }
  });

  var KEYMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'j', w: 'j', W: 'j', ' ': 'j', x: 'f', X: 'f', f: 'f', F: 'f', Shift: 'f' };
  window.addEventListener('keydown', function (e) {
    if (G.current !== 'gioco') return;
    if (e.key === 'Escape' || e.key === 'p') { action('pause'); return; }
    if (e.key === 'Enter' && S.phase === 'ready') { start(); return; }
    var k = KEYMAP[e.key]; if (k) { e.preventDefault(); keys[k] = true; }
  });
  window.addEventListener('keyup', function (e) { var k = KEYMAP[e.key]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys = {}; touches = {}; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { keys = {}; touches = {}; if (G.current === 'gioco' && S && S.phase === 'play') S.phase = 'pause'; } });

  /* Hooks for the tests: the same rules, driven without a screen. */
  G.mario = {
    build: function (li, fromCheck) { build(li, fromCheck); }, start: start, step: step,
    state: function () { return S; }, level: function () { return LV; },
    snap: function () { return JSON.stringify(S); }, load: function (s) { S = JSON.parse(s); LV = G.LEVELS[S.li]; },
    quiet: function (q) { quiet = q; }, tile: function (x, y) { return tile(x, y); }, action: action,
    drawWorld: function (c) { drawWorld(c); }, draw: function (c) { draw(c); }, background: background, THEME: THEME, T: T
  };
})();
