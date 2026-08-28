// Motion system: one IntersectionObserver drives everything.
// - .reveal gets .in on first intersection; data-delay="<ms>" schedules it
//   (no CSS transition-delay, so hover transitions stay instant afterwards).
// - [data-stagger] containers auto-fill MISSING data-delay on their direct
//   .reveal children (existing manual delays always win).

document.querySelectorAll('[data-stagger]').forEach(group => {
  const step = parseInt(group.dataset.stagger, 10) || 80;
  group.querySelectorAll(':scope > .reveal').forEach((el, i) => {
    if(!el.dataset.delay) el.dataset.delay = String(i * step);
  });
});

const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    const el = entry.target;
    const delay = parseInt(el.dataset.delay || '0', 10);
    setTimeout(() => {
      el.classList.add('in');
    }, delay);
    io.unobserve(el);
  });
}, {threshold: 0.12});
revealEls.forEach(el => io.observe(el));
