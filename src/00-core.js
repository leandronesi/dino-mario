/* Super Dino — core engine (copied from Dino Run).
   Fixed 1280x720 logical world, letterboxed. Canvas only, no assets, no deps.
   Everything a scene needs hangs off the global `G`. */
(function () {
  'use strict';

  var W = 1280, H = 720;
  var G = (window.G = { W: W, H: H, t: 0, dt: 0, frame: 0 });

  /* ---------------------------------------------------------------- palette */
  G.C = {
    leaf: '#2f8f4e', leafDark: '#1c5c33', leafLight: '#63c777', leafDeep: '#123d29',
    bark: '#7a4a26', barkDark: '#4e2f18',
    sky: '#8fd8e8', skyDeep: '#4bb6d6', sun: '#ffd75e',
    sand: '#f2d9a8', water: '#3fb6c9',
    cream: '#fff6e0', ink: '#2b1d12', shadow: 'rgba(20,10,0,.22)',
    berry: '#e8536b', plum: '#8f5bd6', tangerine: '#ff9f43', mint: '#38d9a9',
    pinkPop: '#ff6fae', blueberry: '#4d80e4',
    dino: '#57c98a', dinoDark: '#379a67', dinoBelly: '#f6e7c1'
  };

  /* ------------------------------------------------------------------ maths */
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.ease = function (t) { t = G.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  G.easeIn = function (t) { t = G.clamp(t, 0, 1); return t * t * t; };
  G.easeInOut = function (t) { t = G.clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  G.easeBack = function (t) { t = G.clamp(t, 0, 1); var c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  G.rnd = function (a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); };
  G.rndi = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  G.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  G.shuffle = function (arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  G.dist = function (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); };

  /* ------------------------------------------------------------- canvas fit */
  var cv = document.getElementById('c');
  var ctx = (G.ctx = cv.getContext('2d', { alpha: false }));
  var view = { s: 1, ox: 0, oy: 0, dpr: 1 };
  G.view = view;
  var rotEl = document.getElementById('rot');

  function resize() {
    var cw = window.innerWidth, ch = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5, 1440 / Math.max(window.innerWidth, window.innerHeight));
    view.dpr = dpr;
    view.s = Math.min(cw / W, ch / H);
    view.ox = (cw - W * view.s) / 2;
    view.oy = (ch - H * view.s) / 2;
    cv.width = Math.max(1, Math.round(cw * dpr));
    cv.height = Math.max(1, Math.round(ch * dpr));
    cv.style.width = cw + 'px';
    cv.style.height = ch + 'px';
    ctx.imageSmoothingEnabled = true;
    if (rotEl) rotEl.classList.toggle('on', ch > cw * 1.08);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
  resize();

  /* -------------------------------------------------------------- draw help */
  var FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  G.font = function (size, weight) { return (weight || 900) + ' ' + size + 'px ' + FONT; };

  G.text = function (str, x, y, o) {
    o = o || {};
    var c = o.ctx || ctx;
    c.save();
    c.font = G.font(o.size || 32, o.weight);
    c.textAlign = o.align || 'center';
    c.textBaseline = o.baseline || 'middle';
    if (o.stroke) {
      c.lineWidth = o.strokeWidth || Math.max(4, (o.size || 32) * .16);
      c.strokeStyle = o.stroke; c.lineJoin = 'round';
      c.strokeText(str, x, y, o.maxWidth);
    }
    c.fillStyle = o.color || G.C.ink;
    c.fillText(str, x, y, o.maxWidth);
    c.restore();
  };

  G.roundRect = function (c, x, y, w, h, r) {
    r = Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  G.shadow = function (c, blur, color, dy) {
    c.shadowBlur = blur; c.shadowColor = color || G.C.shadow;
    c.shadowOffsetX = 0; c.shadowOffsetY = dy === undefined ? blur * .35 : dy;
  };
  G.noShadow = function (c) { c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };

  /* ------------------------------------------------------------------ audio */
  var AC = null, master = null, noiseBuf = null;
  function audio() {
    if (AC) return AC;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    AC = new Ctor();
    master = AC.createGain();
    master.gain.value = .5;
    master.connect(AC.destination);
    var n = AC.createBuffer(1, AC.sampleRate * .5, AC.sampleRate), d = n.getChannelData(0), i;
    for (i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = n;
    return AC;
  }
  G.resumeAudio = function () { var a = audio(); if (a && a.state === 'suspended') a.resume(); };

  function tone(freq, at, dur, type, gain, slideTo) {
    var a = audio(); if (!a) return;
    var t0 = a.currentTime + at;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || .22, t0 + Math.min(.02, dur * .3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(at, dur, gain, freq) {
    var a = audio(); if (!a || !noiseBuf) return;
    var t0 = a.currentTime + at;
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq || 1400; f.Q.value = .8;
    g.gain.setValueAtTime(gain || .18, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur);
  }

  var SFX = {
    tap: function () { tone(680, 0, .07, 'sine', .16, 880); },
    pop: function () { tone(900, 0, .12, 'sine', .2, 420); },
    good: function () { tone(523, 0, .12, 'triangle', .2); tone(659, .09, .12, 'triangle', .2); tone(784, .18, .2, 'triangle', .22); },
    bad: function () { tone(320, 0, .16, 'sine', .16, 240); },
    coin: function () { tone(1180, 0, .07, 'square', .1); tone(1560, .06, .12, 'square', .1); },
    chime: function () { tone(1046, 0, .5, 'sine', .16); tone(1568, .02, .45, 'sine', .07); },
    whoosh: function () { noise(0, .22, .1, 900); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, i * .1, .3, 'triangle', .2); });
      tone(1318, .42, .5, 'sine', .14);
    },
    hatch: function () { noise(0, .1, .12, 2400); tone(600, .08, .2, 'triangle', .18, 1000); }
  };
  G.sfx = function (name) {
    if (G.save && G.save.mute) return;
    var f = SFX[name]; if (f) { audio(); if (AC) f(); }
  };

  /* ----------------------------------------------------------------- speech */
  var voice = null, voiceTried = false;
  function findVoice() {
    if (!window.speechSynthesis) return null;
    var vs = speechSynthesis.getVoices() || [];
    if (!vs.length) return null;
    return vs.filter(function (v) { return /^it/i.test(v.lang); })[0] || null;
  }
  if (window.speechSynthesis) {
    speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', function () { voice = findVoice(); });
  }
  G.say = function (str, o) {
    if (!window.speechSynthesis || !str) return;
    if (G.save && G.save.mute) return;
    o = o || {};
    if (!voiceTried) { voice = findVoice(); voiceTried = true; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(str));
      u.lang = 'it-IT';
      if (voice) u.voice = voice;
      u.rate = o.rate || .95;
      u.pitch = o.pitch || 1.15;
      u.volume = o.volume === undefined ? 1 : o.volume;
      speechSynthesis.speak(u);
    } catch (e) { /* speech is a bonus, never a blocker */ }
  };
  G.hush = function () { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} };

  /* ---------------------------------------------------------------- storage */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  G.LS = LS;

  var K_ACCTS = 'dm.accounts', K_LAST = 'dm.last', K_SAVE = 'dm.save.';

  function blankSave() {
    return {
      fruits: 0, stars: 0, mute: false, hat: null, hats: [],
      conta: {}, fili: {}, nido: {}, seen: {}, playSec: 0, updated: 0
    };
  }
  function fillSave(s) {
    var b = blankSave(), k;
    for (k in b) if (s[k] === undefined || s[k] === null) s[k] = b[k];
    return s;
  }

  G.account = null;
  G.profile = null;
  G.level = 1;
  G.save = blankSave();

  var saveTimer = 0, saveDirty = false;
  function writeSave() {
    if (!G.account) return;
    G.save.updated = Date.now();
    LS.set(K_SAVE + G.account.id, G.save);
    saveDirty = false;
    if (G.cloud && G.cloud.push) G.cloud.push();
  }
  G.saveNow = function () { saveDirty = true; };
  G.saveFlush = writeSave;

  G.accounts = {
    list: function () { return LS.get(K_ACCTS, []); },
    byId: function (id) { return G.accounts.list().filter(function (a) { return a.id === id; })[0] || null; },
    create: function (o) {
      var list = G.accounts.list();
      var acct = {
        id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        name: (o.name || 'Dino').slice(0, 14),
        color: o.color || G.C.dino,
        level: o.level === 2 ? 2 : 1,
        secret: o.secret && o.secret.length ? o.secret : null,
        created: Date.now()
      };
      list.push(acct);
      LS.set(K_ACCTS, list);
      LS.set(K_SAVE + acct.id, blankSave());
      return acct;
    },
    update: function (id, patch) {
      var list = G.accounts.list(), i;
      for (i = 0; i < list.length; i++) if (list[i].id === id) {
        for (var k in patch) list[i][k] = patch[k];
        LS.set(K_ACCTS, list);
        if (G.account && G.account.id === id) G.account = list[i];
        return list[i];
      }
      return null;
    },
    remove: function (id) {
      LS.set(K_ACCTS, G.accounts.list().filter(function (a) { return a.id !== id; }));
      LS.del(K_SAVE + id);
      if (LS.get(K_LAST, null) === id) LS.del(K_LAST);
    },
    login: function (id) {
      var a = G.accounts.byId(id);
      if (!a) return false;
      if (G.account) writeSave();
      G.account = a;
      G.profile = a.id;
      G.level = a.level;
      G.save = fillSave(LS.get(K_SAVE + id, blankSave()));
      LS.set(K_LAST, id);
      if (G.cloud && G.cloud.pull) G.cloud.pull();
      return true;
    },
    logout: function () {
      writeSave();
      G.hush();
      G.account = null; G.profile = null; G.save = blankSave();
      LS.del(K_LAST);
    },
    last: function () { return LS.get(K_LAST, null); }
  };

  /* ------------------------------------------------------------------ input */
  var pointer = { x: 0, y: 0, down: false, id: null };
  G.pointer = pointer;

  function toLogical(clientX, clientY) {
    var r = cv.getBoundingClientRect();
    return {
      x: (clientX - r.left - view.ox) / view.s,
      y: (clientY - r.top - view.oy) / view.s
    };
  }

  /* --------------------------------------------------- immediate-mode UI */
  var uiRects = [];       // registered this frame
  var uiHot = [];         // registered last frame (what the pointer tests against)
  var pressedKey = null;
  var ui = (G.ui = {});

  function rectKey(o) { return o.id || (o.label || '') + '|' + Math.round(o.x) + ',' + Math.round(o.y) + ',' + Math.round(o.w) + ',' + Math.round(o.h); }

  function shade(hex, amt) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    var f = function (h) { return G.clamp(Math.round(parseInt(h, 16) + amt), 0, 255); };
    var to = function (v) { return ('0' + v.toString(16)).slice(-2); };
    return '#' + to(f(m[1])) + to(f(m[2])) + to(f(m[3]));
  }
  G.shade = shade;

  ui.button = function (o) {
    var c = o.ctx || ctx;
    var key = rectKey(o);
    var down = pressedKey === key && !o.disabled;
    var r = o.r === undefined ? Math.min(26, o.h * .32) : o.r;
    var col = o.disabled ? '#b9ada0' : (o.color || G.C.leaf);
    var dy = down ? 5 : 0;

    c.save();
    c.globalAlpha = o.disabled ? .72 : 1;
    if (o.ghost) {
      // Invisible hit area over artwork drawn by the scene (e.g. a player card).
      if (down) {
        c.fillStyle = 'rgba(20,10,0,.14)';
        G.roundRect(c, o.x, o.y, o.w, o.h, r); c.fill();
      }
    } else {
      // base (the "3d" underside)
      c.fillStyle = shade(col, -48);
      G.roundRect(c, o.x, o.y + 7, o.w, o.h, r); c.fill();
      // face
      var g = c.createLinearGradient(0, o.y + dy, 0, o.y + o.h + dy);
      g.addColorStop(0, shade(col, 26)); g.addColorStop(1, col);
      c.fillStyle = g;
      G.roundRect(c, o.x, o.y + dy, o.w, o.h, r); c.fill();
      // gloss
      c.fillStyle = 'rgba(255,255,255,.20)';
      G.roundRect(c, o.x + o.w * .06, o.y + dy + o.h * .10, o.w * .88, o.h * .30, r * .7); c.fill();
    }

    var cx = o.x + o.w / 2, cy = o.y + dy + o.h / 2;
    if (o.icon) {
      var isz = o.iconSize || Math.min(o.w, o.h) * .52;
      o.icon(c, o.label ? o.x + o.h * .58 : cx, cy, isz);
    }
    if (o.label) {
      var tx = o.icon ? cx + o.h * .26 : cx;
      G.text(o.label, tx, o.sub ? cy - o.h * .12 : cy, {
        ctx: c, size: o.fontSize || Math.min(o.h * .40, 46),
        color: o.textColor || '#fff', stroke: o.outline || 'rgba(0,0,0,.22)',
        maxWidth: o.w - (o.icon ? o.h * .9 : o.w * .12)
      });
      if (o.sub) G.text(o.sub, tx, cy + o.h * .24, { ctx: c, size: o.h * .21, color: 'rgba(255,255,255,.9)', weight: 700 });
    }
    c.restore();

    if (!o.disabled) uiRects.push({ key: key, x: o.x, y: o.y, w: o.w, h: o.h, onTap: o.onTap, silent: o.silent, round: false });
    return down;
  };

  ui.round = function (o) {
    var c = o.ctx || ctx;
    var key = o.id || 'r' + Math.round(o.x) + ',' + Math.round(o.y);
    var down = pressedKey === key && !o.disabled;
    var col = o.disabled ? '#b9ada0' : (o.color || G.C.cream);
    var dy = down ? 4 : 0;
    c.save();
    c.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    c.fillStyle = shade(col, -50);
    c.beginPath(); c.arc(o.x, o.y + 6, o.r, 0, 7); c.fill();
    c.fillStyle = col;
    c.beginPath(); c.arc(o.x, o.y + dy, o.r, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.beginPath(); c.arc(o.x, o.y + dy - o.r * .22, o.r * .74, Math.PI, 0); c.fill();
    if (o.icon) o.icon(c, o.x, o.y + dy, o.r * 1.05);
    c.restore();
    if (!o.disabled) uiRects.push({ key: key, x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2, onTap: o.onTap, silent: o.silent, round: true, cx: o.x, cy: o.y, cr: o.r });
    return down;
  };

  function hitTest(p) {
    var i, r;
    for (i = uiHot.length - 1; i >= 0; i--) {
      r = uiHot[i];
      if (r.round) { if (G.dist(p.x, p.y, r.cx, r.cy) <= r.cr + 12) return r; }
      else if (p.x >= r.x - 6 && p.x <= r.x + r.w + 6 && p.y >= r.y - 6 && p.y <= r.y + r.h + 6) return r;
    }
    return null;
  }

  /* ----------------------------------------------------------------- scenes */
  var scenes = {};
  var cur = null, curName = '';
  var fade = { a: 0, dir: 0, next: null, params: null };
  G.current = '';

  G.scene = function (name, obj) { scenes[name] = obj; obj._name = name; return obj; };
  G.go = function (name, params) {
    if (!scenes[name]) { console.warn('scena assente:', name); return; }
    if (fade.dir === 1) return;                 // a transition is already under way
    fade.dir = 1; fade.next = name; fade.params = params || null;
    G.hush();
  };
  G.home = function () { G.go('giungla'); };
  G.sceneOf = function (n) { return scenes[n]; };

  function swap() {
    if (cur && cur.exit) { try { cur.exit(); } catch (e) { console.error(e); } }
    writeSave();
    cur = scenes[fade.next];
    curName = fade.next; G.current = curName;
    uiRects = []; uiHot = []; pressedKey = null;
    if (cur && cur.enter) { try { cur.enter(fade.params); } catch (e) { console.error(e); } }
  }

  /* --------------------------------------------------------------- effects */
  var parts = [], floats = [], rings = [], flyers = [];
  var shakeAmt = 0;
  G.shake = function (a) { shakeAmt = Math.min(10, Math.max(shakeAmt, a || 4)); };

  var fx = (G.fx = {});
  fx.burst = function (x, y, o) {
    o = o || {};
    var n = o.count || 14, i, a, sp;
    for (i = 0; i < n; i++) {
      a = o.angle === undefined ? G.rnd(0, Math.PI * 2) : o.angle + G.rnd(-.7, .7);
      sp = (o.speed || 260) * G.rnd(.45, 1.2);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
        life: o.life || G.rnd(.5, .95), age: 0, size: (o.size || 12) * G.rnd(.6, 1.25),
        color: o.color || G.C.sun, grav: o.gravity === undefined ? 620 : o.gravity,
        shape: o.shape || 'circle', spin: G.rnd(-8, 8), rot: G.rnd(0, 6.3)
      });
    }
  };
  fx.confetti = function () {
    var cols = [G.C.berry, G.C.sun, G.C.mint, G.C.pinkPop, G.C.blueberry, G.C.tangerine], i;
    for (i = 0; i < 90; i++) {
      parts.push({
        x: G.rnd(0, W), y: G.rnd(-160, -10), vx: G.rnd(-70, 70), vy: G.rnd(120, 330),
        life: G.rnd(1.6, 2.8), age: 0, size: G.rnd(9, 18), color: cols[i % cols.length],
        grav: 90, shape: 'rect', spin: G.rnd(-9, 9), rot: G.rnd(0, 6.3)
      });
    }
  };
  fx.text = function (x, y, str, color, size) {
    floats.push({ x: x, y: y, str: String(str), color: color || G.C.cream, size: size || 42, age: 0, life: 1.1 });
  };
  fx.ring = function (x, y, color, max) {
    rings.push({ x: x, y: y, color: color || '#fff', age: 0, life: .55, max: max || 130 });
  };

  var HUD_FRUIT = { x: 48, y: 46 }, HUD_STAR = { x: 212, y: 46 };
  function flyTo(n, x, y, target, kind) {
    var i, count = G.clamp(n, 1, 10);
    var per = Math.floor(n / count), rest = n - per * count;
    for (i = 0; i < count; i++) {
      flyers.push({
        x: x === undefined ? W / 2 : x + G.rnd(-24, 24),
        y: y === undefined ? H / 2 : y + G.rnd(-24, 24),
        tx: target.x, ty: target.y, age: 0, delay: i * .055,
        life: .62, val: per + (i < rest ? 1 : 0), kind: kind
      });
    }
  }
  G.addFruits = function (n, x, y) {
    n = Math.round(n); if (n <= 0) return;
    flyTo(n, x, y, HUD_FRUIT, 'fruit'); G.sfx('coin');
  };
  G.addStars = function (n, x, y) {
    n = Math.round(n); if (n <= 0) return;
    flyTo(n, x, y, HUD_STAR, 'star'); G.sfx('chime');
  };
  G.spend = function (n) {
    if (G.save.fruits < n) return false;
    G.save.fruits -= n; G.saveNow(); G.sfx('pop'); return true;
  };

  function stepFx(dt) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
    }
    for (i = floats.length - 1; i >= 0; i--) {
      p = floats[i]; p.age += dt; p.y -= 62 * dt;
      if (p.age >= p.life) floats.splice(i, 1);
    }
    for (i = rings.length - 1; i >= 0; i--) {
      p = rings[i]; p.age += dt; if (p.age >= p.life) rings.splice(i, 1);
    }
    for (i = flyers.length - 1; i >= 0; i--) {
      p = flyers[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life) {
        if (p.kind === 'star') G.save.stars += p.val; else G.save.fruits += p.val;
        G.saveNow();
        fx.ring(p.tx, p.ty, p.kind === 'star' ? G.C.sun : G.C.berry, 60);
        flyers.splice(i, 1);
      }
    }
    if (shakeAmt > 0) shakeAmt = Math.max(0, shakeAmt - dt * 22);
  }

  function drawParts(c) {
    var i, p, k;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      k = 1 - p.age / p.life;
      c.save();
      c.globalAlpha = G.clamp(k * 1.6, 0, 1);
      c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillStyle = p.color;
      if (p.shape === 'rect') c.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66);
      else if (p.shape === 'star') { starPath(c, 0, 0, p.size); c.fill(); }
      else { c.beginPath(); c.arc(0, 0, p.size / 2, 0, 7); c.fill(); }
      c.restore();
    }
    for (i = 0; i < rings.length; i++) {
      p = rings[i]; k = p.age / p.life;
      c.save();
      c.globalAlpha = (1 - k) * .8;
      c.strokeStyle = p.color; c.lineWidth = 8 * (1 - k) + 2;
      c.beginPath(); c.arc(p.x, p.y, G.ease(k) * p.max, 0, 7); c.stroke();
      c.restore();
    }
    for (i = 0; i < floats.length; i++) {
      p = floats[i]; k = p.age / p.life;
      c.save();
      c.globalAlpha = 1 - k * k;
      G.text(p.str, p.x, p.y, { ctx: c, size: p.size, color: p.color, stroke: 'rgba(40,20,0,.5)' });
      c.restore();
    }
  }
  function drawFlyers(c) {
    var i, p, k, x, y;
    for (i = 0; i < flyers.length; i++) {
      p = flyers[i];
      if (p.delay > 0) continue;
      k = G.ease(p.age / p.life);
      x = G.lerp(p.x, p.tx, k);
      y = G.lerp(p.y, p.ty, k) - Math.sin(k * Math.PI) * 90;
      if (p.kind === 'star') starIcon(c, x, y, 22);
      else if (window.A && A.fruit) A.fruit(c, x, y, 20, 'fragola');
      else { c.fillStyle = G.C.berry; c.beginPath(); c.arc(x, y, 16, 0, 7); c.fill(); }
    }
  }

  function starPath(c, x, y, r) {
    var i, a, rr;
    c.beginPath();
    for (i = 0; i < 10; i++) {
      a = -Math.PI / 2 + i * Math.PI / 5;
      rr = i % 2 ? r * .46 : r;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }
  G.starPath = starPath;
  function starIcon(c, x, y, r) {
    c.save();
    c.fillStyle = G.C.sun; c.strokeStyle = '#c8901c'; c.lineWidth = Math.max(2, r * .12);
    starPath(c, x, y, r); c.fill(); c.stroke();
    c.restore();
  }
  G.starIcon = starIcon;

  /* -------------------------------------------------------------------- HUD */
  var gearHold = 0;
  function drawHUD(c) {
    if (!cur || cur.hud === false || !G.account) return;
    var pill = function (x, w, drawIcon, value, col) {
      c.save();
      G.shadow(c, 12, 'rgba(0,0,0,.28)', 4);
      c.fillStyle = 'rgba(255,246,224,.94)';
      G.roundRect(c, x, 16, w, 60, 30); c.fill();
      G.noShadow(c);
      c.restore();
      drawIcon(c, x + 32, 46, 24);
      // maxWidth or the fruit counter runs out of its own pill at five digits
      // and lands on the star pill, which starts at x = 180.
      G.text(String(value), x + 62, 47, {
        ctx: c, size: 34, color: col, align: 'left', maxWidth: w - 74
      });
    };
    pill(16, 150, function (cc, x, y, r) {
      if (window.A && A.fruit) A.fruit(cc, x, y, r, 'fragola');
      else { cc.fillStyle = G.C.berry; cc.beginPath(); cc.arc(x, y, r, 0, 7); cc.fill(); }
    }, Math.floor(G.save.fruits), G.C.ink);
    pill(180, 132, function (cc, x, y, r) { starIcon(cc, x, y, r); }, Math.floor(G.save.stars), G.C.ink);

    // right cluster
    if (cur.back !== false && curName !== 'giungla') {
      ui.round({
        x: W - 60, y: 48, r: 40, color: G.C.tangerine, id: 'hud-home',
        icon: function (cc, x, y, r) {
          cc.save(); cc.strokeStyle = '#5b2c00'; cc.fillStyle = '#fff6e0';
          cc.lineWidth = 5; cc.lineJoin = 'round';
          cc.beginPath();
          cc.moveTo(x - r * .42, y + r * .04); cc.lineTo(x, y - r * .40); cc.lineTo(x + r * .42, y + r * .04);
          cc.lineTo(x + r * .30, y + r * .04); cc.lineTo(x + r * .30, y + r * .38);
          cc.lineTo(x - r * .30, y + r * .38); cc.lineTo(x - r * .30, y + r * .04);
          cc.closePath(); cc.fill(); cc.stroke(); cc.restore();
        },
        onTap: function () { G.home(); }
      });
    }
    var mx = (cur.back !== false && curName !== 'giungla') ? W - 152 : W - 60;
    ui.round({
      x: mx, y: 48, r: 34, color: G.save.mute ? '#b9ada0' : G.C.cream, id: 'hud-mute',
      icon: function (cc, x, y, r) {
        cc.save(); cc.fillStyle = G.C.ink;
        cc.beginPath();
        cc.moveTo(x - r * .34, y - r * .14); cc.lineTo(x - r * .12, y - r * .14);
        cc.lineTo(x + r * .10, y - r * .38); cc.lineTo(x + r * .10, y + r * .38);
        cc.lineTo(x - r * .12, y + r * .14); cc.lineTo(x - r * .34, y + r * .14);
        cc.closePath(); cc.fill();
        cc.strokeStyle = G.C.ink; cc.lineWidth = r * .12; cc.lineCap = 'round';
        if (G.save.mute) {
          cc.beginPath(); cc.moveTo(x + r * .22, y - r * .20); cc.lineTo(x + r * .48, y + r * .20);
          cc.moveTo(x + r * .48, y - r * .20); cc.lineTo(x + r * .22, y + r * .20); cc.stroke();
        } else {
          cc.beginPath(); cc.arc(x + r * .16, y, r * .26, -.9, .9); cc.stroke();
          cc.beginPath(); cc.arc(x + r * .16, y, r * .46, -.9, .9); cc.stroke();
        }
        cc.restore();
      },
      onTap: function () {
        G.save.mute = !G.save.mute; G.saveNow();
        if (G.save.mute) G.hush(); else G.sfx('pop');
      }
    });
    // parent gear — long press only, so kids cannot wander into settings
    var gx = mx - 84, gy = 48, gr = 26;
    c.save();
    c.globalAlpha = .55 + gearHold * .45;
    c.fillStyle = G.C.cream;
    c.beginPath(); c.arc(gx, gy, gr + gearHold * 6, 0, 7); c.fill();
    c.fillStyle = G.C.ink;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + G.t * .5;
      c.save(); c.translate(gx + Math.cos(a) * gr * .62, gy + Math.sin(a) * gr * .62); c.rotate(a);
      c.fillRect(-3, -5.5, 11, 11); c.restore();
    }
    c.beginPath(); c.arc(gx, gy, gr * .40, 0, 7); c.fill();
    c.fillStyle = G.C.cream; c.beginPath(); c.arc(gx, gy, gr * .17, 0, 7); c.fill();
    if (gearHold > 0) {
      c.strokeStyle = G.C.berry; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.arc(gx, gy, gr + 9, -Math.PI / 2, -Math.PI / 2 + gearHold * 6.283); c.stroke();
    }
    c.restore();
    uiRects.push({ key: 'hud-gear', x: gx - gr - 8, y: gy - gr - 8, w: (gr + 8) * 2, h: (gr + 8) * 2, hold: true, round: true, cx: gx, cy: gy, cr: gr + 10 });
  }

  /* ---------------------------------------------------------------- overlay */
  var ovl = document.getElementById('ovl');
  var ovlT = document.getElementById('ovl-t'), ovlI = document.getElementById('ovl-i');
  var ovlCb = null;
  function closeOvl(val) {
    ovl.classList.remove('on');
    ovlI.blur();
    var cb = ovlCb; ovlCb = null;
    if (cb) cb(val);
  }
  document.getElementById('ovl-y').addEventListener('click', function () { closeOvl(ovlI.value.trim()); });
  document.getElementById('ovl-n').addEventListener('click', function () { closeOvl(null); });
  ovlI.addEventListener('keydown', function (e) { if (e.key === 'Enter') closeOvl(ovlI.value.trim()); });
  G.prompt = function (title, initial, cb) {
    ovlT.textContent = title;
    ovlI.value = initial || '';
    ovlCb = cb;
    ovl.classList.add('on');
    setTimeout(function () { ovlI.focus(); ovlI.select(); }, 60);
  };
  G.overlayOpen = function () { return ovl.classList.contains('on'); };

  /* ------------------------------------------------------------ event wiring */
  function onDown(e) {
    if (G.overlayOpen()) return;
    G.resumeAudio();
    var p = toLogical(e.clientX, e.clientY);
    p.id = e.pointerId;
    pointer.x = p.x; pointer.y = p.y; pointer.down = true; pointer.id = e.pointerId;
    if (fade.dir !== 0) return;
    var hit = hitTest(p);
    if (hit) {
      if (hit.hold) { gearHold = 0.001; pressedKey = null; return; }
      pressedKey = hit.key;
      return;
    }
    pressedKey = null;
    if (cur && cur.onDown) cur.onDown(p);
  }
  function onMove(e) {
    if (G.overlayOpen()) return;
    var p = toLogical(e.clientX, e.clientY);
    p.id = e.pointerId;
    pointer.x = p.x; pointer.y = p.y;
    if (!pointer.down) return;
    if (gearHold > 0) {
      var g = hitTest(p);
      if (!g || !g.hold) gearHold = 0;
      return;
    }
    if (pressedKey) {
      var h = hitTest(p);
      if (!h || h.key !== pressedKey) pressedKey = null;
      return;
    }
    if (cur && cur.onMove) cur.onMove(p);
  }
  function onUp(e) {
    if (G.overlayOpen()) return;
    var p = toLogical(e.clientX, e.clientY);
    p.id = e.pointerId;
    pointer.x = p.x; pointer.y = p.y; pointer.down = false;
    gearHold = 0;
    if (pressedKey) {
      var hit = hitTest(p);
      if (hit && hit.key === pressedKey && hit.onTap) {
        if (!hit.silent) G.sfx('tap');
        var f = hit.onTap; pressedKey = null;
        f();
        return;
      }
      pressedKey = null;
      return;
    }
    if (cur && cur.onUp) cur.onUp(p);
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); onDown(e); });
  cv.addEventListener('pointermove', function (e) { e.preventDefault(); onMove(e); });
  cv.addEventListener('pointerup', function (e) { e.preventDefault(); onUp(e); });
  cv.addEventListener('pointercancel', function (e) { pointer.down = false; pressedKey = null; gearHold = 0; if(cur&&cur.onCancel)cur.onCancel();else if (cur && cur.onUp) cur.onUp({ x: pointer.x, y: pointer.y, id: e.pointerId }); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('blur', function () { pointer.down = false; pressedKey = null; gearHold = 0; });

  /* ------------------------------------------------------------------- loop */
  var last = 0, running = true;
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (!running) { writeSave(); G.hush(); }
    else { last = 0; G.resumeAudio(); }
  });
  window.addEventListener('pagehide', writeSave);
  window.addEventListener('beforeunload', writeSave);

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!running) return;
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, .05);
    last = ts;
    G.dt = dt; G.t += dt; G.frame++;

    if (G.account) G.save.playSec += dt;

    // gear long-press
    if (gearHold > 0 && pointer.down) {
      gearHold = Math.min(1, gearHold + dt / 1.4);
      if (gearHold >= 1) {
        gearHold = 0; pointer.down = false; G.sfx('chime');
        G.go('gate', { then: 'genitori', back: curName });
      }
    }

    // autosave
    if (saveDirty) { saveTimer += dt; if (saveTimer > .8) { saveTimer = 0; writeSave(); } }

    // fade / scene swap
    if (fade.dir === 1) {
      fade.a += dt / .20;
      if (fade.a >= 1) {
        fade.a = 1;
        // Clear the flag *before* swapping so a scene's enter() is allowed to
        // redirect straight to another scene; if it did, honour that instead.
        fade.dir = 0;
        swap();
        if (fade.dir !== 1) fade.dir = -1;
      }
    } else if (fade.dir === -1) {
      fade.a -= dt / .22;
      if (fade.a <= 0) { fade.a = 0; fade.dir = 0; }
    }

    if (cur && cur.update && fade.dir !== 1) { try { cur.update(dt); } catch (e) { console.error(e); } }
    stepFx(dt);

    // ---- render
    uiHot = uiRects; uiRects = [];
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#0b2418';
    ctx.fillRect(0, 0, cv.width / view.dpr, cv.height / view.dpr);
    ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
    ctx.save();
    // Clip first, shake second: otherwise the shake drags the letterbox in.
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    if (shakeAmt > 0) ctx.translate(G.rnd(-shakeAmt, shakeAmt), G.rnd(-shakeAmt, shakeAmt));

    if (cur && cur.draw) { try { cur.draw(ctx); } catch (e) { console.error(e); } }
    drawParts(ctx);
    drawHUD(ctx);
    drawFlyers(ctx);

    ctx.restore();
    if (fade.a > 0) {
      ctx.fillStyle = 'rgba(9,32,21,' + fade.a.toFixed(3) + ')';
      ctx.fillRect(-200, -200, W + 400, H + 400);
    }
  }
  requestAnimationFrame(frame);

  /* --------------------------------------------------------------- boot API */
  G.start = function (name, params) {
    cur = scenes[name]; curName = name; G.current = name;
    if (cur && cur.enter) cur.enter(params || null);
    fade.a = 1; fade.dir = -1;
  };
})();
