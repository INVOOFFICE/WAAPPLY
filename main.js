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

(function initThemeMode() {
  const STORAGE_KEY = 'waapply.theme';
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const CHOICES = ['system', 'dark', 'light'];

  function resolveTheme(choice) {
    if (choice === 'light' || choice === 'dark') return choice;
    return mql.matches ? 'dark' : 'light';
  }

  function applyTheme(choice) {
    const resolved = resolveTheme(choice);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
    if (metaColorScheme) metaColorScheme.setAttribute('content', resolved);
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0a0e14' : '#f5f8fc');
    }
    return resolved;
  }

  function getChoice() {
    const saved = String(localStorage.getItem(STORAGE_KEY) || '').trim();
    if (saved === 'light' || saved === 'dark') return saved;
    return 'system';
  }

  function setChoice(choice) {
    if (choice === 'light' || choice === 'dark') {
      localStorage.setItem(STORAGE_KEY, choice);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    return applyTheme(choice);
  }

  function renderToggle() {
    if (document.querySelector('.theme-toggle')) return;
    const navCta = document.querySelector('.nav-cta');
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    const host = navCta || nav;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle theme mode');

    function paint(choice, activeTheme) {
      const labels = {
        system: `Auto (${activeTheme})`,
        dark: 'Dark',
        light: 'Light',
      };
      btn.textContent = labels[choice] || 'Auto';
      btn.setAttribute('aria-pressed', choice === 'dark' ? 'true' : 'false');
      btn.title = `Theme: ${labels[choice] || choice}`;
    }

    let currentChoice = getChoice();
    let initial = setChoice(currentChoice);
    paint(currentChoice, initial);

    btn.addEventListener('click', () => {
      const idx = CHOICES.indexOf(currentChoice);
      const nextIdx = idx >= 0 ? (idx + 1) % CHOICES.length : 0;
      currentChoice = CHOICES[nextIdx];
      const applied = setChoice(currentChoice);
      paint(currentChoice, applied);
    });

    host.appendChild(btn);

    mql.addEventListener('change', () => {
      if (getChoice() !== 'system') return;
      const applied = applyTheme('system');
      currentChoice = 'system';
      paint(currentChoice, applied);
    });
  }

  applyTheme(getChoice());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderToggle, { once: true });
  } else {
    renderToggle();
  }
})();

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

function setupBlogGridPagination() {
  const grid = document.getElementById('blog-grid');
  const nav = document.getElementById('blog-pagination');
  const btnPrev = document.getElementById('blog-pagination-prev');
  const btnNext = document.getElementById('blog-pagination-next');
  const statusEl = document.getElementById('blog-pagination-status');
  if (!grid || !nav || !btnPrev || !btnNext || !statusEl) return;

  const PAGE_SIZE = 6;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!nav._waPagState) nav._waPagState = { page: 0 };
  const state = nav._waPagState;
  state.page = 0;

  function getCards() {
    return Array.from(grid.querySelectorAll('.blog-card'));
  }

  function apply() {
    const cards = getCards();
    const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
    if (state.page >= totalPages) state.page = Math.max(0, totalPages - 1);

    if (cards.length <= PAGE_SIZE) {
      nav.hidden = true;
      cards.forEach((card) => {
        card.classList.remove('is-page-hidden');
        card.classList.add('visible');
      });
      return;
    }

    nav.hidden = false;
    const start = state.page * PAGE_SIZE;
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
    btnPrev.disabled = state.page <= 0;
    btnNext.disabled = state.page >= totalPages - 1;
    statusEl.textContent = 'Page ' + (state.page + 1) + ' / ' + totalPages;
  }

  function scrollToGrid() {
    grid.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  if (!nav.dataset.waPaginationBound) {
    nav.dataset.waPaginationBound = '1';
    btnPrev.addEventListener('click', () => {
      if (state.page <= 0) return;
      state.page--;
      apply();
      scrollToGrid();
    });
    btnNext.addEventListener('click', () => {
      const cards = getCards();
      const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
      if (state.page >= totalPages - 1) return;
      state.page++;
      apply();
      scrollToGrid();
    });
  }

  apply();
}

setupBlogGridPagination();

