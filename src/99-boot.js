/* Boot: tablet niceties, then "chi guida?".

   Per un pezzo qui veniva creato un profilo in silenzio, perche' il gioco non
   aveva ancora niente da ricordare. Adesso ne ha: giro migliore per pista,
   vittorie, difficolta', colore del kart. Due bambini sullo stesso tablet
   vogliono due elenchi di record, non uno mescolato — quindi si comincia da
   dove si comincia in Dino Giungla, e per la stessa ragione. */
(function () {
  'use strict';

  G.toggleFullscreen = function () {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      }
    } catch (e) { /* desktop browsers may refuse; harmless */ }
  };

  var askedFullscreen = false;
  function firstTouch() {
    G.resumeAudio();
    if (!askedFullscreen) {
      askedFullscreen = true;
      if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) G.toggleFullscreen();
    }
    keepAwake();
  }
  window.addEventListener('pointerdown', firstTouch, { once: false, passive: true });

  var lock = null;
  function keepAwake() {
    if (lock || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l;
      l.addEventListener('release', function () { lock = null; });
    }).catch(function () { lock = null; });
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) keepAwake();
  });

  if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (e) {} }

  /* The engine came from a game whose home is a jungle. Here it is the menu, and
     without this the back button would call G.go on a scene that does not exist. */
  G.home = function () { G.go(G.account ? 'menu' : 'accesso'); };

  /* Si passa SEMPRE dalla schermata dei piloti, anche con un profilo solo:
     e' li' che l'altro fratello si accorge di poterne fare uno suo. */
  G.start('accesso');
})();
