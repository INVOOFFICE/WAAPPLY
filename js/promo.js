// Promo Hero — single slide: content entrance + number counter animation.
// No carousel, no autoplay, no navigation.

(function(){
  'use strict';

  var hero = document.querySelector('.promo-hero');
  if(!hero) return;

  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var countersAnimated = false;

  function animateCounters(){
    if(countersAnimated) return;
    countersAnimated = true;

    var counters = hero.querySelectorAll('.counter');
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
        }, 300);
      })(counters[c]);
    }
  }

  if(isReducedMotion){
    animateCounters();
    return;
  }

  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        animateCounters();
        io.disconnect();
      });
    }, {threshold: 0.2});
    io.observe(hero);
  } else {
    animateCounters();
  }
})();
