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

const REVEAL_STAGGER_STEP = 0.05;
const REVEAL_STAGGER_MAX = 0.3;

function revealUsesViewportStagger(el) {
  return el.matches('#blog-grid .blog-card.reveal, #articles .blog-article.reveal');
}

function setRevealStaggerDelays(elements) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sorted = [...elements].sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.top - br.top || ar.left - br.left;
  });
  sorted.forEach((el, i) => {
    const d = reduce ? 0 : Math.min(i * REVEAL_STAGGER_STEP, REVEAL_STAGGER_MAX);
    el.style.transitionDelay = `${d}s`;
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    if (!entering.length) return;

    const stagger = entering.filter(revealUsesViewportStagger);
    const instant = entering.filter((el) => !revealUsesViewportStagger(el));

    instant.forEach((el) => {
      el.style.transitionDelay = '0s';
      el.classList.add('visible');
    });

    if (stagger.length) {
      setRevealStaggerDelays(stagger);
      stagger.forEach((el) => el.classList.add('visible'));
    }

    entering.forEach((el) => revealObserver.unobserve(el));
  },
  { threshold: 0.1 }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

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
    const onPageCards = [];
    cards.forEach((card, i) => {
      const onPage = i >= start && i < start + PAGE_SIZE;
      card.classList.toggle('is-page-hidden', !onPage);
      if (!onPage) {
        card.style.transitionDelay = '';
        return;
      }
      onPageCards.push(card);
    });
    setRevealStaggerDelays(onPageCards);
    onPageCards.forEach((card) => card.classList.add('visible'));
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

(function initGuideExpandables() {
  const section = document.getElementById('articles');
  if (!section || !section.querySelector('.blog-article-toggle')) return;

  const articles = () => Array.from(section.querySelectorAll('.blog-article--expandable'));

  function oneAtATimeEnabled() {
    const el = document.getElementById('guides-one-at-a-time');
    return !el || el.checked;
  }

  function setOpen(article, open) {
    const wrap = article.querySelector('.blog-article-body-wrap');
    const btn = article.querySelector('.blog-article-toggle');
    const label = btn && btn.querySelector('.blog-article-toggle-label');
    if (!wrap || !btn) return;
    wrap.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (label) label.textContent = open ? 'Hide full guide' : 'Read full guide';
  }

  function openFromHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return;
    const target = document.getElementById(raw);
    if (!target || !target.classList.contains('blog-article')) return;
    if (oneAtATimeEnabled()) articles().forEach((a) => setOpen(a, false));
    setOpen(target, true);
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  section.addEventListener('click', (e) => {
    const btn = e.target.closest('.blog-article-toggle');
    if (!btn) return;
    const article = btn.closest('.blog-article');
    if (!article) return;
    const wrap = article.querySelector('.blog-article-body-wrap');
    if (!wrap) return;
    const willOpen = !wrap.classList.contains('is-open');
    if (willOpen && oneAtATimeEnabled()) {
      articles().forEach((a) => {
        if (a !== article) setOpen(a, false);
      });
    }
    setOpen(article, willOpen);
  });

  const expandAll = document.getElementById('guides-expand-all');
  const collapseAll = document.getElementById('guides-collapse-all');
  if (expandAll) {
    expandAll.addEventListener('click', () => {
      articles().forEach((a) => setOpen(a, true));
    });
  }
  if (collapseAll) {
    collapseAll.addEventListener('click', () => {
      articles().forEach((a) => setOpen(a, false));
    });
  }

  window.addEventListener('hashchange', openFromHash);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openFromHash);
  } else {
    openFromHash();
  }
})();

(function initArticleHeadMeta() {
  const md = document.querySelector('meta[name="description"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (!md || !ogTitle || !ogDesc) return;

  const defaults = {
    title: document.title,
    description: md.getAttribute('content') || '',
    ogTitle: ogTitle.getAttribute('content') || '',
    ogDesc: ogDesc.getAttribute('content') || '',
    ogUrl: ogUrl ? ogUrl.getAttribute('content') || '' : '',
    twTitle: twTitle ? twTitle.getAttribute('content') || '' : '',
    twDesc: twDesc ? twDesc.getAttribute('content') || '' : '',
  };

  const selectors = ['#articles .blog-article[data-wa-meta-desc]', '#blog-grid .blog-card[data-wa-meta-desc]'];

  function collectCandidates() {
    const list = [];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => list.push(el));
    });
    return list;
  }

  function visibleHeight(el) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const top = Math.max(0, r.top);
    const bottom = Math.min(vh, r.bottom);
    return Math.max(0, bottom - top);
  }

  function bestInView() {
    const candidates = collectCandidates();
    let best = null;
    let bestScore = 0;
    candidates.forEach((el) => {
      const s = visibleHeight(el);
      if (s > bestScore) {
        bestScore = s;
        best = el;
      }
    });
    const threshold = Math.min(120, window.innerHeight * 0.12);
    if (bestScore < threshold) return null;
    return best;
  }

  function applyEl(el) {
    if (!el) return applyDefault();
    const d = el.getAttribute('data-wa-meta-desc');
    const t = el.getAttribute('data-wa-meta-title');
    const docTitle = el.getAttribute('data-wa-doc-title');
    const aurl = el.getAttribute('data-wa-article-url');
    if (!d || !t) return applyDefault();
    md.setAttribute('content', d);
    ogDesc.setAttribute('content', d);
    ogTitle.setAttribute('content', t);
    if (twTitle) twTitle.setAttribute('content', t);
    if (twDesc) twDesc.setAttribute('content', d);
    if (docTitle) document.title = docTitle;
    if (ogUrl && aurl) ogUrl.setAttribute('content', aurl);
  }

  function applyDefault() {
    document.title = defaults.title;
    md.setAttribute('content', defaults.description);
    ogDesc.setAttribute('content', defaults.ogDesc);
    ogTitle.setAttribute('content', defaults.ogTitle);
    if (twTitle) twTitle.setAttribute('content', defaults.twTitle);
    if (twDesc) twDesc.setAttribute('content', defaults.twDesc);
    if (ogUrl && defaults.ogUrl) ogUrl.setAttribute('content', defaults.ogUrl);
  }

  function tick() {
    const raw = location.hash.replace(/^#/, '');
    if (raw) {
      const byHash = document.getElementById(raw);
      if (byHash && byHash.hasAttribute('data-wa-meta-desc')) {
        applyEl(byHash);
        return;
      }
    }
    applyEl(bestInView());
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      tick();
    });
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
})();
