/* The map: four worlds in a row, each one opens when the previous is done.
   A finished world shows a star and the best fruit count; a closed one a
   padlock, never a greyed-out button that does nothing when tapped — it says
   which world to finish first. */
(function () {
  'use strict';
  var C = G.C, W = G.W;
  var CARD = { w: 250, h: 262, y: 206, gap: 20 }, page = -1;

  function saved() { return G.save.mario || (G.save.mario = { open: 0, best: {}, done: {} }); }

  function mini(c, lv, x, y, w, h) {
    var th = G.mario.THEME[lv.theme];
    c.save(); G.roundRect(c, x, y, w, h, 20); c.clip();
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = th.hill; c.beginPath(); c.moveTo(x - 20, y + h); c.quadraticCurveTo(x + w * .35, y + h * .2, x + w * .8, y + h); c.fill();
    c.fillStyle = th.liquid; c.fillRect(x, y + h - 22, w, 22);
    if (lv.theme === 'alberi') {
      [[.08, .62, .3], [.5, .48, .28]].forEach(function (p) { c.fillStyle = '#8a5a32'; c.fillRect(x + w * (p[0] + .12), y + h * p[1], 14, h); c.fillStyle = C.leaf; G.roundRect(c, x + w * p[0], y + h * p[1], w * p[2], 22, 10); c.fill(); });
    } else {
      c.fillStyle = th.dirt; c.fillRect(x, y + h - 34, w * .55, 34); c.fillRect(x + w * .72, y + h - 34, w * .28, 34);
      c.fillStyle = th.grass; c.fillRect(x, y + h - 34, w * .55, 9); c.fillRect(x + w * .72, y + h - 34, w * .28, 9);
    }
    if (lv.theme === 'grotta') { c.fillStyle = '#56607f'; c.fillRect(x, y, w, 16); }
    if (lv.theme === 'spiaggia') { c.fillStyle = th.liquid; c.fillRect(x, y + h - 22, w, 22); c.fillStyle = '#8a5a32'; c.fillRect(x + w * .8, y + h * .35, 8, h * .45); c.fillStyle = C.leaf; c.beginPath(); c.ellipse(x + w * .8 + 4, y + h * .35, 26, 9, 0, 0, 7); c.fill(); }
    if (lv.theme === 'vulcano') { c.fillStyle = '#2a1018'; c.beginPath(); c.moveTo(x + w * .45, y + h - 30); c.lineTo(x + w * .62, y + h * .25); c.lineTo(x + w * .74, y + h * .25); c.lineTo(x + w * .95, y + h - 30); c.fill(); }
    c.fillStyle = '#f7c23c'; G.roundRect(c, x + w * .3, y + h * .3, 30, 30, 6); c.fill();
    G.text('?', x + w * .3 + 15, y + h * .3 + 15, { size: 22, color: '#fff6e0', stroke: '#8a4d10', strokeWidth: 4 });
    c.restore();
  }

  function padlock(c, x, y) {
    c.fillStyle = 'rgba(23,63,55,.62)'; G.roundRect(c, x - 70, y - 60, 140, 120, 24); c.fill();
    c.strokeStyle = C.cream; c.lineWidth = 9; c.beginPath(); c.arc(x, y - 8, 20, Math.PI, 0); c.stroke();
    c.fillStyle = C.cream; G.roundRect(c, x - 30, y - 8, 60, 46, 10); c.fill();
    c.fillStyle = C.leafDeep; c.beginPath(); c.arc(x, y + 12, 7, 0, 7); c.fill();
  }

  G.scene('menu', {
    hud: false, back: false,
    enter: function () { saved(); },
    draw: function (c) {
      var s = saved(), all = G.LEVELS, worlds = G.WORLDS;
      if (page < 0) page = Math.min(worlds.length - 1, all[Math.min(s.open, all.length - 1)].world - 1);
      var levels = worlds[page].levels, base = all.indexOf(levels[0]);
      G.mario.background(c, G.mario.THEME.prato, 'prato', G.t * 30);
      G.text('DINO MARIO', 640, 104, { size: 84, color: C.cream, stroke: C.leafDeep, strokeWidth: 14 });
      G.text('Mondo ' + (page + 1) + ' · ' + worlds[page].name, 640, 178, { size: 34, color: C.cream, stroke: C.leafDeep, strokeWidth: 8 });
      A.dino(c, 150, 170, 120, { t: G.t, pose: 'happy', color: G.account && G.account.color, hat: null });
      var x0 = (W - (levels.length * CARD.w + (levels.length - 1) * CARD.gap)) / 2;
      levels.forEach(function (lv, j) {
        var i = base + j, x = x0 + j * (CARD.w + CARD.gap), y = CARD.y, open = i <= s.open;
        c.fillStyle = '#123d29'; G.roundRect(c, x, y + 8, CARD.w, CARD.h, 26); c.fill();
        c.fillStyle = C.cream; G.roundRect(c, x, y, CARD.w, CARD.h, 26); c.fill();
        mini(c, lv, x + 12, y + 12, CARD.w - 24, 150);
        G.text(lv.id + ' · ' + lv.name, x + CARD.w / 2, y + 194, { size: 23, color: C.leafDeep, maxWidth: CARD.w - 24 });
        if (s.done[i]) {
          A.star(c, x + 44, y + 234, 18, C.sun);
          A.fruit(c, x + CARD.w - 92, y + 234, 15, 'fragola');
          G.text(String(s.best[i] || 0), x + CARD.w - 70, y + 235, { size: 24, color: C.ink, align: 'left' });
        }
        if (!open) padlock(c, x + CARD.w / 2, y + 87);
        G.ui.button({
          id: 'lv' + i, ghost: true, x: x, y: y, w: CARD.w, h: CARD.h, r: 26,
          onTap: function () {
            if (open) G.go('gioco', { level: i });
            else { G.sfx('bad'); G.say('Prima finisci ' + all[i - 1].name); }
          }
        });
      });
      G.ui.button({ id: 'profiles', x: 24, y: 590, w: 300, h: 100, color: C.water, label: 'Cambia dino', onTap: function () { G.accounts.logout(); G.go('accesso'); } });
      [[-1, 50], [1, 1230]].forEach(function (d) {
        var to = page + d[0]; if (to < 0 || to >= worlds.length) return;
        G.ui.round({ id: 'page' + d[0], x: d[1], y: 337, r: 50, color: C.sun, icon: function (cc, x, y) { cc.fillStyle = C.leafDeep; cc.beginPath(); cc.moveTo(x + d[0] * 22, y); cc.lineTo(x - d[0] * 14, y - 22); cc.lineTo(x - d[0] * 14, y + 22); cc.fill(); }, onTap: function () { page = to; G.sfx('whoosh'); } });
      });
      var next = Math.min(s.open, all.length - 1);
      G.ui.button({ id: 'play', x: 440, y: 584, w: 400, h: 110, r: 30, color: C.leaf, label: 'GIOCA!', onTap: function () { G.go('gioco', { level: next }); } });
      G.ui.button({ id: 'parents', x: 976, y: 590, w: 280, h: 100, color: C.bark, label: 'Genitori', onTap: function () { G.go('gate'); } });
    }
  });
})();
