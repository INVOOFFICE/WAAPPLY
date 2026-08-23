// FAQ accordion — one item open at a time. Keeps aria-expanded in sync.
function toggleFaq(el){
  const item = el.parentElement;
  const answer = item.querySelector('.faq-a');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => {
    i.classList.remove('open');
    i.querySelector('.faq-a').style.maxHeight = null;
    i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
  });
  if(!isOpen){
    item.classList.add('open');
    answer.style.maxHeight = answer.scrollHeight + 'px';
    el.setAttribute('aria-expanded', 'true');
  }
}

// Keyboard support for role="button" headers: Enter/Space activate.
document.querySelectorAll('.faq-q[role="button"]').forEach(q => {
  q.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
      e.preventDefault();
      toggleFaq(q);
    }
  });
});

// Open the first question by default (definition-first) and re-measure once
// fonts finish loading so the animated max-height is never clipped.
(function(){
  const firstQ = document.querySelector('.faq-item .faq-q');
  if(firstQ){ toggleFaq(firstQ); }
  window.addEventListener('load', function(){
    const openA = document.querySelector('.faq-item.open .faq-a');
    if(openA){ openA.style.maxHeight = openA.scrollHeight + 'px'; }
  });
  // Keep the open answer's max-height in sync on viewport resize (rotation,
  // window resize): recompute from the real scrollHeight, rAF-throttled.
  let resizeRaf = null;
  if(!window.__faqResizeBound){
    window.__faqResizeBound = true;
    window.addEventListener('resize', function(){
      if(resizeRaf){ return; }
      resizeRaf = requestAnimationFrame(function(){
        resizeRaf = null;
        const openA = document.querySelector('.faq-item.open .faq-a');
        if(openA){ openA.style.maxHeight = openA.scrollHeight + 'px'; }
      });
    });
  }
})();

window.toggleFaq = toggleFaq;
