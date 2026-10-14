/* Hub de la مدونة (blog/index.html) — filtrage par catégorie côté client.
   Script CLASSIQUE : aucun module, aucun fetch — la page doit fonctionner
   telle quelle depuis file:// comme depuis https://.

   Trois rôles :
   1) Lisser les hrefs produits par le moteur (`/blog/{slug}.html`, racine-
      absolus) en liens relatifs : le hub vit dans blog/, donc le simple
      nom de fichier pointe au même endroit sur les deux protocoles.
      Miroir de la FORME d'URL du moteur (planification/Utils.gs `sitePath()`,
      AGENTS §1.2) : ce script ne fait QUE retirer le préfixe `/blog/` des
      hrefs écrits par le moteur — il ne construit jamais d'URL d'article.
   2) Remplacer, dans chaque `.meta`, la catégorie BRUTE (slug de la feuille)
      par son libellé arabe — mêmes slug→libellé que planification/Config.gs
      `CATEGORY_LABELS`, puis piloter les chips de filtrage.
   3) Sur les pages ARTICLE : réécrire l'image de couverture — le moteur la
      garde racine-absolue (`/blog/images/…`, règle P6d/V16, correct sur
      https://) — en chemin relatif UNIQUEMENT sous file://, pour que la
      page reste complète quand on ouvre le fichier en local.
   4) Sur le HUB : paginer la liste côté client (9 articles par page) EN MÊME
      TEMPS que le filtrage des chips — la page est recalculée à chaque
      changement de filtre et reflétée dans l'URL (`?page=N`). Les cartes ne
      sont jamais dupliquées : on masque/affiche les `<li>` existants. */

var BLOG_CATEGORY_LABELS = {
  'work-in-europe': 'العمل في أوروبا',
  'apply-guides': 'دليل التقديم',
  'work-by-country': 'العمل حسب الدولة',
  'work-by-sector': 'العمل حسب القطاع',
  'work-conditions': 'شروط العمل والرواتب والعقود',
  'worker-rights': 'حقوق العمال',
  'seasonal-work': 'العمل الموسمي',
  'work-no-experience': 'العمل بدون خبرة'
};

/** Slug d'une tête de meta : slug connu, libellé arabe connu, slug brut, ou ''. */
function blogSlugForHead(head) {
  if (Object.prototype.hasOwnProperty.call(BLOG_CATEGORY_LABELS, head)) return head;
  var slugs = Object.keys(BLOG_CATEGORY_LABELS);
  for (var i = 0; i < slugs.length; i += 1) {
    if (BLOG_CATEGORY_LABELS[slugs[i]] === head) return slugs[i];
  }
  if (/^[a-z][a-z0-9-]*$/.test(head)) return head; // slug encore inconnu du moteur
  return ''; // pas de catégorie lisible dans la meta
}

/** Meta d'une carte : `<span class="meta-cat">libellé</span> · reste… */
function blogRewriteMeta(item) {
  var meta = item.querySelector('.meta');
  if (!meta) return '';
  var parts = meta.textContent.split('·').map(function (s) { return s.trim(); });
  var head = parts.shift() || '';
  var slug = blogSlugForHead(head);
  var label = slug ? (BLOG_CATEGORY_LABELS[slug] || head) : '';

  while (meta.firstChild) meta.removeChild(meta.firstChild);
  if (label) {
    var span = document.createElement('span');
    span.className = 'meta-cat';
    span.textContent = label;
    meta.appendChild(span);
  } else {
    meta.appendChild(document.createTextNode(head));
  }
  if (parts.length) meta.appendChild(document.createTextNode(' · ' + parts.join(' · ')));
  return slug;
}

/** Nombre d'articles affichés par page sur le hub (9 → grille 3×3 en desktop). */
var BLOG_PAGE_SIZE = 9;

