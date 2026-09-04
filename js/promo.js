// Promo Hero — single slide: content entrance + number counter animation.
// No carousel, no autoplay, no navigation.

(function(){
  'use strict';

  var slide = document.querySelector('.promo-slide--single');
  if(!slide) return;

  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var countersAnimated = false;

  /* ===== Reveal slide content on load ===== */
  function revealSlide(){
    slide.classList.add('revealed');
  }

  /* ===== Number counter animation ===== */
  function animateCounters(){
    if(countersAnimated) return;
    countersAnimated = true;

    var counters = slide.querySelectorAll('.counter');
    var duration = isReducedMotion ? 0 : 800;

    for(var c = 0; c < counters.length; c++){
      (function(el){
        var target = parseInt(el.getAttribute('data-target'), 10);
        var suffix = el.getAttribute('data-suffix') || '';

        if(duration === 0){
          el.textContent = target + suffix;
          el.classList.add('counted');
          return;
        }

        setTimeout(function(){
          el.classList.add('counted');
          var startTime = performance.now();

          function step(now){
            var elapsed = now - startTime;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target) + suffix;
            if(progress < 1){
              requestAnimationFrame(step);
            } else {
              el.textContent = target + suffix;
            }
          }
          requestAnimationFrame(step);
        }, 400);
      })(counters[c]);
    }
  }

  /* ===== Initialize ===== */
  if(isReducedMotion){
    revealSlide();
    animateCounters();
  } else {
    // Small delay so paint settles before entrance transition
    setTimeout(revealSlide, 120);
    // Start counters after content has appeared
    setTimeout(animateCounters, 500);
  }

})();
