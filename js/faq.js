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

// The accordion starts CLOSED on first display (no auto-open) so mobile
// readers can scan the questions first. Re-measure any open answer on viewport
// resize so the animated max-height never clips.
(function(){
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
