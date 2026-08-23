// Motion system: one IntersectionObserver drives everything.
// - .reveal gets .in on first intersection; data-delay="<ms>" schedules it
//   (no CSS transition-delay, so hover transitions stay instant afterwards).
// - [data-stagger] containers auto-fill MISSING data-delay on their direct
//   .reveal children (existing manual delays always win).
// - .pp-kvalue numbers inside a revealed ancestor count up once (~750ms,
//   ease-out cubic). Skipped entirely under prefers-reduced-motion: the
//   final value is never touched.
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-stagger]').forEach(group => {
  const step = parseInt(group.dataset.stagger, 10) || 80;
  group.querySelectorAll(':scope > .reveal').forEach((el, i) => {
    if(!el.dataset.delay) el.dataset.delay = String(i * step);
  });
});

function countUp(el){
  const target = parseFloat(el.textContent.replace(/[^\d.-]/g, ''));
  if(isNaN(target)) return;
  el.textContent = '0';
  const dur = 750, t0 = performance.now();
  function tick(t){
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    const el = entry.target;
    const delay = parseInt(el.dataset.delay || '0', 10);
    setTimeout(() => {
      el.classList.add('in');
      if(!REDUCED_MOTION) el.querySelectorAll('.pp-kvalue').forEach(countUp);
    }, delay);
    io.unobserve(el);
  });
}, {threshold: 0.12});
revealEls.forEach(el => io.observe(el));
