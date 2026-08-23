// Desktop/mobile navigation: hamburger toggles the mobile drawer.
// Also: scroll-spy highlights the active desktop nav link; clicking the
// drawer backdrop closes it.

function toggleMobileNav(){
  document.getElementById('mobileNav').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
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

window.toggleMobileNav = toggleMobileNav;
