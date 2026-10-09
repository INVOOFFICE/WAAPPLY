/* #spontanee video — background-style clip with NO native controls.
   The markup declares it `autoplay muted loop playsinline`; this script only
   pauses it while off-screen (to save battery/CPU) and resumes it when the
   section scrolls back into view. Script CLASSIQUE : aucun module, aucun fetch
   — la page doit fonctionner telle quelle depuis file:// comme depuis https://.

   Les navigateurs n'autorisent la lecture automatique que sur une vidéo muette :
   la vidéo porte donc l'attribut `muted`. `prefers-reduced-motion` est respecté :
   les personnes sensibles au mouvement voient une image fixe au lieu de la
   boucle animée (les contrôles ayant été retirés, c'est volontaire). */
(function () {
  'use strict';

  var video = document.querySelector('#spontanee .spontanee-media video');
  if (!video) return;

  video.muted = true;

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) { video.pause(); return; }

  if (!('IntersectionObserver' in window)) return;

  function play() {
    var promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(function () {});
  }

  var observer = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i += 1) {
      if (entries[i].isIntersecting) play();
      else video.pause();
    }
  }, { threshold: 0.6 });

  observer.observe(video);
})();
