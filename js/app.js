// Global init: behaviors that span the whole page.

// Header scroll shadow (rAF-throttled like the scroll-spy).
const header = document.getElementById('site-header');
let headerTick = false;

function updateHeaderShadow(){
  header.classList.toggle('scrolled', window.scrollY > 8);
  headerTick = false;
}
if(header){
  updateHeaderShadow();
  window.addEventListener('scroll', function(){
    if(!headerTick){ headerTick = true; requestAnimationFrame(updateHeaderShadow); }
  }, {passive:true});
}
