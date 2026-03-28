if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state !== 'installed') return;
            if (navigator.serviceWorker.controller) window.location.reload();
          });
        });
      })
      .catch(() => {});
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  },
  { threshold: 0.1 }
);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

(function initBlogGridPagination() {
  const grid = document.getElementById('blog-grid');
  const nav = document.getElementById('blog-pagination');
  const btnPrev = document.getElementById('blog-pagination-prev');
  const btnNext = document.getElementById('blog-pagination-next');
  const statusEl = document.getElementById('blog-pagination-status');
  if (!grid || !nav || !btnPrev || !btnNext || !statusEl) return;

  const PAGE_SIZE = 6;
  const cards = Array.from(grid.querySelectorAll('.blog-card'));
  if (cards.length <= PAGE_SIZE) return;

  nav.hidden = false;
  let page = 0;
  const totalPages = Math.ceil(cards.length / PAGE_SIZE);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function apply() {
    const start = page * PAGE_SIZE;
    cards.forEach((card, i) => {
      const onPage = i >= start && i < start + PAGE_SIZE;
      card.classList.toggle('is-page-hidden', !onPage);
      if (onPage) card.classList.add('visible');
    });
    btnPrev.disabled = page <= 0;
    btnNext.disabled = page >= totalPages - 1;
    statusEl.textContent = 'Page ' + (page + 1) + ' / ' + totalPages;
  }

  function scrollToGrid() {
    grid.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  btnPrev.addEventListener('click', () => {
    if (page <= 0) return;
    page--;
    apply();
    scrollToGrid();
  });
  btnNext.addEventListener('click', () => {
    if (page >= totalPages - 1) return;
    page++;
    apply();
    scrollToGrid();
  });

  apply();
})();