(function initInlineNewsletterCta() {
  const NEWSLETTER_ACTION = 'https://waapply.beehiiv.com/subscribe';
  // Optional backend endpoint (proxy) to subscribe without redirect.
  // Example payload: { email: "user@example.com", source: "waapply-inline" }
  const NEWSLETTER_API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxa8OflaUsi78xqH6OZsP6xoQi-hrKcm7sYooU9JeAAQXxtJf3H9r4rhEmiwcjnDbQC/exec';
  const LEAD_MAGNET_URL = '/lead-magnet-50-ai-prompts.txt';

  function wireNewsletterForm(form, statusClassName) {
    if (!form) return;
    const useApiMode = !!NEWSLETTER_API_ENDPOINT;

    function ensureStatusEl() {
      let status = form.parentElement.querySelector(`.${statusClassName}`);
      if (!status) {
        status = document.createElement('p');
        status.className = statusClassName;
        form.insertAdjacentElement('afterend', status);
      }
      return status;
    }

    if (useApiMode) {
      form.removeAttribute('action');
      form.removeAttribute('target');
      form.setAttribute('data-newsletter-provider', 'beehiiv-api');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = form.querySelector('input[type="email"]');
        if (!emailInput || !emailInput.checkValidity()) return;
        const status = ensureStatusEl();
        status.textContent = 'Submitting...';
        try {
          const resp = await fetch(NEWSLETTER_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailInput.value.trim(),
              source: statusClassName === 'inline-newsletter-status' ? 'waapply-inline' : 'waapply-main',
            }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          status.innerHTML =
            'Subscription confirmed. Download your free pack: ' +
            `<a href="${LEAD_MAGNET_URL}" target="_blank" rel="noopener">50 AI prompts (TXT)</a>.`;
          form.reset();
        } catch (err) {
          status.textContent =
            'Could not confirm subscription right now. Please try again in a moment.';
        }
      });
      return;
    }

    if (NEWSLETTER_ACTION) {
      form.action = NEWSLETTER_ACTION;
      form.target = '_blank';
      form.setAttribute('data-newsletter-provider', 'beehiiv');
    } else {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        window.alert(
          'Newsletter endpoint not set yet. Configure NEWSLETTER_ACTION in main.js.'
        );
      });
      return;
    }

    form.addEventListener('submit', () => {
      const emailInput = form.querySelector('input[type="email"]');
      if (emailInput && !emailInput.checkValidity()) return;
      const status = ensureStatusEl();
      status.innerHTML =
        'Subscription page opened in a new tab. Confirm your email there, then download your free pack: ' +
        `<a href="${LEAD_MAGNET_URL}" target="_blank" rel="noopener">50 AI prompts (TXT)</a>.`;
    });
  }

  function buildInlineCta() {
    const box = document.createElement('aside');
    box.className = 'inline-newsletter-cta';
    box.innerHTML =
      '<h3 class="inline-newsletter-title">Free AI Prompt Pack for Freelancers</h3>' +
      '<p class="inline-newsletter-text">Get practical prompts for client work, proposals, and delivery workflows.</p>' +
      '<form class="inline-newsletter-form" method="post" target="_blank" novalidate>' +
      '<input class="inline-newsletter-input" type="email" name="email" placeholder="Enter your email" required>' +
      '<button class="inline-newsletter-btn" type="submit">Get the free pack</button>' +
      '</form>' +
      '<p class="inline-newsletter-note">No spam. 1-click unsubscribe.</p>';

    const form = box.querySelector('form');
    wireNewsletterForm(form, 'inline-newsletter-status');
    return box;
  }

  function injectIntoBodies() {
    document.querySelectorAll('.blog-article-body').forEach((body) => {
      if (body.querySelector('.inline-newsletter-cta')) return;
      const paras = Array.from(body.querySelectorAll(':scope > p'));
      if (paras.length < 3) return;
      const cta = buildInlineCta();
      paras[2].insertAdjacentElement('afterend', cta);
    });
  }

  const mainForm = document.getElementById('newsletter-form');
  wireNewsletterForm(mainForm, 'newsletter-status');

  injectIntoBodies();
  window.addEventListener('wa:articleRendered', injectIntoBodies);
})();

