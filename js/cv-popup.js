// CV creation promo popup (homepage only).
// Shows once per browser after a delay, auto-closes after a few seconds,
// defers while the contact modal or the mobile drawer is open, and never
// blocks the rest of the site. Vanilla, classic script, file://-safe.

(function(){
  'use strict';

  /* ===== Configuration ===== */
  var STORAGE_KEY = 'waapply_cv_popup_shown_v1';
  var SHOW_DELAY = 60000;      // 60s after page load
  var AUTO_CLOSE_DELAY = 20000; // visible for 20s max
  var RETRY_DELAY = 1000;      // re-check while blocked

  /* ===== State ===== */
  var overlay = null;
  var closeBtn = null;
  var ctaBtn = null;
  var panel = null;
  var isOpen = false;
  var lastFocus = null;
  var showTimer = null;
  var retryTimer = null;
  var hideTimer = null;
  var memoryShown = false;

  /* ===== One-shot storage (localStorage → sessionStorage → memory) ===== */
  function storageRead(storage){
    try { return storage.getItem(STORAGE_KEY) === '1'; } catch(e){ return false; }
  }
  function hasBeenShown(){
    if(memoryShown) return true;
    if(storageRead(window.localStorage)) return true;
    if(storageRead(window.sessionStorage)) return true;
    return false;
  }
  function markShown(){
    memoryShown = true;
    try { window.localStorage.setItem(STORAGE_KEY, '1'); return; } catch(e){}
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch(e2){}
  }

  /* ===== Deferral: contact modal / mobile drawer / hidden tab ===== */
  function isBlocked(){
    if(document.hidden) return true;
    if(document.body.classList.contains('nav-open')) return true;
    var contactModal = document.getElementById('contactModal');
    if(contactModal && contactModal.classList.contains('cm-open')) return true;
    return false;
  }

  /* ===== Open / close ===== */
  function showPopup(){
    if(isOpen || hasBeenShown()) return;
    isOpen = true;
    lastFocus = document.activeElement;

    /* The flag is written on the first real appearance, never at page load. */
    markShown();

    panel.style.setProperty('--cvp-duration', (AUTO_CLOSE_DELAY / 1000) + 's');
    overlay.classList.add('cvp-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cvp-lock');
    setPageHidden(true);

    requestAnimationFrame(function(){
      closeBtn.focus({preventScroll:true});
    });

    hideTimer = setTimeout(closePopup, AUTO_CLOSE_DELAY);
  }

  function closePopup(){
    if(!isOpen) return;
    isOpen = false;

    if(hideTimer){ clearTimeout(hideTimer); hideTimer = null; }

    overlay.classList.remove('cvp-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cvp-lock');
    setPageHidden(false);

    var restoreTo = lastFocus && document.contains(lastFocus) ? lastFocus : null;
    lastFocus = null;
    if(restoreTo){
      requestAnimationFrame(function(){
        if(!isOpen && document.contains(restoreTo)){
          try { restoreTo.focus({preventScroll:true}); } catch(e){}
        }
      });
    }
  }

  function setPageHidden(hidden){
    /* Never un-hide the page while another overlay owns it. */
    if(!hidden){
      if(document.body.classList.contains('nav-open')) return;
      var cm = document.getElementById('contactModal');
      if(cm && cm.classList.contains('cm-open')) return;
    }
    var selectors = ['#site-header', '#main', 'footer', '.sticky-mobile-cta'];
    for(var i = 0; i < selectors.length; i++){
      var el = document.querySelector(selectors[i]);
      if(!el) continue;
      if(hidden){ el.setAttribute('aria-hidden', 'true'); }
      else{ el.removeAttribute('aria-hidden'); }
    }
  }

  /* ===== Scheduling ===== */
  function tryShow(){
    retryTimer = null;
    if(isOpen || hasBeenShown()) return;
    if(isBlocked()){
      retryTimer = setTimeout(tryShow, RETRY_DELAY);
      return;
    }
    showPopup();
  }

  /* ===== Keyboard + pointer handlers ===== */
  function handleKeyDown(e){
    if(!isOpen) return;

    if(e.key === 'Escape'){
      e.preventDefault();
      closePopup();
      return;
    }

    if(e.key !== 'Tab') return;

    var focusables = Array.prototype.filter.call(
      panel.querySelectorAll('a[href], button:not([disabled])'),
      function(el){ return el.offsetParent !== null; }
    );
    if(!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if(e.shiftKey && document.activeElement === first){
      e.preventDefault(); last.focus();
    } else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault(); first.focus();
    } else if(!panel.contains(document.activeElement)){
      e.preventDefault(); first.focus();
    }
  }

  function init(){
    overlay = document.getElementById('cvPopup');
    if(!overlay) return;

    panel = overlay.querySelector('.cvp-panel');
    closeBtn = document.getElementById('cvpClose');
    ctaBtn = document.getElementById('cvpCta');
    if(!panel || !closeBtn || !ctaBtn) return;

    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', function(e){
      if(e.target === overlay || e.target.classList.contains('cvp-backdrop')){
        closePopup();
      }
    });
    ctaBtn.addEventListener('click', closePopup);
    document.addEventListener('keydown', handleKeyDown);

    if(hasBeenShown()) return;
    showTimer = setTimeout(tryShow, SHOW_DELAY);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
