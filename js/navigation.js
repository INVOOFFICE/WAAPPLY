// Desktop/mobile navigation: hamburger toggles the mobile drawer.
// Also: scroll-spy highlights the active desktop nav link; clicking the
// drawer backdrop closes it. While open, the drawer locks body scroll,
// hides page content from assistive tech and traps keyboard focus.

let lastDrawerFocus = null;

function toggleMobileNav(){
  const nav = document.getElementById('mobileNav');
  const isOpen = nav.classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open', isOpen);
  // Lock background scroll while the drawer is open.
  document.body.classList.toggle('nav-open', isOpen);
  // Hide page content from AT while the drawer is open.
  ['#site-header', '#main', 'footer', '.sticky-mobile-cta'].forEach(function(sel){
    const el = document.querySelector(sel);
    if(!el){ return; }
    if(isOpen){ el.setAttribute('aria-hidden', 'true'); }
    else{ el.removeAttribute('aria-hidden'); }
  });
  // Focus: into the first link on open, back to the trigger on close.
  if(isOpen){
    lastDrawerFocus = document.activeElement;
    const firstLink = nav.querySelector('a[href]');
    if(firstLink){ firstLink.focus({preventScroll:true}); }
  }else{
    const restoreTo = lastDrawerFocus && document.contains(lastDrawerFocus) && !nav.contains(lastDrawerFocus)
      ? lastDrawerFocus
      : document.getElementById('hamburger');
    // Defer by one frame: when closing was triggered by clicking a link, the
    // browser processes the fragment navigation's focus reset after the click
    // handlers — restoring synchronously gets overwritten.
    requestAnimationFrame(function(){
      if(!nav.classList.contains('open') && document.contains(restoreTo)){
        restoreTo.focus({preventScroll:true});
      }
    });
    lastDrawerFocus = null;
  }
}

// --- Scroll spy (desktop nav) ---
const spyLinks = Array.prototype.slice.call(document.querySelectorAll('.main-nav a[href^="#"]'));
const spySections = spyLinks
  .map(a => document.querySelector(a.hash))
  .filter(Boolean);
let spyTick = false;

function updateSpy(){
  const pos = window.scrollY + 150;
  let current = spySections[0];
  spySections.forEach(sec => { if(sec.offsetTop <= pos) current = sec; });
  if(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80){
    current = spySections[spySections.length - 1];
  }
  if(current){
    spyLinks.forEach(a => a.classList.toggle('active', a.hash === '#' + current.id));
  }
  spyTick = false;
}
if(spySections.length){
  window.addEventListener('scroll', function(){
    if(!spyTick){ spyTick = true; requestAnimationFrame(updateSpy); }
  }, {passive:true});
  updateSpy();
}

// --- Click on drawer backdrop closes the drawer ---
const mobileNavEl = document.getElementById('mobileNav');
if(mobileNavEl){
  mobileNavEl.addEventListener('click', function(e){
    if(e.target === mobileNavEl && mobileNavEl.classList.contains('open')){
      toggleMobileNav();
    }
  });
}

// --- Escape closes the drawer when open ---
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    const nav = document.getElementById('mobileNav');
    if(nav && nav.classList.contains('open')){ toggleMobileNav(); }
  }
});

// --- Focus trap: Tab/Shift+Tab stay inside the open drawer ---
document.addEventListener('keydown', function(e){
  if(e.key !== 'Tab'){ return; }
  const nav = document.getElementById('mobileNav');
  if(!nav || !nav.classList.contains('open')){ return; }
  const focusables = Array.prototype.filter.call(
    nav.querySelectorAll('a[href], button:not([disabled])'),
    function(el){ return el.offsetParent !== null; }
  );
  if(!focusables.length){ return; }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if(e.shiftKey && document.activeElement === first){
    e.preventDefault(); last.focus();
  } else if(!e.shiftKey && document.activeElement === last){
    e.preventDefault(); first.focus();
  } else if(!nav.contains(document.activeElement)){
    e.preventDefault(); first.focus();
  }
});

window.toggleMobileNav = toggleMobileNav;
