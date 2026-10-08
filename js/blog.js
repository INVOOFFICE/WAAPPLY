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
      page reste complète quand on ouvre le fichier en local. */

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

function initBlogHub() {
  var list = document.querySelector('.article-list');
  var chipsBox = document.querySelector('.blog-chips');
  var empty = document.querySelector('.blog-empty');
  if (!list) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('.article-item'));

  items.forEach(function (item) {
    // 1) href racine-absolu du moteur → lien relatif (file:// + https://)
    var link = item.querySelector('h3 a');
    if (link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('/blog/') === 0) link.setAttribute('href', href.slice('/blog/'.length));
    }
    // 2) catégorie brute → libellé arabe + clé de filtrage
    item.setAttribute('data-category', blogRewriteMeta(item));
  });

  if (!chipsBox) return;
  var chips = Array.prototype.slice.call(chipsBox.querySelectorAll('.chip[data-filter]'));

  function applyFilter(filter) {
    var visible = 0;
    items.forEach(function (item) {
      var match = filter === 'all' || item.getAttribute('data-category') === filter;
      item.hidden = !match;
      if (match) visible += 1;
    });
    chips.forEach(function (chip) {
      var on = chip.getAttribute('data-filter') === filter;
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (empty) {
      empty.hidden = visible > 0;
      empty.textContent = filter === 'all'
        ? 'لا توجد مقالات متاحة حالياً.'
        : 'لا توجد مقالات في هذا التصنيف بعد.';
    }
  }

  chipsBox.addEventListener('click', function (event) {
    var chip = event.target.closest ? event.target.closest('.chip[data-filter]') : null;
    if (!chip) return;
    applyFilter(chip.getAttribute('data-filter'));
  });

  applyFilter('all');
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