(function initGuideExpandables() {
  const section = document.getElementById('articles');
  if (!section) return;

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

(function hydrateBlogFromLiveJson() {
  const JSON_URL = 'data/blog-posts.json';
  const TAG_CANONICAL_MAP = {
    'make money online': 'Make Money Online',
    'ai tools reviews': 'AI Tools Reviews',
    'freelancing guides': 'Freelancing Guides',
    'side hustle ideas': 'Side Hustle Ideas',
    'money & income': 'Side Hustle Ideas',
    'ai & income': 'Side Hustle Ideas',
    'personal finance': 'Make Money Online',
    investing: 'Make Money Online',
    'business & income': 'Make Money Online',
    'business & marketing': 'Make Money Online',
    'career & jobs': 'Freelancing Guides',
    'career & job': 'Freelancing Guides',
    'work & income': 'Freelancing Guides',
    'ai freelance and side hustle': 'Freelancing Guides',
    'ai freelance': 'Freelancing Guides',
    'ai tools': 'AI Tools Reviews',
    'ai tools comparison': 'AI Tools Reviews',
    'ai coding tools': 'AI Tools Reviews',
    'ai image generators': 'AI Tools Reviews',
    'ai automation tools': 'AI Tools Reviews',
    'chatgpt use cases': 'AI Tools Reviews',
    'gemini ai': 'AI Tools Reviews',
    'ai news': null,
  };
  const INTERNAL_LINK_PRIORITIES = {
    'chatgpt-make-money-2026': ['freelancing-with-ai-guide-2026'],
    'passive-income-ideas-america-2026': ['passive-income-ai-2026'],
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function formatDateDisplay(isoDate) {
    const d = new Date(`${isoDate}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }

  function sortPosts(posts) {
    return [...posts].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function normalizedCategory(rawTag) {
    const key = String(rawTag || '').trim().toLowerCase();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(TAG_CANONICAL_MAP, key)) {
      return TAG_CANONICAL_MAP[key];
    }
    return null;
  }

  function buildArticleBody(post) {
    if (post.bodyHtml && String(post.bodyHtml).trim()) {
      return post.bodyHtml.trim();
    }
    const paras = Array.isArray(post.paragraphs) ? post.paragraphs : [];
    return paras
      .map((p) => {
        const t = String(p || '').trim();
        return t ? `<p>${escapeHtml(t)}</p>` : '';
      })
      .filter(Boolean)
      .join('\n      ');
  }

  function dedicatedPageHref(postId) {
    return `/blog/post.html?id=${encodeURIComponent(postId)}`;
  }

  function pickRelatedPosts(post, posts, maxLinks = 3) {
    const byId = new Map(posts.map((p) => [String(p.id || ''), p]));
    const selected = [];
    const used = new Set([String(post.id || '')]);
    const preferred = INTERNAL_LINK_PRIORITIES[String(post.id || '')] || [];
    for (const id of preferred) {
      const match = byId.get(String(id));
      if (match && !used.has(String(match.id || ''))) {
        selected.push(match);
        used.add(String(match.id || ''));
      }
      if (selected.length >= maxLinks) return selected;
    }
    for (const p of posts) {
      if (selected.length >= maxLinks) break;
      if (used.has(String(p.id || ''))) continue;
      if (String(p.tag || '') === String(post.tag || '')) {
        selected.push(p);
        used.add(String(p.id || ''));
      }
    }
    for (const p of posts) {
      if (selected.length >= maxLinks) break;
      if (used.has(String(p.id || ''))) continue;
      selected.push(p);
      used.add(String(p.id || ''));
    }
    return selected;
  }

  function buildRelatedLinks(post, posts) {
    const links = pickRelatedPosts(post, posts, 3);
    if (!links.length) return '';
    const items = links
      .map(
        (p) =>
          `<li><a href="${escapeAttr(dedicatedPageHref(String(p.id || '')))}" class="blog-article-permalink-link">${escapeHtml(p.title || '')}</a></li>`
      )
      .join('\n');
    return `<section class="blog-article-internal-links" aria-label="Related guides"><h3 class="blog-body-subheading">Related guides</h3><ul>${items}</ul></section>`;
  }

  function buildCard(post, siteBaseUrl) {
    const id = String(post.id || '').trim();
    if (!id) return '';
    const display = formatDateDisplay(post.date || '');
    const href = dedicatedPageHref(id);
    const base = siteBaseUrl.replace(/\/$/, '');
    const absUrl = `${base}/blog/post.html?id=${encodeURIComponent(id)}`;
    const sum = (post.short_description || post.shortDescription || post.excerpt || '').trim();
    const metaDesc = sum.length > 158 ? `${sum.slice(0, 157)}…` : sum;
    const docTitle = `${post.title} | WaApply`;
    return `      <article class="blog-card reveal" itemscope itemtype="https://schema.org/BlogPosting" data-wa-meta-desc="${escapeAttr(metaDesc)}" data-wa-meta-title="${escapeAttr(post.title || '')}" data-wa-doc-title="${escapeAttr(docTitle)}" data-wa-article-url="${escapeAttr(absUrl)}" data-wa-article-id="${escapeAttr(id)}">
        <div class="blog-card-meta">
          <time class="blog-card-date" datetime="${escapeAttr(post.date || '')}" itemprop="datePublished">${escapeHtml(display)}</time>
          <span class="blog-card-tag">${escapeHtml(post.tag || '')}</span>
        </div>
        <h3 class="blog-card-title" itemprop="headline">${escapeHtml(post.title || '')}</h3>
        <p class="blog-card-excerpt" itemprop="description">${escapeHtml(post.excerpt || '')}</p>
        <a href="${escapeAttr(href)}" class="blog-card-link" itemprop="url" hreflang="en" title="Read: ${escapeAttr(post.title || '')}">Read guide <span aria-hidden="true">→</span></a>
      </article>`;
  }

  function buildArticleBlock(post, siteBaseUrl, posts) {
    const id = String(post.id || '').trim();
    if (!id) return '';
    const display = formatDateDisplay(post.date || '');
    const href = dedicatedPageHref(id);
    const base = siteBaseUrl.replace(/\/$/, '');
    const absUrl = `${base}/blog/post.html?id=${encodeURIComponent(id)}`;
    const bodyId = `article-body-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const sum = (post.short_description || post.shortDescription || post.excerpt || '').trim();
    const metaDesc = sum.length > 158 ? `${sum.slice(0, 157)}…` : sum;
    const docTitle = `${post.title} | WaApply`;
    const modified = post.dateModified || post.date || '';
    const body = buildArticleBody(post);
    const related = buildRelatedLinks(post, posts);
    return `  <article id="${escapeAttr(id)}" class="blog-article blog-article--expandable reveal" itemscope itemtype="https://schema.org/BlogPosting" data-wa-meta-desc="${escapeAttr(metaDesc)}" data-wa-meta-title="${escapeAttr(post.title || '')}" data-wa-doc-title="${escapeAttr(docTitle)}" data-wa-article-url="${escapeAttr(absUrl)}" data-wa-article-id="${escapeAttr(id)}">
    <div class="blog-article-meta">
      <time datetime="${escapeAttr(post.date || '')}" itemprop="datePublished">${escapeHtml(display)}</time>
      <span class="blog-card-tag">${escapeHtml(post.tag || '')}</span>
    </div>
    <h2 class="blog-article-title" itemprop="headline">${escapeHtml(post.title || '')}</h2>
    <p class="blog-article-dek" itemprop="description">${escapeHtml(post.excerpt || '')}</p>
    <p class="blog-article-permalink"><a href="${escapeAttr(href)}" hreflang="en" class="blog-article-permalink-link">Dedicated page</a> <span class="blog-article-permalink-hint" aria-hidden="true">(shareable URL)</span></p>
    <meta itemprop="dateModified" content="${escapeAttr(modified)}">
    <meta itemprop="url" content="${escapeAttr(absUrl)}">
    <div class="blog-article-actions">
      <button type="button" class="blog-article-toggle" aria-expanded="false" aria-controls="${escapeAttr(bodyId)}">
        <span class="blog-article-toggle-label">Read full guide</span>
        <span class="blog-article-toggle-chevron" aria-hidden="true"></span>
      </button>
    </div>
    <div class="blog-article-body-wrap">
      <div id="${escapeAttr(bodyId)}" class="blog-article-body" itemprop="articleBody">
      ${body}
      ${related}
      </div>
    </div>
  </article>`;
  }

  fetch(JSON_URL, { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('blog json');
      return r.json();
    })
    .then((data) => {
      const posts = sortPosts(
        (data.posts || [])
          .map((p) => {
            const tag = normalizedCategory(p.tag);
            if (!tag) return null;
            return { ...p, tag };
          })
          .filter((p) => p && String(p.id || '').trim())
      );
      if (!posts.length) return;

      const siteBaseUrl = data.siteBaseUrl || 'https://waapply.com';
      const grid = document.getElementById('blog-grid');
      const section = document.getElementById('articles');
      const header = section && section.querySelector('.blog-page-header');
      if (!grid || !section || !header) return;

      grid.innerHTML = posts.map((p) => buildCard(p, siteBaseUrl)).filter(Boolean).join('\n\n');
      section.querySelectorAll('.blog-article').forEach((el) => el.remove());
      header.insertAdjacentHTML('afterend', posts.map((p) => buildArticleBlock(p, siteBaseUrl, posts)).filter(Boolean).join('\n\n'));

      grid.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
      section.querySelectorAll('.blog-article.reveal').forEach((el) => revealObserver.observe(el));

      setupBlogGridPagination();
      window.dispatchEvent(new CustomEvent('wa:articleRendered'));

      const raw = location.hash.replace(/^#/, '');
      if (raw) {
        const target = document.getElementById(raw);
        if (target && target.classList.contains('blog-article')) {
          const wrap = target.querySelector('.blog-article-body-wrap');
          const btn = target.querySelector('.blog-article-toggle');
          if (wrap && btn) {
            wrap.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
            const label = btn.querySelector('.blog-article-toggle-label');
            if (label) label.textContent = 'Hide full guide';
            requestAnimationFrame(() =>
              target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            );
          }
        }
      }
    })
    .catch(() => {});
})();

(function initNewsTicker() {
  const bar = document.getElementById('news-ticker');
  const track = document.getElementById('news-ticker-track');
  const btn = document.getElementById('news-ticker-pause');
  if (!bar || !track || !btn) return;

  function truncateWords(s, max) {
    let t = String(s || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (t.length <= max) return t;
    const cut = t.substring(0, max);
    const sp = cut.lastIndexOf(' ');
    if (sp > max * 0.55) return `${cut.substring(0, sp)}…`;
    return `${cut}…`;
  }

  function buildGroup(duplicate) {
    const wrap = document.createElement('div');
    wrap.className = 'news-ticker-group';
    if (duplicate) wrap.setAttribute('aria-hidden', 'true');
    posts.forEach((p) => {
      const item = document.createElement('span');
      item.className = 'news-ticker-item';
      const link = document.createElement('a');
      link.href = `/blog/post.html?id=${encodeURIComponent(p.id)}`;
      const strong = document.createElement('strong');
      strong.className = 'news-ticker-title';
      strong.textContent = p.title;
      link.appendChild(strong);
      const sep = document.createElement('span');
      sep.className = 'news-ticker-sep';
      sep.textContent = ' — ';
      const desc = document.createElement('span');
      desc.className = 'news-ticker-desc';
      desc.textContent = truncateWords(p.excerpt, 100);
      item.appendChild(link);
      item.appendChild(sep);
      item.appendChild(desc);
      wrap.appendChild(item);
    });
    return wrap;
  }

  let posts = [];

  fetch('data/blog-posts.json', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('blog json');
      return r.json();
    })
    .then((data) => {
      posts = (data.posts || [])
        .map((p) => {
          const cat = normalizedCategory(p.tag);
          if (!cat) return null;
          return { ...p, tag: cat };
        })
        .filter((p) => p && String(p.id || '').trim() !== '');
      posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      posts = posts.slice(0, 14);
      if (!posts.length) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      track.appendChild(buildGroup(false));
      if (!reduceMotion) track.appendChild(buildGroup(true));

      bar.removeAttribute('hidden');

      btn.addEventListener('click', () => {
        const paused = bar.classList.toggle('is-paused');
        btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
        btn.textContent = paused ? 'Play' : 'Pause';
      });
    })
    .catch(() => {});
})();
