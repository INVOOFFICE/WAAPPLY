/** Entry point: scroll reveal, button binding, and dynamic news loader. */
import { calculer } from './evaluator.js';
import { loadNews } from './news.js';

const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.scroll-fade').forEach(el => obs.observe(el));

document.getElementById('eval-btn').addEventListener('click', () => calculer());

loadNews();
