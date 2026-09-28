/* Accounts: who is playing. Each child gets their own dino, their own save and
   an optional 3-icon "secret" instead of a password — a 3-year-old cannot type
   but can absolutely remember "cuore, stella, luna".
   This is a family lock, not security: it keeps two siblings out of each
   other's progress, nothing more. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  var COLORS = [C.dino, C.blueberry, C.pinkPop, C.tangerine, C.plum, C.water];

  var SECRET_KEYS = [
    { shape: 'cerchio', color: C.berry, name: 'cerchio rosso' },
    { shape: 'quadrato', color: C.blueberry, name: 'quadrato blu' },
    { shape: 'triangolo', color: C.mint, name: 'triangolo verde' },
    { shape: 'cuore', color: C.pinkPop, name: 'cuore rosa' },
    { shape: 'stella', color: C.sun, name: 'stella gialla' },
    { shape: 'fiore', color: C.plum, name: 'fiore viola' },
    { shape: 'luna', color: C.tangerine, name: 'luna arancione' },
    { shape: 'rombo', color: C.water, name: 'rombo azzurro' },
    { shape: 'quadrato', color: C.leafLight, name: 'quadrato verde' }
  ];

  function secretIcon(c, x, y, r, i) {
    var k = SECRET_KEYS[i % SECRET_KEYS.length];
    var f = window.A && A.SHAPES && A.SHAPES[k.shape];
    if (f) { f(c, x, y, r, k.color); return; }
    c.save(); c.fillStyle = k.color; c.strokeStyle = C.ink; c.lineWidth = 4;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke(); c.restore();
  }

  /* `gear` is a look object from G.look (see 01c-art-gear.js). Pass one when
     drawing SOMEBODY ELSE'S dino; pass nothing for the current player and
     A.dino resolves the current save itself.
     Every account gets its OWN buffer — this screen draws up to five dinos in
     a single frame, and a shared one would put the last child's hat on all of
     them. To a three-year-old that is not a glitch, that is a theft. */
  function dinoPreview(c, x, y, s, color, gear, pose) {
    if (window.A && A.dino) {
      var o = { color: color, pose: pose || 'idle', t: G.t, facing: 1 };
      if (gear) o.gear = gear;
      A.dino(c, x, y, s, o);
      return;
    }
    c.save(); c.fillStyle = color || C.dino;
    c.beginPath(); c.ellipse(x, y - s * .3, s * .32, s * .3, 0, 0, 7); c.fill(); c.restore();
  }

  function backdrop(c, title) {
    if (window.A && A.jungle) A.jungle(c, G.t, { dim: .35 });
    else { c.fillStyle = C.leafDeep; c.fillRect(0, 0, W, H); c.fillStyle='#285e4d';c.beginPath();c.ellipse(250,720,700,220,0,0,7);c.fill();c.fillStyle='#36795b';c.beginPath();c.ellipse(1100,780,750,240,0,0,7);c.fill(); }
    c.save();
    c.fillStyle = 'rgba(10,32,20,.34)';
    c.fillRect(0, 0, W, H);
    c.restore();
    if (title) G.text(title, W / 2, 78, { size: 60, color: C.cream, stroke: 'rgba(12,40,25,.75)', strokeWidth: 12 });
    if (window.A && A.canopy) A.canopy(c, G.t);
  }

  /* ------------------------------------------------------- scene: accesso */
  var accountPage = 0;
  var lookCache = {};     // account id -> its OWN look buffer, read once per entry

  G.scene('accesso', {
    hud: false, back: false,
    enter: function () {
      lookCache = {};
      G.accounts.list().forEach(function (a) {
        lookCache[a.id] = {};
      });
      var n = G.accounts.list().length;
      setTimeout(function () {
        if (G.current !== 'accesso') return;
        G.say(n ? 'Chi gioca oggi?' : 'Benvenuto! Facciamo il tuo dinosauro.');
      }, 500);
    },
    draw: function (c) {
      backdrop(c, 'Chi gioca?');
      if (G.accounts.list().length > 4) {
        G.ui.button({id:'profiles-prev',x:250,y:590,w:220,h:96,color:C.water,label:'←',disabled:accountPage===0,onTap:function(){accountPage--;}});
        G.ui.button({id:'profiles-next',x:810,y:590,w:220,h:96,color:C.water,label:'→',disabled:(accountPage+1)*4>G.accounts.list().length,onTap:function(){accountPage++;}});
      }

      var list = G.accounts.list();
      accountPage = Math.min(accountPage, Math.floor(list.length / 4));
      var items = list.slice(accountPage * 4, accountPage * 4 + 4);
      var n = items.length + 1;
      var cw = 214, gap = 24;
      var total = n * cw + (n - 1) * gap;
      var x0 = (W - total) / 2, y = 186, ch = 348;

      items.forEach(function (a, i) {
        var x = x0 + i * (cw + gap);
        var wob = Math.sin(G.t * 1.6 + i) * 4;
        c.save();
        if (window.A && A.panel) A.panel(c, x, y + wob, cw, ch, { r: 28 });
        else { c.fillStyle = C.cream; G.roundRect(c, x, y + wob, cw, ch, 28); c.fill(); }
        c.restore();
        dinoPreview(c, x + cw / 2, y + wob + 236, 176, a.color, lookCache[a.id] || null);
        G.text(a.name, x + cw / 2, y + wob + 282, { size: 34, color: C.ink, maxWidth: cw - 26 });
        // age badge
        c.save();
        c.fillStyle = a.level === 2 ? C.blueberry : C.tangerine;
        G.roundRect(c, x + cw / 2 - 62, y + wob + 300, 124, 34, 17); c.fill();
        G.text(a.level === 2 ? 'Grande' : 'Piccolo', x + cw / 2, y + wob + 318, { size: 22, color: '#fff' });
        c.restore();
        if (a.secret && a.secret.length) {
          c.save(); c.globalAlpha = .85;
          secretIcon(c, x + cw - 30, y + wob + 30, 15, 4);
          c.restore();
        }
        G.ui.button({
          id: 'acct' + a.id, x: x, y: y + wob, w: cw, h: ch, r: 28, ghost: true,
          onTap: function () {
            if (a.secret && a.secret.length) G.go('segreto', { id: a.id });
            else { (G.familyLogin || G.accounts.login)(a.id); G.go('menu'); }
          }
        });
      });

      // new player card
      var xn = x0 + items.length * (cw + gap);
      var wn = Math.sin(G.t * 1.6 + items.length) * 4;
      G.ui.button({
        id: 'nuovo', x: xn, y: y + wn, w: cw, h: ch, r: 28, color: C.leaf,
        icon: function (cc, cx, cy, s) {
          cc.save();
          cc.strokeStyle = '#fff'; cc.lineWidth = 16; cc.lineCap = 'round';
          cc.beginPath();
          cc.moveTo(cx, cy - 96); cc.lineTo(cx, cy - 20);
          cc.moveTo(cx - 38, cy - 58); cc.lineTo(cx + 38, cy - 58);
          cc.stroke(); cc.restore();
        },
        onTap: function () { G.go('nuovo'); }
      });
      G.text('Nuovo', xn + cw / 2, y + wn + ch - 92, { size: 34, color: '#fff', stroke: 'rgba(0,0,0,.25)' });
      G.text('giocatore', xn + cw / 2, y + wn + ch - 54, { size: 30, color: '#fff', stroke: 'rgba(0,0,0,.25)' });

      // discreet parent door
      G.ui.round({
        id: 'gear-login', x: W - 56, y: H - 52, r: 30, color: 'rgba(255,246,224,.55)',
        icon: function (cc, x, yy, r) {
          cc.save(); cc.fillStyle = C.ink;
          for (var i = 0; i < 8; i++) {
            var a = i * Math.PI / 4 + G.t * .4;
            cc.save(); cc.translate(x + Math.cos(a) * r * .5, yy + Math.sin(a) * r * .5); cc.rotate(a);
            cc.fillRect(-3, -5, 10, 10); cc.restore();
          }
          cc.beginPath(); cc.arc(x, yy, r * .32, 0, 7); cc.fill();
          cc.fillStyle = 'rgba(255,246,224,.9)'; cc.beginPath(); cc.arc(x, yy, r * .13, 0, 7); cc.fill();
          cc.restore();
        },
        onTap: function () { G.go('gate', { then: 'genitori', back: 'accesso' }); }
      });
    }
  });

  /* ------------------------------------------------------- scene: segreto */
  var sg = { id: null, taps: [], shake: 0, fails: 0, look: null };

  G.scene('segreto', {
    hud: false, back: false,
    enter: function (p) {
      sg.id = p && p.id; sg.taps = []; sg.shake = 0; sg.fails = 0;
      sg.look = {};
      var a = G.accounts.byId(sg.id);
      setTimeout(function () {
        if (G.current !== 'segreto') return;
        G.say('Ciao ' + (a ? a.name : '') + '! Tocca il tuo segreto.');
      }, 420);
    },
    update: function (dt) { if (sg.shake > 0) sg.shake = Math.max(0, sg.shake - dt * 4); },
    draw: function (c) {
      var a = G.accounts.byId(sg.id);
      if (!a) { G.go('accesso'); return; }
      backdrop(c, null);

      dinoPreview(c, 250, 470, 250, a.color, sg.look, sg.shake > 0 ? 'think' : 'idle');
      G.text('Ciao ' + a.name + '!', 250, 200, { size: 52, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 10 });
      G.text('Tocca il tuo segreto', 250, 258, { size: 30, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 8, weight: 700 });

      // progress slots
      var i;
      for (i = 0; i < 3; i++) {
        var sx = 250 + (i - 1) * 76, sy = 316;
        c.save();
        c.fillStyle = 'rgba(255,246,224,.35)';
        c.beginPath(); c.arc(sx, sy, 28, 0, 7); c.fill();
        c.restore();
        if (sg.taps[i] !== undefined) secretIcon(c, sx, sy, 22, sg.taps[i]);
      }

      // 3x3 pad
      var px = 690, py = 148, cell = 150, gap = 14;
      var jitter = sg.shake > 0 ? Math.sin(G.t * 50) * sg.shake * 10 : 0;
      for (i = 0; i < 9; i++) {
        var gx = px + (i % 3) * (cell + gap) + jitter;
        var gy = py + Math.floor(i / 3) * (cell + gap);
        (function (idx, bx, by) {
          G.ui.button({
            id: 'sk' + idx, x: bx, y: by, w: cell, h: cell, r: 26, color: C.cream,
            icon: function (cc, cx, cy) { secretIcon(cc, cx, cy, cell * .3, idx); },
            onTap: function () {
              sg.taps.push(idx);
              G.sfx('pop');
              if (sg.taps.length === 3) {
                var ok = a.secret && a.secret.length === 3 && a.secret.every(function (v, k) { return v === sg.taps[k]; });
                if (ok) {
                  G.sfx('good');
                  (G.familyLogin || G.accounts.login)(a.id);
                  G.go('menu');
                } else {
                  sg.fails++; sg.shake = 1; sg.taps = [];
                  G.sfx('bad'); G.shake(6);
                  G.say(G.pick(['Ops! Riprova.', 'Non e questo, riprova!', 'Ancora una volta.']));
                }
              }
            }
          });
        })(i, gx, gy);
      }

      G.ui.button({
        x: 40, y: H - 108, w: 250, h: 84, r: 24, color: C.bark, label: 'Indietro',
        onTap: function () { G.go('accesso'); }
      });
      if (sg.fails >= 3) {
        G.ui.button({
          x: 320, y: H - 108, w: 320, h: 84, r: 24, color: C.tangerine, label: 'Chiedi a un grande',
          fontSize: 28,
          onTap: function () { G.go('gate', { then: '@login', arg: a.id, back: 'segreto', backArg: { id: a.id } }); }
        });
      }
    }
  });

  /* --------------------------------------------------------- scene: nuovo */
  var nu = { step: 0, name: '', color: COLORS[0], level: 1, secret: [] };

  G.scene('nuovo', {
    hud: false, back: false,
    enter: function () {
      nu = { step: 0, name: '', color: COLORS[0], level: 1, secret: [] };
      G.prompt('Come ti chiami?', '', function (v) {
        if (v === null || !v) { G.go('accesso'); return; }
        nu.name = v.slice(0, 14);
        nu.step = 1;
        G.say('Ciao ' + nu.name + '! Di che colore e il tuo dino?');
      });
    },
    draw: function (c) {
      backdrop(c, null);
      var titles = ['', 'Scegli il colore', 'Quanti anni hai?', 'Scegli il tuo segreto'];
      G.text(titles[nu.step] || '', W / 2, 74, { size: 52, color: C.cream, stroke: 'rgba(12,40,25,.75)', strokeWidth: 11 });

      if (nu.step === 1) {
        dinoPreview(c, W / 2, 430, 240, nu.color);
        G.text(nu.name, W / 2, 470, { size: 40, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 9 });
        var bw = 128, bg = 18, tot = COLORS.length * bw + (COLORS.length - 1) * bg, x0 = (W - tot) / 2;
        COLORS.forEach(function (col, i) {
          G.ui.button({
            id: 'col' + i, x: x0 + i * (bw + bg), y: 150, w: bw, h: 116, r: 24, color: col,
            icon: function (cc, cx, cy) {
              if (nu.color === col) {
                cc.save(); cc.strokeStyle = '#fff'; cc.lineWidth = 8; cc.lineCap = 'round'; cc.lineJoin = 'round';
                cc.beginPath(); cc.moveTo(cx - 22, cy); cc.lineTo(cx - 6, cy + 18); cc.lineTo(cx + 24, cy - 18); cc.stroke(); cc.restore();
              }
            },
            onTap: function () { nu.color = col; G.sfx('pop'); }
          });
        });
        G.ui.button({ x: W / 2 - 190, y: H - 116, w: 380, h: 92, r: 26, color: C.leaf, label: 'Avanti', onTap: function () { nu.step = 2; G.say('Quanti anni hai?'); } });
      }

      if (nu.step === 2) {
        [{ lv: 1, t: 'Piccolo', s: '3 - 4 anni', col: C.tangerine }, { lv: 2, t: 'Grande', s: '5 - 7 anni', col: C.blueberry }]
          .forEach(function (o, i) {
            var x = W / 2 - 340 + i * 360;
            G.ui.button({
              id: 'lv' + o.lv, x: x, y: 180, w: 320, h: 300, r: 30,
              color: nu.level === o.lv ? o.col : G.shade(o.col, 40),
              label: o.t, sub: o.s, fontSize: 52,
              onTap: function () { nu.level = o.lv; G.sfx('pop'); }
            });
          });
        G.text(nu.level === 1 ? 'Giochi piu semplici, tutto raccontato a voce'
          : 'Somme, sottrazioni e griglie piu grandi',
          W / 2, 528, { size: 28, color: C.cream, weight: 700, stroke: 'rgba(12,40,25,.7)', strokeWidth: 8 });
        G.ui.button({ x: W / 2 - 190, y: H - 116, w: 380, h: 92, r: 26, color: C.leaf, label: 'Avanti', onTap: function () { nu.step = 3; G.say('Scegli tre figure: sara il tuo segreto.'); } });
      }

      if (nu.step === 3) {
        G.text('Tocca 3 figure e ricordale bene', W / 2, 132, { size: 28, color: C.cream, weight: 700, stroke: 'rgba(12,40,25,.7)', strokeWidth: 8 });
        var i;
        for (i = 0; i < 3; i++) {
          var sx = W / 2 + (i - 1) * 90, sy = 196;
          c.save(); c.fillStyle = 'rgba(255,246,224,.32)';
          c.beginPath(); c.arc(sx, sy, 32, 0, 7); c.fill(); c.restore();
          if (nu.secret[i] !== undefined) secretIcon(c, sx, sy, 25, nu.secret[i]);
        }
        var px = W / 2 - 236, py = 254, cell = 140, gap = 16;
        for (i = 0; i < 9; i++) {
          (function (idx) {
            var bx = px + (idx % 3) * (cell + gap), by = py + Math.floor(idx / 3) * (cell + gap);
            G.ui.button({
              id: 'nk' + idx, x: bx, y: by, w: cell, h: cell, r: 24, color: C.cream,
              disabled: nu.secret.length >= 3,
              icon: function (cc, cx, cy) { secretIcon(cc, cx, cy, cell * .29, idx); },
              onTap: function () { nu.secret.push(idx); G.sfx('pop'); }
            });
          })(i);
        }
        G.ui.button({
          x: 40, y: H - 116, w: 260, h: 92, r: 26, color: C.bark, label: 'Rifai', fontSize: 34,
          onTap: function () { nu.secret = []; }
        });
        G.ui.button({
          x: W - 300, y: H - 116, w: 260, h: 92, r: 26, color: C.leafDark, label: 'Senza segreto', fontSize: 24,
          onTap: function () { nu.secret = []; finish(); }
        });
        if (nu.secret.length === 3) {
          G.ui.button({
            x: W / 2 - 170, y: H - 116, w: 340, h: 92, r: 26, color: C.leaf, label: 'Fatto!', onTap: finish
          });
        }
      }
    }
  });

  function finish() {
    var a = G.accounts.create({ name: nu.name, color: nu.color, level: nu.level, secret: nu.secret.length === 3 ? nu.secret : null });
    (G.familyLogin || G.accounts.login)(a.id);
    G.fx.confetti(); G.sfx('win');
    G.go('menu');
    setTimeout(function () { G.say('Buon divertimento, ' + a.name + '!'); }, 900);
  }

  /* ---------------------------------------------------------- scene: gate */
  var gt = { a: 0, b: 0, typed: '', then: null, arg: null, back: 'giungla', backArg: null, shake: 0 };

  G.scene('gate', {
    hud: false, back: false,
    enter: function (p) {
      p = p || {};
      gt.a = G.rndi(6, 9); gt.b = G.rndi(6, 9);
      gt.typed = ''; gt.shake = 0;
      gt.then = !p.then || p.then==='genitori' ? 'family-settings' : p.then; gt.arg = p.arg || null;
      gt.back = p.back || 'giungla'; gt.backArg = p.backArg || null;
    },
    update: function (dt) { if (gt.shake > 0) gt.shake = Math.max(0, gt.shake - dt * 4); },
    draw: function (c) {
      backdrop(c, null);
      c.save(); c.fillStyle = 'rgba(8,26,18,.5)'; c.fillRect(0, 0, W, H); c.restore();

      G.text('Solo per i grandi', W / 2, 96, { size: 50, color: C.cream, stroke: 'rgba(0,0,0,.5)', strokeWidth: 10 });

      var jitter = gt.shake > 0 ? Math.sin(G.t * 48) * gt.shake * 12 : 0;
      c.save();
      if (window.A && A.panel) A.panel(c, 150 + jitter, 176, 460, 300, { r: 28 });
      else { c.fillStyle = C.cream; G.roundRect(c, 150 + jitter, 176, 460, 300, 28); c.fill(); }
      c.restore();
      G.text(gt.a + ' × ' + gt.b + ' = ?', 380 + jitter, 268, { size: 72, color: C.ink });
      c.save();
      c.fillStyle = '#fffdf6'; c.strokeStyle = '#cdb389'; c.lineWidth = 5;
      G.roundRect(c, 220 + jitter, 336, 320, 96, 20); c.fill(); c.stroke();
      c.restore();
      G.text(gt.typed || '–', 380 + jitter, 386, { size: 58, color: C.ink });

      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
      var kx = 700, ky = 168, kw = 150, kh = 116, kg = 14;
      keys.forEach(function (k, i) {
        var x = kx + (i % 3) * (kw + kg), y = ky + Math.floor(i / 3) * (kh + kg);
        G.ui.button({
          id: 'g' + k, x: x, y: y, w: kw, h: kh, r: 22,
          color: k === 'OK' ? C.leaf : k === 'C' ? C.berry : C.cream,
          textColor: (k === 'OK' || k === 'C') ? '#fff' : C.ink,
          outline: (k === 'OK' || k === 'C') ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,0)',
          label: k, fontSize: 44,
          onTap: function () {
            if (k === 'C') { gt.typed = ''; return; }
            if (k === 'OK') {
              if (parseInt(gt.typed, 10) === gt.a * gt.b) {
                G.sfx('good');
                if (gt.then === '@login') { (G.familyLogin || G.accounts.login)(gt.arg); G.go('menu'); }
                else G.go(gt.then, gt.arg);
              } else { gt.shake = 1; gt.typed = ''; G.sfx('bad'); }
              return;
            }
            if (gt.typed.length < 3) gt.typed += k;
          }
        });
      });

      G.ui.button({
        x: 150, y: H - 108, w: 300, h: 84, r: 24, color: C.bark, label: 'Annulla',
        onTap: function () { G.go(gt.back, gt.backArg); }
      });
    }
  });


  G.scene('genitori',{hud:false,enter:function(){G.go('gate',{then:'family-settings'});}});
  G.scene('family-settings', {hud:false,back:false,draw:function(c){
    backdrop(c,'Impostazioni');
    var a=G.account;
    if(a) {
      dinoPreview(c,340,470,230,a.color);
      G.text(a.name,340,510,{size:40,color:C.cream});
      G.ui.button({id:'family-age',x:650,y:190,w:460,h:100,color:C.water,label:G.level===1?'Piccolo · 3–4 anni':'Grande · 5–7 anni',onTap:function(){G.level=G.level===1?2:1;G.accounts.update(a.id,{level:G.level});G.saveNow();}});
      G.ui.button({id:'family-color',x:650,y:315,w:460,h:100,color:C.tangerine,label:'Cambia colore',onTap:function(){G.accounts.update(a.id,{color:COLORS[(COLORS.indexOf(a.color)+1)%COLORS.length]});}});
    }
    G.ui.button({id:'family-switch',x:650,y:440,w:460,h:100,color:C.blueberry,label:'Cambia giocatore',onTap:function(){G.accounts.logout();G.go('accesso');}});
    G.ui.button({id:'family-back',x:650,y:565,w:460,h:100,color:C.leaf,label:'Torna al gioco',onTap:function(){G.go(G.account?'menu':'accesso');}});
  }});
})();
