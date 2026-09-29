/* Dino Mario — the four levels, written with a tiny builder instead of ASCII
   art: coordinates are tiles (48px), row 0 is the top, the ground's top row is
   13, so a dino standing on the ground has its feet at y = 13 * 48.

   Tiles:  '#' ground   'S' stone   'B' brick   '?' fruit block   'M' power block
           'H' heart block   'T' star block   'P' 'p' log pipe (left/right)
           'L' leaf platform (solid)   'K' trunk (decor)   'Z' boss bridge
           '=' plank (solid from above only)
   Entities carry `only: 2` when they exist only for the Grande profile, and
   `alt` when the Piccolo profile gets a gentler enemy in the same place.

   The hard numbers every layout below respects (see test/smoke.js, which
   actually plays every level through with a search bot):
   - a jump climbs at most 4 tiles; no step up is higher than that;
   - no gap is wider than 4 tiles unless a moving platform crosses it. */
(function () {
  'use strict';
  var ROWS = 15;

  function Builder(id, name, theme, w) {
    this.lv = { id: id, name: name, theme: theme, w: w, grid: [], ents: [], start: 8, check: null };
    for (var r = 0; r < ROWS; r++) { var row = []; for (var c = 0; c < w; c++) row.push(' '); this.lv.grid.push(row); }
  }
  var B = Builder.prototype;
  B.set = function (x, y, ch) { if (x >= 0 && x < this.lv.w && y >= 0 && y < ROWS) this.lv.grid[y][x] = ch; return this; };
  B.fill = function (x, y, w, h, ch) { for (var i = 0; i < w; i++) for (var j = 0; j < h; j++) this.set(x + i, y + j, ch); return this; };
  /* ground from x0 to x1 inclusive, top row `top` (default 13) down to the bottom */
  B.ground = function (x0, x1, top) { return this.fill(x0, top || 13, x1 - x0 + 1, ROWS - (top || 13), '#'); };
  B.put = function (x, y, str) { for (var i = 0; i < str.length; i++) if (str[i] !== ' ') this.set(x + i, y, str[i]); return this; };
  /* a hollow log standing on the ground, 2 tiles wide, h tiles tall */
  B.pipe = function (x, h, base) {
    base = base || 13;
    for (var j = 1; j <= h; j++) { this.set(x, base - j, 'P'); this.set(x + 1, base - j, 'p'); }
    return this;
  };
  /* staircase of stone: n columns, heights 1..n going up (dir 1) or n..1 (dir -1) */
  B.stairs = function (x, n, dir, base) {
    base = base || 13;
    for (var i = 0; i < n; i++) { var h = dir > 0 ? i + 1 : n - i; this.fill(x + i, base - h, 1, h, 'S'); }
    return this;
  };
  /* a tree platform: leafy top at row `top`, trunk down to the bottom */
  B.tree = function (x, w, top) {
    this.fill(x, top, w, 1, 'L');
    var mid = x + Math.floor(w / 2) - (w > 3 ? 1 : 0);
    this.fill(mid, top + 1, w > 3 ? 2 : 1, ROWS - top - 1, 'K');
    return this;
  };
  B.e = function (type, x, y, o) {
    var e = { type: type, x: x, y: y === undefined ? 12 : y };
    if (o) for (var k in o) e[k] = o[k];
    this.lv.ents.push(e); return this;
  };
  B.fruits = function (x, y, n, arc) {
    for (var i = 0; i < n; i++) this.e('fruit', x + i, y - (arc ? Math.round(Math.sin(Math.PI * (i + .5) / n) * 2) : 0));
    return this;
  };
  B.plat = function (x, y, w, axis, range, speed) { return this.e('plat', x, y, { w: w, axis: axis, range: range, speed: speed || 1.6 }); };
  B.checkpoint = function (x, y) { this.lv.check = x; return this.e('check', x, y); };
  B.flag = function (x, y) { return this.e('flag', x, y); };

  var L = [];

  /* 1 — Il Prato. The first level teaches everything once, in the classic order. */
  (function () {
    var b = new Builder(1, 'Il Prato', 'prato', 205);
    b.ground(0, 68).ground(71, 86).ground(90, 150).ground(153, 204);
    b.put(16, 9, '?').put(20, 9, 'BMB?B').put(22, 5, '?');
    b.e('beetle', 22);
    b.pipe(28, 2).pipe(38, 3).e('beetle', 42).pipe(46, 4).e('beetle', 51).e('beetle', 53, 12, { only: 2 }).pipe(57, 4);
    b.fruits(61, 9, 4, true).put(66, 9, 'H');
    b.put(77, 9, 'B?B').put(80, 5, 'BBBBBBB').fruits(81, 4, 4);
    b.e('beetle', 82, 4);
    b.put(92, 5, 'BBB?').put(95, 9, 'B');
    b.checkpoint(96);
    b.e('beetle', 99).e('beetle', 101, 12, { only: 2 }).put(101, 9, 'BT');
    b.e('snail', 106);
    b.put(107, 9, '?').put(110, 9, '?').put(110, 5, 'M').put(113, 9, '?');
    b.put(119, 9, 'B').put(122, 5, 'BBB').e('beetle', 124).e('beetle', 126, 12, { only: 2 });
    b.put(129, 5, 'B??B').put(130, 9, 'BB');
    b.stairs(135, 4, 1).stairs(140, 4, -1);
    b.stairs(146, 4, 1).fill(150, 9, 1, 4, 'S').stairs(153, 4, -1);
    b.pipe(162, 2).put(166, 9, 'B?B').e('beetle', 167).e('beetle', 169).pipe(174, 2);
    b.stairs(178, 8, 1).fill(186, 5, 1, 8, 'S');
    b.flag(195);
    L.push(b.lv);
  })();

  /* 2 — La Grotta. Underground: a ceiling, low corridors, and the first
     moving platform over a pit too wide to jump. */
  (function () {
    var b = new Builder(2, 'La Grotta', 'grotta', 195);
    b.ground(0, 44).ground(48, 80).ground(84, 118).ground(127, 194);
    b.fill(8, 2, 150, 1, 'S');
    b.put(11, 9, 'M????');
    b.stairs(19, 3, 1).fill(22, 10, 2, 3, 'S');
    b.fill(27, 8, 14, 1, 'B').put(31, 8, 'H').e('beetle', 30).e('beetle', 34).e('beetle', 38, 12, { only: 2 });
    b.fruits(45, 9, 3, true);
    b.e('snail', 54).fill(60, 11, 1, 2, 'S').fill(64, 10, 1, 3, 'S').fill(68, 9, 1, 4, 'S');
    b.e('beetle', 62).e('beetle', 66, 12, { only: 2 }).fruits(72, 8, 5);
    b.e('bat', 78, 8, { only: 2 });
    b.fruits(81, 9, 3, true);
    b.checkpoint(87);
    b.put(90, 9, 'BBBBB?BBBBB').put(95, 5, 'T').e('beetle', 93).e('beetle', 97).e('snail', 100);
    b.pipe(104, 3).pipe(110, 2).e('beetle', 114);
    b.plat(119, 11, 3, 'x', 5, 1.4).fruits(120, 7, 6);
    b.e('bat', 123, 7, { only: 2 });
    b.e('beetle', 133).e('beetle', 135).put(138, 9, '?M?');
    b.stairs(148, 4, 1).fill(152, 9, 3, 4, 'S');
    b.e('snail', 160).e('beetle', 164, 12, { only: 2 });
    b.stairs(168, 5, 1).fill(173, 8, 1, 5, 'S');
    b.flag(184);
    L.push(b.lv);
  })();

  /* 3 — Sugli Alberi. No floor between the first and the last clearing:
     leafy tops, moving platforms and birds. */
  (function () {
    var b = new Builder(3, 'Sugli Alberi', 'alberi', 210);
    b.ground(0, 14);
    b.tree(17, 5, 10).fruits(18, 8, 3);
    b.tree(25, 4, 8);
    b.tree(32, 6, 10).e('beetle', 35, 9);
    b.tree(41, 3, 7).put(42, 3, 'M');
    b.tree(47, 7, 9).e('snail', 51, 8);
    b.plat(54, 9, 3, 'x', 5, 1.1);
    b.tree(62, 5, 8).fruits(62, 6, 5, true);
    b.tree(70, 4, 10).e('bird', 73, 7);
    b.tree(77, 8, 9).checkpoint(78, 8).e('beetle', 82, 8, { only: 2 });
    b.tree(88, 3, 6).put(89, 2, 'T');
    b.plat(91, 8, 3, 'x', 10, 0.9);
    b.tree(104, 5, 9).put(105, 5, '?H?');
    b.tree(112, 4, 11).e('bird', 116, 8, { only: 2 });
    b.tree(118, 6, 9).e('beetle', 120, 8).e('beetle', 122, 8, { only: 2 });
    b.tree(127, 4, 7).fruits(128, 5, 3);
    b.tree(134, 5, 9).e('bird', 138, 6);
    b.tree(142, 4, 8);
    b.plat(146, 9, 3, 'x', 5, 1.1);
    b.tree(154, 6, 9).e('snail', 157, 8).put(155, 5, '?M?');
    b.tree(163, 4, 10).fruits(163, 8, 4, true);
    b.tree(170, 6, 9).e('bird', 175, 6, { only: 2 });
    b.ground(179, 209);
    b.e('beetle', 186).stairs(189, 4, 1).fill(193, 9, 1, 4, 'S');
    b.flag(200);
    L.push(b.lv);
  })();

  /* 4 — Il Vulcano. Lava pits, spiky hedgehogs (Grande), leaping lava drops,
     and at the end the Big Beetle on a bridge. The lever drops the bridge; the
     reward is not a flag but a lost baby dino to take home. */
  (function () {
    var b = new Builder(4, 'Il Vulcano', 'vulcano', 190);
    b.ground(0, 18).fill(22, 11, 3, 4, 'S').ground(28, 48);
    b.e('drop', 20, 14, { only: 2 }).e('drop', 26, 14, { only: 2 });
    b.put(32, 9, '?M?').e('hedgehog', 38, 12, { alt: 'beetle' }).e('beetle', 44);
    b.fill(52, 12, 9, 3, 'S').fill(53, 8, 6, 1, 'S').e('beetle', 56, 11);
    b.plat(61, 11, 3, 'x', 2, 1.2);
    b.ground(66, 100);
    b.fill(71, 10, 2, 3, 'S').fill(77, 9, 2, 4, 'S').e('snail', 81).put(84, 9, 'H?T');
    b.e('hedgehog', 89, 12, { alt: 'beetle' }).e('beetle', 95);
    b.fill(102, 10, 1, 5, 'S').e('drop', 103, 14, { only: 2 });
    b.ground(105, 142).checkpoint(107);
    b.put(112, 9, 'B?B?B').e('bird', 118, 8).e('beetle', 124).e('beetle', 127).e('hedgehog', 130, 12, { only: 2 });
    b.fill(133, 11, 1, 2, 'S').fill(136, 10, 1, 3, 'S');
    b.stairs(141, 2, 1).ground(144, 158, 11);
    b.fill(159, 11, 16, 1, 'Z');
    b.e('boss', 169, 10);
    b.ground(175, 189, 11);
    b.e('lever', 176, 10).e('chick', 184, 10, { col: 4 });
    b.lv.bridge = { x0: 159, x1: 174, row: 11 };
    L.push(b.lv);
  })();

  /* ------------------------------------------------------------ pieces
     The other sixteen levels are composed from pieces, each one already
     proven: every piece starts and ends on the ground at row 13 unless it is
     a hole (gap, platGap, drops, trees), and two holes never touch. A piece
     takes (builder, x, arg) and returns the x where the next one starts. */
  var K = {
    start: function (b, x) { b.ground(x, x + 13); return x + 14; },
    plain: function (b, x, w) { w = w || 8; b.ground(x, x + w - 1); return x + w; },
    blocks: function (b, x, power) {
      b.ground(x, x + 15); b.put(x + 3, 9, power ? '?M?' : '?B?'); b.put(x + 9, 9, 'B?B?B'); b.put(x + 11, 5, '?'); b.e('beetle', x + 13);
      return x + 16;
    },
    pipes: function (b, x) {
      b.ground(x, x + 19); b.pipe(x + 2, 2); b.e('beetle', x + 6); b.pipe(x + 9, 3); b.e('beetle', x + 12, 12, { only: 2 }); b.pipe(x + 15, 4);
      return x + 20;
    },
    gap: function (b, x, w) { w = w || 3; b.fruits(x, 9, w, true); return x + w; },
    // eight tiles of nothing, and a platform that touches both edges: just step on it
    platGap: function (b, x) { b.plat(x, 11, 3, 'x', 5, 1.1); b.fruits(x + 2, 8, 4); return x + 8; },
    stairs: function (b, x) { b.ground(x, x + 13); b.stairs(x + 1, 4, 1); b.stairs(x + 8, 4, -1); return x + 14; },
    stairsGap: function (b, x) { b.ground(x, x + 5); b.stairs(x + 1, 4, 1); b.fill(x + 5, 9, 1, 4, 'S'); b.ground(x + 8, x + 13); b.stairs(x + 8, 4, -1); return x + 14; },
    enemies: function (b, x, n) {
      var w = 6 + 3 * n; b.ground(x, x + w - 1);
      for (var i = 0; i < n; i++) b.e('beetle', x + 5 + 3 * i, 12, i % 2 ? { only: 2 } : undefined);
      return x + w;
    },
    snails: function (b, x) { b.ground(x, x + 17); b.e('snail', x + 5).e('beetle', x + 10).e('beetle', x + 13).e('beetle', x + 16, 12, { only: 2 }); return x + 18; },
    bricks: function (b, x) { b.ground(x, x + 15); b.put(x + 3, 9, 'BBB?BBB'); b.fruits(x + 3, 8, 7); b.put(x + 5, 5, 'B?B'); b.e('beetle', x + 12); return x + 16; },
    birds: function (b, x) { b.ground(x, x + 17); b.e('bird', x + 8, 8).e('bird', x + 15, 7, { only: 2 }); b.fruits(x + 3, 9, 4, true); return x + 18; },
    hedge: function (b, x) { b.ground(x, x + 13); b.e('hedgehog', x + 6, 12, { alt: 'beetle' }); b.put(x + 9, 9, '?'); return x + 14; },
    pillars: function (b, x) {
      b.ground(x, x + 15); b.fill(x + 3, 11, 1, 2, 'S'); b.fill(x + 7, 10, 1, 3, 'S'); b.fill(x + 11, 9, 1, 4, 'S');
      b.e('beetle', x + 5).e('beetle', x + 9, 12, { only: 2 }); b.fruits(x + 12, 7, 3);
      return x + 16;
    },
    drops: function (b, x) { b.e('drop', x + 1, 14, { only: 2 }); b.fruits(x, 9, 3, true); return x + 3; },
    // tree tops over the void: gaps of three, never more than two rows up
    trees: function (b, x, n) {
      var tops = [11, 10, 9, 10, 11, 10, 9, 10], widths = [5, 4, 5, 4, 5, 4, 5, 4];
      for (var i = 0; i < n; i++) {
        x += 3; b.tree(x, widths[i], tops[i]);
        if (widths[i] === 5 && i % 2 === 0) b.e('beetle', x + 3, tops[i] - 1);
        else b.fruits(x + 1, tops[i] - 2, 2);
        x += widths[i];
      }
      return x + 3;
    },
    spring: function (b, x) {
      b.ground(x, x + 15); b.set(x + 4, 12, 'J'); b.fill(x + 6, 5, 7, 1, '='); b.fruits(x + 7, 4, 5);
      return x + 16;
    },
    check: function (b, x) { b.ground(x, x + 7); b.checkpoint(x + 3); return x + 8; },
    end: function (b, x) { b.ground(x, x + 27); b.stairs(x + 2, 6, 1); b.fill(x + 8, 7, 1, 6, 'S'); b.flag(x + 16); return x + 28; },
    // the castle: the Big Beetle on a bridge, the lever, and a little dino in a cage
    boss: function (b, x, col) {
      b.ground(x, x + 2); b.stairs(x + 1, 2, 1); b.ground(x + 3, x + 17, 11);
      b.fill(x + 18, 11, 16, 1, 'Z'); b.e('boss', x + 28, 10);
      b.ground(x + 34, x + 48, 11); b.e('lever', x + 35, 10).e('chick', x + 43, 10, { col: col });
      b.lv.bridge = { x0: x + 18, x1: x + 33, row: 11 };
      return x + 49;
    }
  };
  function compose(name, theme, list, o) {
    var b = new Builder(0, name, theme, 460), x = 0;
    list.forEach(function (it) { var k = typeof it === 'string' ? it : it[0], arg = typeof it === 'string' ? undefined : it[1]; x = K[k](b, x, arg); });
    b.lv.w = x; b.lv.grid = b.lv.grid.map(function (row) { return row.slice(0, x); });
    if (o && o.ceiling) b.fill(8, 2, x - 38, 1, 'S');
    return b.lv;
  }

  var WORLDS = [
    { name: 'Il Prato', levels: [L[0],
      compose('Collina fiorita', 'prato', ['start', ['blocks', 1], ['enemies', 3], ['gap', 2], 'pipes', 'check', 'snails', ['gap', 3], 'stairs', 'bricks', 'spring', 'end']),
      compose('Ponti sul fiume', 'prato', ['start', 'platGap', 'blocks', ['trees', 3], 'check', 'platGap', ['enemies', 4], ['gap', 3], 'stairsGap', 'end']),
      compose('Il castello del prato', 'prato', ['start', ['blocks', 1], 'pillars', ['enemies', 3], 'check', 'bricks', ['gap', 3], ['boss', 0]])] },
    { name: 'La Grotta', levels: [L[1],
      compose('Cunicoli', 'grotta', ['start', 'bricks', 'pillars', ['enemies', 4], 'check', 'platGap', 'snails', ['blocks', 1], ['gap', 2], 'end'], { ceiling: 1 }),
      compose('Pozzi profondi', 'grotta', ['start', ['gap', 3], 'pillars', 'platGap', 'check', ['gap', 4], ['enemies', 3], 'platGap', 'stairs', 'end'], { ceiling: 1 }),
      compose('Il castello di pietra', 'grotta', ['start', ['blocks', 1], 'pillars', 'snails', 'check', 'platGap', ['enemies', 4], ['boss', 1]], { ceiling: 1 })] },
    { name: 'Gli Alberi', levels: [L[2],
      compose('Rami alti', 'alberi', ['start', ['trees', 4], 'check', ['trees', 5], 'birds', 'end']),
      compose('Liane e uccelli', 'alberi', ['start', ['trees', 3], 'platGap', 'birds', 'check', ['trees', 4], 'platGap', 'end']),
      compose('Il castello sugli alberi', 'alberi', ['start', ['trees', 3], ['blocks', 1], 'check', ['trees', 3], ['boss', 2]])] },
    { name: 'La Spiaggia', levels: [
      compose('La spiaggia', 'spiaggia', ['start', ['blocks', 1], ['enemies', 3], ['gap', 2], 'snails', 'check', 'pipes', 'spring', ['gap', 3], 'end']),
      compose('Scogli', 'spiaggia', ['start', 'pillars', ['gap', 3], 'platGap', 'check', 'drops', ['enemies', 4], 'stairsGap', 'end']),
      compose('Palme sul mare', 'spiaggia', ['start', ['trees', 4], 'platGap', 'check', ['trees', 4], 'birds', 'end']),
      compose('Il faro', 'spiaggia', ['start', ['blocks', 1], 'snails', 'check', ['gap', 3], ['enemies', 3], ['boss', 3]])] },
    { name: 'Il Vulcano', levels: [
      compose('Cenere', 'vulcano', ['start', ['blocks', 1], 'hedge', 'drops', 'check', 'pillars', ['enemies', 3], 'end']),
      compose('Fiumi di lava', 'vulcano', ['start', 'drops', 'platGap', 'check', 'drops', 'pillars', 'platGap', 'end']),
      compose('La montagna di fuoco', 'vulcano', ['start', ['blocks', 1], 'stairsGap', 'hedge', 'check', 'drops', 'snails', 'birds', 'end']),
      L[3]] }
  ];
  var ALL = [];
  WORLDS.forEach(function (w, wi) {
    w.levels.forEach(function (lv, ni) { lv.world = wi + 1; lv.num = ni + 1; lv.id = (wi + 1) + '-' + (ni + 1); ALL.push(lv); });
  });
  L[3].name = 'Il castello di fuoco';

  G.LEVELS = ALL;
  G.WORLDS = WORLDS;

  G.ROWS = ROWS;
})();
