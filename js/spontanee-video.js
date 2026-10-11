/* #spontanee video — background-style clip with NO native controls.
   The markup declares it `autoplay muted loop playsinline`; this script makes
   sure the clip starts as soon as the page is opened (no click needed) and
   keeps looping. It respects `prefers-reduced-motion` (motion-sensitive
   visitors get a still frame) and pauses only while the browser tab is hidden
   to save battery. Script CLASSIQUE : aucun module, aucun fetch — la page doit
   fonctionner telle quelle depuis file:// comme depuis https://.

   Les navigateurs n'autorisent la lecture automatique que sur une vidéo muette :
   la vidéo porte donc l'attribut `muted`. */
(function () {
  'use strict';

  var video = document.querySelector('#spontanee .spontanee-media video');
  if (!video) return;

  video.muted = true;

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) { video.pause(); return; }

  function play() {
    var promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(function () {});
  }

  // Start as soon as the page opens.
  play();

  // Retry once enough data is buffered (some browsers reject before canplay).
  ['loadeddata', 'canplay', 'canplaythrough'].forEach(function (evt) {
    video.addEventListener(evt, function () {
      if (video.paused && !document.hidden) play();
    });
  });

  // Last-resort fallback for strict autoplay policies: first user gesture.
  function onFirstInteraction() {
    if (video.paused) play();
    window.removeEventListener('pointerdown', onFirstInteraction);
    window.removeEventListener('keydown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
  }
  window.addEventListener('pointerdown', onFirstInteraction);
  window.addEventListener('keydown', onFirstInteraction);
  window.addEventListener('touchstart', onFirstInteraction);

  // Pause only while the tab is hidden, resume when it becomes visible again.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) video.pause();
    else play();
  });
})();
