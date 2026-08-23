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

window.toggleFaq = toggleFaq;