/** Page demandée dans l'URL (`?page=N`) : entier ≥ 1, sinon 1 (valeur par défaut). */
function blogReadPage() {
  var match = /[?&]page=([^&]*)/.exec(window.location.search);
  if (!match) return 1;
  var n = parseInt(match[1], 10);
  return (isFinite(n) && n > 0) ? n : 1;
}

function initBlogHub() {
  var list = document.querySelector('.article-list');
  var chipsBox = document.querySelector('.blog-chips');
  var empty = document.querySelector('.blog-empty');
  if (!list) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('.article-item'));

  items.forEach(function (item) {
    // 1) hrefs racine-absolus du moteur → liens relatifs (file:// + https://).
    //    Concerne le titre (h3 a) ET le lien « قراءة المقال » (.blog-card-more) :
    //    les deux portent le MÊME href d'article, donc la même réécriture.
    var links = item.querySelectorAll('a[href^="/blog/"]');
    for (var j = 0; j < links.length; j += 1) {
      var href = links[j].getAttribute('href') || '';
      if (href.indexOf('/blog/') === 0) links[j].setAttribute('href', href.slice('/blog/'.length));
    }
    // 2) catégorie brute → libellé arabe + clé de filtrage
    item.setAttribute('data-category', blogRewriteMeta(item));
  });

  // Nom de fichier du hub : sert de base aux liens de pagination (`index.html?page=N`).
  var hubFile = window.location.pathname.split('/').pop() || 'index.html';
  var currentFilter = 'all';
  var currentPage = blogReadPage();

  // Le pager est (re)créé après la grille pour rester synchronisé si le
  // script est réexécuté (les cartes, elles, ne sont jamais recréées).
  var stale = document.querySelector('.blog-pagination');
  if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
  var pager = document.createElement('nav');
  pager.className = 'blog-pagination';
  pager.setAttribute('aria-label', 'تصفح صفحات المقالات');
  pager.hidden = true;
  list.parentNode.insertBefore(pager, list.nextSibling);

  function hrefFor(page) {
    return page <= 1 ? hubFile : hubFile + '?page=' + page;
  }

  function syncUrl(page, push) {
    try {
      var url = hrefFor(page);
      if (push && window.history && window.history.pushState) {
        window.history.pushState({ page: page }, '', url);
      } else if (window.history && window.history.replaceState) {
        window.history.replaceState({ page: page }, '', url);
      }
    } catch (e) { /* file:// peut refuser l'API History : l'état reste en mémoire */ }
  }

  function matching() {
    return items.filter(function (item) {
      return currentFilter === 'all' || item.getAttribute('data-category') === currentFilter;
    });
  }

  // Séquence des numéros : première/dernière + fenêtre autour de la page active,
  // séparées par une ellipse quand l'écart le justifie.
  function pageSequence(total, current) {
    var out = [], i;
    if (total <= 7) {
      for (i = 1; i <= total; i += 1) out.push(i);
      return out;
    }
    out.push(1);
    var left = Math.max(2, current - 1);
    var right = Math.min(total - 1, current + 1);
    if (left > 2) out.push('…');
    for (i = left; i <= right; i += 1) out.push(i);
    if (right < total - 1) out.push('…');
    out.push(total);
    return out;
  }

  function buildPager(totalPages, page) {
    if (totalPages <= 1) {
      pager.hidden = true;
      pager.textContent = '';
      return;
    }
    pager.hidden = false;
    pager.textContent = '';

    // Lien réel (`href`) pour la navigation/crawl, data-page pour le sans-rechargement.
    function navLink(kind, target, label, disabled) {
      var el;
      if (disabled) {
        el = document.createElement('span');
        el.className = 'blog-pager-nav blog-pager-' + kind + ' is-disabled';
        el.setAttribute('aria-disabled', 'true');
      } else {
        el = document.createElement('a');
        el.className = 'blog-pager-nav blog-pager-' + kind;
        el.setAttribute('href', hrefFor(target));
        el.setAttribute('data-page', target);
      }
      el.textContent = label;
      return el;
    }

    pager.appendChild(navLink('prev', page - 1, 'السابق', page <= 1));

    var nums = document.createElement('div');
    nums.className = 'blog-pager-nums';
    pageSequence(totalPages, page).forEach(function (p) {
      var el;
      if (p === '…') {
        el = document.createElement('span');
        el.className = 'blog-pager-num ellipsis';
        el.setAttribute('aria-hidden', 'true');
        el.textContent = '…';
      } else if (p === page) {
        el = document.createElement('span');
        el.className = 'blog-pager-num is-current';
        el.setAttribute('aria-current', 'page');
        el.setAttribute('tabindex', '-1');
        el.textContent = p;
      } else {
        el = document.createElement('a');
        el.className = 'blog-pager-num';
        el.setAttribute('href', hrefFor(p));
        el.setAttribute('data-page', p);
        el.textContent = p;
      }
      nums.appendChild(el);
    });
    pager.appendChild(nums);

    pager.appendChild(navLink('next', page + 1, 'التالي', page >= totalPages));
  }

  function render() {
    var shown = matching();
    var totalPages = Math.max(1, Math.ceil(shown.length / BLOG_PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages; // ?page trop grand → dernière page
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * BLOG_PAGE_SIZE;
    items.forEach(function (item) { item.hidden = true; });
    shown.slice(start, start + BLOG_PAGE_SIZE).forEach(function (item) { item.hidden = false; });

    if (empty) {
      empty.hidden = shown.length > 0;
      empty.textContent = currentFilter === 'all'
        ? 'لا توجد مقالات متاحة حالياً.'
        : 'لا توجد مقالات في هذا التصنيف بعد.';
    }

    buildPager(totalPages, currentPage);
  }

  function goToPage(page) {
    currentPage = page;
    render();
    syncUrl(currentPage, true);
    // Défilement vers le haut de la grille (la barre de navigation est collante).
    if (list.scrollIntoView) {
      try { list.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      catch (e) { list.scrollIntoView(); }
    }
    // Conserve le focus clavier sur le numéro de page après reconstruction.
    var active = pager.querySelector('.blog-pager-num.is-current');
    if (active && active.focus) {
      try { active.focus({ preventScroll: true }); } catch (e) { active.focus(); }
    }
  }

  pager.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('a[data-page]') : null;
    if (!link) return;
    event.preventDefault();
    goToPage(parseInt(link.getAttribute('data-page'), 10));
  });

  if (chipsBox) {
    var chips = Array.prototype.slice.call(chipsBox.querySelectorAll('.chip[data-filter]'));
    // onclick (et non addEventListener) : une réexécution remplace l'écouteur
    // au lieu d'en empiler un second.
    chipsBox.onclick = function (event) {
      var chip = event.target.closest ? event.target.closest('.chip[data-filter]') : null;
      if (!chip) return;
      currentFilter = chip.getAttribute('data-filter');
      currentPage = 1; // tout changement de filtre revient à la première page
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      render();
      syncUrl(1, false);
    };
  }

  window.addEventListener('popstate', function () {
    currentPage = blogReadPage();
    render();
  });

  render();
  syncUrl(currentPage, false); // normalise une éventuelle valeur hors bornes
}

/* Rôle 3 — image de couverture : seule reécriture qui tourne aussi sur les
   pages article (le gabarit ne charge que ce script). Sous https:// on ne
   touche à rien : la forme racine-absolue reste celle publiée. */
function blogFileImages() {
  if (window.location.protocol !== 'file:') return;
  var imgs = document.querySelectorAll('img[src^="/blog/"]');
  for (var i = 0; i < imgs.length; i += 1) {
    imgs[i].setAttribute('src', imgs[i].getAttribute('src').replace(/^\/blog\//, ''));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    blogFileImages();
    initBlogHub();
  });
} else {
  blogFileImages();
  initBlogHub();
}
