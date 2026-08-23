// Scroll reveal: IntersectionObserver adds .in to .reveal elements on first intersection.
// Optional data-delay="<ms>" staggers entrances by scheduling .in — no CSS transition-delay,
// so hover transitions stay instant after the element has appeared.
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    const el = entry.target;
    const delay = parseInt(el.dataset.delay || '0', 10);
    setTimeout(() => el.classList.add('in'), delay);
    io.unobserve(el);
  });
}, {threshold: 0.12});
revealEls.forEach(el => io.observe(el));
