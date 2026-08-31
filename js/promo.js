// Promo Banner Slider — lightweight carousel.
// Performance-first: cached DOM, setTimeout chain, IntersectionObserver,
// no setInterval, no backdrop-filter. No dependencies.

(function(){
  'use strict';

  var slider = document.querySelector('.promo-slider');
  if(!slider) return;

  /* ===== Cache DOM refs once ===== */
  var track = slider.querySelector('.promo-track');
  var slides = slider.querySelectorAll('.promo-slide');
  var dotsContainer = slider.querySelector('.promo-dots');
  var prevBtn = slider.querySelector('.promo-arrow--prev');
  var nextBtn = slider.querySelector('.promo-arrow--next');
  var liveRegion = slider.querySelector('.promo-live');
  var count = slides.length;
  if(count === 0) return;

  /* ===== State ===== */
  var current = 0;
  var autoplayTimer = null;
  var autoplayDelay = 9000;
  var isPaused = false;
  var isVisible = true;
  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isRtl = document.documentElement.dir === 'rtl' || document.documentElement.getAttribute('dir') === 'rtl';

  /* ===== Build pagination dots ===== */
  var dots = null;
  if(dotsContainer){
    var frag = document.createDocumentFragment();
    dots = [];
    for(var d = 0; d < count; d++){
      var btn = document.createElement('button');
      btn.className = 'promo-dot' + (d === 0 ? ' active' : '');
      btn.setAttribute('aria-label', 'عرض ' + (d + 1));
      btn.setAttribute('data-index', d);
      dots.push(btn);
      frag.appendChild(btn);
    }
    dotsContainer.appendChild(frag);
  }

  /* ===== Go to slide ===== */
  function goTo(index, animate){
    if(index < 0) index = count - 1;
    if(index >= count) index = 0;

    slides[current].classList.remove('active');
    current = index;

    if(animate !== false && !isReducedMotion){
      track.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1)';
    } else {
      track.style.transition = 'none';
    }

    var offset = isRtl ? current * 100 : -current * 100;
    track.style.transform = 'translateX(' + offset + '%)';

    slides[current].classList.add('active');

    if(dots){
      for(var i = 0; i < dots.length; i++){
        dots[i].classList.toggle('active', i === current);
      }
    }

    if(liveRegion){
      liveRegion.textContent = 'عرض ' + (current + 1) + ' من ' + count;
    }

    animateNumbers(slides[current]);
    resetAutoplay();
  }

  function nextSlide(){ goTo(current + 1); }
  function prevSlide(){ goTo(current - 1); }

  /* ===== Autoplay (setTimeout chain — avoids setInterval drift) ===== */
  function startAutoplay(){
    stopAutoplay();
    if(isPaused || !isVisible || isReducedMotion || count <= 1) return;
    autoplayTimer = setTimeout(function(){
      if(!isPaused && isVisible){
        nextSlide();
      }
    }, autoplayDelay);
  }

  function stopAutoplay(){
    if(autoplayTimer){
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function resetAutoplay(){
    stopAutoplay();
    startAutoplay();
  }

  function pauseSlider(){
    isPaused = true;
    stopAutoplay();
  }

  function resumeSlider(){
    isPaused = false;
    startAutoplay();
  }

  /* ===== Pause on hover / touch / focus ===== */
  slider.addEventListener('mouseenter', pauseSlider);
  slider.addEventListener('mouseleave', resumeSlider);
  slider.addEventListener('focusin', pauseSlider);
  slider.addEventListener('focusout', function(e){
    if(!slider.contains(e.relatedTarget)){
      resumeSlider();
    }
  });

  slider.addEventListener('touchstart', pauseSlider, {passive:true});
  slider.addEventListener('touchend', function(){
    setTimeout(function(){
      if(!isPaused) return;
      resumeSlider();
    }, 4000);
  }, {passive:true});

  /* ===== Navigation arrows ===== */
  if(prevBtn){
    prevBtn.addEventListener('click', function(){
      prevSlide();
      pauseSlider();
      setTimeout(resumeSlider, 5000);
    });
  }
  if(nextBtn){
    nextBtn.addEventListener('click', function(){
      nextSlide();
      pauseSlider();
      setTimeout(resumeSlider, 5000);
    });
  }

  /* ===== Pagination dots (event delegation) ===== */
  if(dotsContainer){
    dotsContainer.addEventListener('click', function(e){
      var dot = e.target.closest('.promo-dot');
      if(!dot) return;
      var idx = parseInt(dot.getAttribute('data-index'), 10);
      if(!isNaN(idx)){
        goTo(idx);
        pauseSlider();
        setTimeout(resumeSlider, 5000);
      }
    });
  }

  /* ===== Keyboard navigation ===== */
  slider.setAttribute('tabindex', '0');
  slider.addEventListener('keydown', function(e){
    if(e.key === 'ArrowRight'){
      e.preventDefault();
      isRtl ? prevSlide() : nextSlide();
      pauseSlider();
      setTimeout(resumeSlider, 5000);
    } else if(e.key === 'ArrowLeft'){
      e.preventDefault();
      isRtl ? nextSlide() : prevSlide();
      pauseSlider();
      setTimeout(resumeSlider, 5000);
    }
  });

  /* ===== Touch / Swipe ===== */
  var touchStartX = 0;
  var touchStartY = 0;
  var touchDeltaX = 0;
  var isSwiping = false;

  slider.addEventListener('touchstart', function(e){
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDeltaX = 0;
    isSwiping = false;
    track.style.transition = 'none';
  }, {passive:true});

  slider.addEventListener('touchmove', function(e){
    var dx = e.touches[0].clientX - touchStartX;
    var dy = e.touches[0].clientY - touchStartY;

    if(!isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8){
      isSwiping = true;
    }
    if(!isSwiping) return;

    touchDeltaX = dx;
    e.preventDefault();

    var baseOffset = isRtl ? current * 100 : -current * 100;
    var dragPercent = (touchDeltaX / slider.offsetWidth) * 100;
    if(isRtl) dragPercent = -dragPercent;
    track.style.transform = 'translateX(' + (baseOffset + dragPercent) + '%)';
  }, {passive:false});

  slider.addEventListener('touchend', function(){
    if(!isSwiping) return;

    track.style.transition = '';
    var threshold = slider.offsetWidth * 0.2;

    if(Math.abs(touchDeltaX) > threshold){
      if(isRtl){
        touchDeltaX > 0 ? prevSlide() : nextSlide();
      } else {
        touchDeltaX > 0 ? nextSlide() : prevSlide();
      }
    } else {
      goTo(current, false);
    }

    touchDeltaX = 0;
    isSwiping = false;
  }, {passive:true});

  /* ===== Number counter animation ===== */
  function animateNumbers(slide){
    var counters = slide.querySelectorAll('.counter');
    var len = counters.length;
    for(var c = 0; c < len; c++){
      (function(el){
        var target = parseInt(el.getAttribute('data-target'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        var duration = isReducedMotion ? 0 : 800;

        el.classList.remove('counted');

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

  /* ===== IntersectionObserver: pause when off-screen ===== */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      var wasVisible = isVisible;
      isVisible = entries[0].isIntersecting;
      if(!isVisible && wasVisible){
        stopAutoplay();
      } else if(isVisible && !wasVisible && !isPaused){
        startAutoplay();
      }
    }, {threshold:0.15});
    io.observe(slider);
  }

  /* ===== Initialize ===== */
  for(var i = 0; i < slides.length; i++){
    if(i !== 0) slides[i].classList.remove('active');
  }
  goTo(0, false);

  if(!isReducedMotion){
    startAutoplay();
  }

  /* ===== Visibility API: pause when tab hidden ===== */
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      stopAutoplay();
    } else if(!isPaused && !isReducedMotion){
      startAutoplay();
    }
  });

})();
