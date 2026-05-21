// ============================================================
// Visa Schengen BLOG — Build static blog pages
// scripts/build-news-pages.mjs
//
// ✅ Compatible avec le Google Apps Script (Code.gs) :
//    - Lit blogs.json (tableau plat OU { all: [...] })
//    - Dérive tag_type / tag_label depuis le champ "category"
//    - SITE_URL aligné sur schengen-maroc.com
//
// Génère à partir de blogs.json :
//   blog/<slug>/index.html   → page détail de chaque article
//   blog/index.html           → index de tous les articles
//   sitemap.xml
//   llms.txt
//   robots.txt
//
// Usage :
//   node scripts/build-news-pages.mjs
// ============================================================

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration — adapter si besoin ──────────────────────
const ROOT     = path.resolve(__dirname, '..');
const SITE_URL = 'https://waapply.com';

// Dossier de sortie des pages blog (correspond à l'URL /blog/)
const BLOG_DIR_NAME = 'blog';

// Liens internes vers les sections clés du site
const CORE_INTERNAL_LINKS = [
  { href: '/guide-complet/',  anchor: 'Guide complet visa Schengen Maroc' },
  { href: '/documents-requis/', anchor: 'Liste des documents requis'       },
  { href: '/refus-recours/',  anchor: 'Que faire en cas de refus'          },
  { href: '/blog/',           anchor: 'Blog Schengen — actualités'          },
  { href: '/par-pays/',       anchor: 'Visa Schengen par pays'             },
];

// WhatsApp CTA (repris du GAS)
const CTA_WHATSAPP = 'https://wa.me/34618642696?text=Bonjour%20%F0%9F%91%8B%20Je%20voudrais%20des%20infos%20sur%20le%20visa%20Schengen.';

// Entités sémantiques pour schema.org et llms.txt
const ENTITY_TOPICS = [
  'visa Schengen Maroc',
  'consulat France Maroc',
  'consulat Espagne Maroc',
  'consulat Italie Maroc',
  'TLS Contact Maroc',
  'VFS Global Maroc',
  'BLS International Maroc',
  'ressortissants marocains Europe',
  'politique Schengen',
  'refus visa Schengen',
  'documents visa Schengen',
  'assurance voyage Schengen',
  'frais visa Schengen',
  'EES entrée sortie',
  'ETIAS autorisation voyage',
  'délais consulaires Maroc',
];

// ── Mapping catégorie → tag visuel ─────────────────────────
// Permet de dériver tag_type et tag_label depuis le champ
// "category" produit par le GAS sans modifier le GAS.
const CATEGORY_TAG_MAP = {
  'Actualités Schengen':  { type: 'alert', label: 'Actualité'  },
  'Visa par pays':        { type: 'info',  label: 'Par pays'   },
  'Dossier & Documents':  { type: 'info',  label: 'Documents'  },
  'Profils spécifiques':  { type: 'news',  label: 'Profil'     },
  'Refus & Recours':      { type: 'alert', label: 'Refus'      },
  'Procédure & RDV':      { type: 'info',  label: 'Procédure'  },
  'Conseils pratiques':   { type: 'news',  label: 'Conseils'   },
};

function getTag(item) {
  // Si tag_type/tag_label sont déjà présents (ajout futur dans GAS), on les utilise
  if (item.tag_type && item.tag_label) {
    return { type: item.tag_type, label: item.tag_label };
  }
  // Sinon on dérive depuis category
  return CATEGORY_TAG_MAP[item.category] || { type: 'info', label: item.category || 'Info' };
}

// ============================================================
// LECTURE DE blogs.json
// ============================================================
const blogsJsonPath = path.join(ROOT, 'blogs.json');
if (!fs.existsSync(blogsJsonPath)) {
  console.error('❌ blogs.json introuvable à : ' + blogsJsonPath);
  console.log('   Lance d\'abord le Google Apps Script pour générer blogs.json.');
  process.exit(0);
}

const rawData = JSON.parse(fs.readFileSync(blogsJsonPath, 'utf8'));

// Accepte deux formats :
//   - tableau plat  : [{ id, title, ... }]         ← sortie directe du GAS
//   - objet enveloppé: { all: [...], main: [...] }  ← format étendu possible
const allItems = (Array.isArray(rawData) ? rawData : (rawData.all || []))
  .filter(a => a.status === 'published' && a.id);

// Ajouter slug si absent (ne devrait pas arriver, le GAS le génère)
allItems.forEach(item => {
  if (!item.slug) item.slug = generateSlug(item.title);
  // Normaliser les URLs de l'ancien domaine
  if (item.image_url) item.image_url = item.image_url.replace(/https?:\/\/schengen-maroc\.com/gi, SITE_URL);
  if (item.url) item.url = item.url.replace(/https?:\/\/schengen-maroc\.com/gi, SITE_URL);
});

console.log(`📝 ${allItems.length} article(s) à traiter...`);

// blogs.json n'est pas réécrit ici — il est géré exclusivement par le GAS
// via pushFilesToGithub() pour éviter les conflits de push simultané.

// ============================================================
// GÉNÉRATION DES PAGES INDIVIDUELLES — blog/<slug>/
// ============================================================
const blogDir = path.join(ROOT, BLOG_DIR_NAME);
fs.mkdirSync(blogDir, { recursive: true });

for (const item of allItems) {
  const dir = path.join(blogDir, item.slug);
  fs.mkdirSync(dir, { recursive: true });

  const related = getRelatedItems(item, allItems, 3);
  const html    = buildBlogPage(item, allItems, related);
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log(`  ✅ ${BLOG_DIR_NAME}/${item.slug}/index.html`);
}

// ============================================================
// GÉNÉRATION DE L'INDEX — blog/index.html
// ============================================================
const indexHtml = buildBlogIndex(allItems);
fs.writeFileSync(path.join(blogDir, 'index.html'), indexHtml, 'utf8');
console.log(`  ✅ ${BLOG_DIR_NAME}/index.html`);

// ============================================================
// GÉNÉRATION DE sitemap.xml
// ============================================================
const pillarPages = [
  '/guide-complet/',
  '/documents-requis/',
  '/refus-recours/',
  '/par-pays/',
];
const sitemapUrls = [
  { loc: `${SITE_URL}/`,            priority: '1.0', changefreq: 'weekly' },
  { loc: `${SITE_URL}/blog/`,       priority: '0.9', changefreq: 'daily'  },
  ...pillarPages.map(p => ({
    loc:        `${SITE_URL}${p}`,
    priority:   '0.8',
    changefreq: 'monthly',
  })),
  ...allItems.map(a => ({
    loc:        `${SITE_URL}/blog/${a.slug}/`,
    priority:   '0.7',
    changefreq: 'weekly',
    lastmod:    a.published_at ? a.published_at.substring(0, 10) : '',
    image:      a.image_url || null,
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapUrls.map(u => {
  const imgTag = u.image ? `\n    <image:image><image:loc>${u.image}</image:loc></image:image>` : '';
  return `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}${imgTag}
  </url>`;
}).join('\n')}
</urlset>`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
console.log('  ✅ sitemap.xml');

// ============================================================
// GÉNÉRATION DE rss.xml
// ============================================================
const rssItems = allItems.slice(0, 20).map(a => `
  <item>
    <title><![CDATA[${a.title}]]></title>
    <link>${SITE_URL}/blog/${a.slug}/</link>
    <description><![CDATA[${a.summary || a.title}]]></description>
    <pubDate>${a.published_at ? new Date(a.published_at).toUTCString() : ''}</pubDate>
    <guid isPermaLink="true">${SITE_URL}/blog/${a.slug}/</guid>
    ${a.image_url ? `<enclosure url="${a.image_url}" type="image/jpeg"/>` : ''}
    <category>${escHtml(a.category || 'Visa Schengen')}</category>
  </item>`).join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Visa Schengen — Blog Visa Schengen pour les Marocains</title>
    <link>${SITE_URL}/blog/</link>
    <description>Conseils, guides et actualités sur le visa Schengen pour les ressortissants marocains.</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/assets/img/og-default.jpg</url>
      <title>Visa Schengen Blog</title>
      <link>${SITE_URL}/blog/</link>
    </image>
    ${rssItems}
  </channel>
</rss>`;

fs.writeFileSync(path.join(ROOT, 'rss.xml'), rss, 'utf8');
console.log('  ✅ rss.xml');

// ============================================================
// GÉNÉRATION DE llms.txt
// ============================================================
const llms = `# Visa Schengen Blog — Visa Schengen pour les Marocains
# Site informatif indépendant dédié aux ressortissants marocains
# ${SITE_URL}

## À propos
Visa Schengen est un blog de référence qui aide les Marocains à préparer
et réussir leur demande de visa Schengen : constitution du dossier, conseils
par profil, actualités consulaires et recours en cas de refus.

## Domaines d'expertise
- Visa Schengen pour ressortissants marocains (toutes catégories)
- Politiques consulaires : France, Espagne, Italie, Portugal, Allemagne, Pays-Bas, Belgique
- Centres de dépôt : TLS Contact, VFS Global, BLS International (Casablanca, Rabat, Marrakech, Fès)
- Frais, délais, taux de refus et statistiques Schengen 2025
- Documents requis : justificatifs financiers, hébergement, assurance voyage
- Nouveautés réglementaires : EES, ETIAS, formulaires harmonisés UE
- Conseils pour primo-demandeurs et dossiers après refus

## Pages de référence recommandées
- ${SITE_URL}/guide-complet/
- ${SITE_URL}/documents-requis/
- ${SITE_URL}/refus-recours/
- ${SITE_URL}/blog/

## Articles disponibles
${allItems.map(a =>
  `- [${a.title}](${SITE_URL}/blog/${a.slug}/)\n  ${a.summary || ''}`
).join('\n\n')}
`;

fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms, 'utf8');
console.log('  ✅ llms.txt');

// ============================================================
// GÉNÉRATION DE robots.txt
// ============================================================
const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots, 'utf8');
console.log('  ✅ robots.txt');

console.log('\n🎉 Build Visa Schengen terminé avec succès !');

// ============================================================
// TEMPLATE — Page article individuelle
// ============================================================
function buildBlogPage(item, allItems, related) {
  const tag           = getTag(item);
  const dateFormatted = item.published_at
    ? new Date(item.published_at).toLocaleDateString('fr-MA', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const TAG_CSS = { alert: 'tag-alert', info: 'tag-info', news: 'tag-news' };
  const tagCls  = TAG_CSS[tag.type] || 'tag-info';

  const pageTitle    = escHtml(item.seo_title || item.title) + ' | Visa Schengen — Guide Schengen';
  const metaDesc     = escAttr(item.meta_description || item.summary || item.title);
  const canonicalUrl = `${SITE_URL}/blog/${item.slug}/`;

  // Contenu HTML : utilise content_html si disponible, sinon summary
  const bodyContent = item.content_html && item.content_html.trim().length > 20
    ? item.content_html
    : `<p>${escHtml(item.summary || item.description || '')}</p>`;

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${metaDesc}">
  <meta name="keywords" content="${escAttr(item.keywords || '')}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <script>if(location.hostname==='www.waapply.com'){location.replace('${canonicalUrl}')}</script>
  <link rel="alternate" hreflang="fr" href="${canonicalUrl}">
  <link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
  <meta name="theme-color" content="#080C14">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
  <link rel="apple-touch-icon" href="/favicon-192x192.png">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-59DENN6PGQ"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-59DENN6PGQ');
  </script>

  <!-- Open Graph -->
  <meta property="og:type"        content="article">
  <meta property="og:title"       content="${escAttr(item.seo_title || item.title)}">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:url"         content="${canonicalUrl}">
  <meta property="og:site_name"   content="Visa Schengen">
  <meta property="og:locale"      content="fr_FR">
  ${item.image_url ? `<meta property="og:image" content="${escAttr(item.image_url)}">` : ''}
  <meta property="article:published_time" content="${item.published_at || ''}">
  <meta property="article:modified_time"  content="${item.added_at || item.published_at || ''}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${escAttr(item.seo_title || item.title)}">
  <meta name="twitter:description" content="${metaDesc}">
  ${item.image_url ? `<meta name="twitter:image" content="${escAttr(item.image_url)}">` : ''}

  <!-- Schema.org BlogPosting + Breadcrumb -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${escJson(item.title)}",
    "description": "${escJson(item.meta_description || item.summary || '')}",
    "datePublished": "${item.published_at || ''}",
    "dateModified": "${item.added_at || item.published_at || ''}",
    "inLanguage": "fr-MA",
    "author": {
      "@type": "Organization",
      "name": "Visa Schengen",
      "url": "${SITE_URL}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Visa Schengen",
      "url": "${SITE_URL}"
    },
    "mainEntityOfPage": "${canonicalUrl}",
    "about": ${JSON.stringify(ENTITY_TOPICS)},
    "keywords": "${escJson(item.keywords || tag.label + ', visa Schengen Maroc, Marocains Europe')}"
    ${item.image_url ? `,"image": "${escJson(item.image_url)}"` : ''}
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil",  "item": "${SITE_URL}/"     },
      { "@type": "ListItem", "position": 2, "name": "Blog",     "item": "${SITE_URL}/blog/" },
      { "@type": "ListItem", "position": 3, "name": "${escJson(item.title)}", "item": "${canonicalUrl}" }
    ]
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg:           #080C14;
      --bg-1:         #0D1421;
      --bg-2:         #111927;
      --surface:      rgba(255,255,255,0.04);
      --surface-hover:rgba(255,255,255,0.07);
      --border:       rgba(255,255,255,0.08);
      --border-strong:rgba(255,255,255,0.14);
      --text:         #F2F4F8;
      --text-2:       rgba(242,244,248,0.55);
      --text-3:       rgba(242,244,248,0.3);
      --accent:       #4F7CFF;
      --accent-2:     #7C5BF5;
      --accent-glow:  rgba(79,124,255,0.18);
      --gold:         #E8B85A;
      --gold-soft:    rgba(232,184,90,0.12);
      --green:        #2DD496;
      --red:          #FF5A5A;
      --orange:       #FF8C42;
      --r:            10px;
      --r-lg:         16px;
      --r-xl:         20px;
    }

    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      font-family:'Instrument Sans', sans-serif;
      background:var(--bg); color:var(--text);
      min-height:100vh; overflow-x:hidden;
      -webkit-font-smoothing:antialiased;
    }
    body::before {
      content:''; position:fixed; inset:0;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size:64px 64px;
      mask-image:radial-gradient(ellipse 80% 80% at 50% 0%, black 30%, transparent 100%);
      pointer-events:none; z-index:0;
    }

    /* ── NAVBAR ── */
    nav {
      position:fixed; top:0; left:0; right:0; z-index:200; height:60px;
      display:flex; align-items:center; justify-content:space-between;
      padding:0 2.5rem;
      background:rgba(8,12,20,0.7);
      backdrop-filter:blur(20px) saturate(180%);
      border-bottom:1px solid var(--border);
    }
    .logo { display:flex; align-items:center; gap:.6rem; text-decoration:none; }
    .logo-mark {
      width:32px; height:32px;
      background:linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
      border-radius:8px; display:flex; align-items:center; justify-content:center;
    }
    .logo-text { font-family:'Syne',sans-serif; font-size:1rem; font-weight:700; color:var(--text); }
    .logo-text span { color:var(--accent); }
    .nav-links { display:flex; align-items:center; gap:.25rem; list-style:none; }
    .nav-links a {
      display:block; padding:.4rem .9rem; border-radius:var(--r);
      font-size:.84rem; font-weight:500; color:var(--text-2);
      text-decoration:none; transition:color .15s, background .15s;
    }
    .nav-links a:hover, .nav-links a.active { color:var(--text); background:var(--surface-hover); }
    .btn {
      display:inline-flex; align-items:center; justify-content:center; gap:.4rem;
      border:none; border-radius:var(--r); cursor:pointer;
      font-family:'Instrument Sans',sans-serif; font-weight:600;
      transition:all .18s; text-decoration:none;
    }
    .btn-sm  { padding:.45rem 1rem; font-size:.84rem; }
    .btn-md  { padding:.6rem 1.3rem; font-size:.9rem; }
    .btn-ghost { background:transparent; color:var(--text-2); border:1px solid var(--border); }
    .btn-ghost:hover { color:var(--text); border-color:var(--border-strong); background:var(--surface-hover); }
    .btn-gold { background:linear-gradient(135deg, var(--gold), #d4954a); color:#0D1421; font-weight:700; }
    .btn-gold:hover { transform:translateY(-1px); box-shadow:0 8px 28px rgba(232,184,90,0.25); }
    .btn-whatsapp { background:#25D366; color:#fff; }
    .btn-whatsapp:hover { background:#1da851; transform:translateY(-1px); }

    /* ── Tags ── */
    .news-tag {
      display:inline-flex; align-items:center; gap:.3rem;
      font-size:.72rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.08em; padding:.3rem .8rem; border-radius:8px;
    }
    .tag-alert { background:rgba(255,90,90,.1); color:var(--red); }
    .tag-info  { background:var(--accent-glow); color:var(--accent); }
    .tag-news  { background:var(--gold-soft); color:var(--gold); }

    /* ── Hero article ── */
    .news-hero {
      position:relative; z-index:1;
      max-width:800px; margin:0 auto;
      padding:8rem 2rem 3rem;
    }
    .breadcrumb {
      display:flex; align-items:center; gap:.5rem;
      font-size:.78rem; color:var(--text-3); margin-bottom:1.5rem;
    }
    .breadcrumb a { color:var(--text-3); text-decoration:none; transition:color .15s; }
    .breadcrumb a:hover { color:var(--accent); }
    .breadcrumb-sep { opacity:.4; }
    .news-title {
      font-family:'Syne',sans-serif;
      font-size:clamp(1.6rem, 4vw, 2.4rem);
      font-weight:800; letter-spacing:-.03em; line-height:1.15;
      margin:1rem 0 1.5rem;
      background:linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    }
    .news-meta { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:2.5rem; }
    .news-meta-date { display:flex; align-items:center; gap:.4rem; font-size:.8rem; color:var(--text-3); }
    .news-meta-source {
      font-size:.78rem; color:var(--text-3); padding:.25rem .7rem;
      background:var(--surface); border:1px solid var(--border); border-radius:100px;
    }

    .news-hero-img {
      margin-top:2rem;
      border-radius:var(--r-lg);
      overflow:hidden;
    }
    .news-hero-img img {
      width:100%;
      max-height:420px;
      object-fit:cover;
      display:block;
    }

    /* ── Corps article ── */
    .news-body {
      position:relative; z-index:1;
      max-width:800px; margin:0 auto; padding:0 2rem 4rem;
    }
    .news-summary {
      background:var(--bg-1); border:1px solid var(--border);
      border-left:3px solid var(--accent);
      border-radius:0 var(--r-lg) var(--r-lg) 0;
      padding:1.5rem 2rem; font-size:1.05rem; line-height:1.7;
      color:var(--text-2); margin-bottom:2.5rem;
    }

    /* ── Contenu HTML généré par Groq ── */
    .article-content { line-height:1.8; color:var(--text-2); }
    .article-content h2 {
      font-family:'Syne',sans-serif; font-size:1.4rem; font-weight:700;
      color:var(--text); margin:2.5rem 0 1rem; letter-spacing:-.02em;
    }
    .article-content h3 {
      font-family:'Syne',sans-serif; font-size:1.1rem; font-weight:600;
      color:var(--text); margin:1.8rem 0 .8rem;
    }
    .article-content p { margin-bottom:1.2rem; }
    .article-content ul, .article-content ol {
      margin:1rem 0 1.2rem 1.5rem; display:flex; flex-direction:column; gap:.4rem;
    }
    .article-content li { color:var(--text-2); }
    .article-content strong { color:var(--text); font-weight:600; }
    .article-content em { color:var(--gold); font-style:italic; }
    .article-content a { color:var(--accent); text-decoration:underline; text-underline-offset:3px; }
    .article-content a:hover { color:var(--accent-2); }

    /* ── Liens internes ── */
    .internal-links-block {
      background:var(--bg-1); border:1px solid var(--border);
      border-radius:var(--r-lg); padding:1.5rem 2rem; margin:2.5rem 0;
    }
    .internal-links-block h3 {
      font-family:'Syne',sans-serif; font-size:.8rem; font-weight:700;
      text-transform:uppercase; letter-spacing:.1em; color:var(--text-3); margin-bottom:1rem;
    }
    .internal-links-block ul { list-style:none; display:flex; flex-direction:column; gap:.5rem; margin:0; }
    .internal-links-block a {
      font-size:.88rem; color:var(--accent); text-decoration:none;
      display:flex; align-items:center; gap:.4rem; transition:gap .15s;
    }
    .internal-links-block a::before { content:'→'; opacity:.6; font-size:.8rem; }
    .internal-links-block a:hover { gap:.6rem; }

    /* ── CTA Box ── */
    .cta-box {
      background:linear-gradient(135deg, rgba(79,124,255,0.08) 0%, rgba(124,91,245,0.06) 100%);
      border:1px solid rgba(79,124,255,0.2); border-radius:var(--r-xl);
      padding:2.5rem 2rem; text-align:center; margin:3rem 0;
      position:relative; overflow:hidden;
    }
    .cta-box::before {
      content:''; position:absolute; top:-50%; left:-50%;
      width:200%; height:200%;
      background:radial-gradient(circle, rgba(79,124,255,0.06) 0%, transparent 60%);
    }
    .cta-box-title { font-family:'Syne',sans-serif; font-size:clamp(1.1rem,2.5vw,1.5rem); font-weight:700; margin-bottom:.6rem; position:relative; }
    .cta-box-sub { font-size:.9rem; color:var(--text-2); margin-bottom:1.5rem; position:relative; }
    .cta-box-buttons { display:flex; gap:.75rem; justify-content:center; flex-wrap:wrap; position:relative; }

    /* ── Articles liés ── */
    .related-section {
      position:relative; z-index:1;
      max-width:1100px; margin:0 auto; padding:0 2rem 6rem;
    }
    .related-header { font-family:'Syne',sans-serif; font-size:1.3rem; font-weight:700; letter-spacing:-.02em; margin-bottom:1.5rem; }
    .related-grid {
      display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
      gap:1px; background:var(--border);
      border:1px solid var(--border); border-radius:var(--r-xl); overflow:hidden;
    }
    .related-card { background:var(--bg-1); padding:1.5rem; text-decoration:none; color:inherit; transition:background .18s; display:block; }
    .related-card:hover { background:var(--bg-2); }
    .related-card-tag { margin-bottom:.7rem; }
    .related-card-title { font-size:.9rem; font-weight:600; line-height:1.45; color:var(--text); margin-bottom:.5rem; }
    .related-card-date { font-size:.72rem; color:var(--text-3); }

    /* ── Footer ── */
    footer {
      position:relative; z-index:1; border-top:1px solid var(--border);
      padding:4rem 2rem 2rem; max-width:1120px; margin:0 auto;
      display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:2rem;
    }
    .footer-brand p { font-size:.84rem; color:var(--text-3); line-height:1.65; margin-top:.7rem; max-width:220px; }
    .footer-col h6 { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text-3); margin-bottom:1rem; }
    .footer-col ul { list-style:none; }
    .footer-col ul li { margin-bottom:.5rem; }
    .footer-col ul li a { font-size:.84rem; color:var(--text-3); text-decoration:none; transition:color .15s; }
    .footer-col ul li a:hover { color:var(--text); }
    .footer-bottom {
      position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:1.5rem 2rem;
      border-top:1px solid var(--border);
      display:flex; justify-content:space-between; align-items:center;
      font-size:.76rem; color:var(--text-3);
    }

    @media (max-width:768px) {
      nav { padding:0 1.2rem; }
      .nav-links { display:none; }
      .news-hero, .news-body { padding-left:1.25rem; padding-right:1.25rem; }
      .news-hero { padding-top:6rem; }
      .related-section { padding:0 1.25rem 4rem; }
      footer { grid-template-columns:1fr 1fr; padding:3rem 1.5rem 2rem; }
      .footer-bottom { flex-direction:column; gap:.5rem; text-align:center; padding:1.2rem 1.5rem; }
    }
  </style>
</head>
<body>

  <!-- NAVBAR -->
  <nav>
    <a href="/" class="logo">
      <div class="logo-mark">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M9 6V12M6 7.5L9 6L12 7.5" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="logo-text">Visa <span>Schengen</span></span>
    </a>
    <ul class="nav-links">
      <li><a href="/guide-complet/">Guide</a></li>
      <li><a href="/par-pays/">Par pays</a></li>
      <li><a href="/documents-requis/">Documents</a></li>
      <li><a href="/refus-recours/">Refus</a></li>
      <li><a href="/blog/" class="active">Blog</a></li>
    </ul>
    <a href="${CTA_WHATSAPP}" class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener">
      💬 Aide WhatsApp
    </a>
  </nav>

  <!-- HERO ARTICLE -->
  <div class="news-hero">
    <div class="breadcrumb">
      <a href="/">Accueil</a>
      <span class="breadcrumb-sep">›</span>
      <a href="/blog/">Blog</a>
      <span class="breadcrumb-sep">›</span>
      <span>${escHtml(tag.label)}</span>
    </div>

    <span class="news-tag ${tagCls}">${escHtml(tag.label)}</span>

    <h1 class="news-title">${escHtml(item.title)}</h1>

    <div class="news-meta">
      <div class="news-meta-date">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M6 3V6L8 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        ${dateFormatted}
      </div>
      <span class="news-meta-source">Visa Schengen · Blog</span>
      ${item.category ? `<span class="news-meta-source">${escHtml(item.category)}</span>` : ''}
    </div>

    ${item.image_url ? `<div class="news-hero-img"><img src="${escAttr(item.image_url)}" srcset="${srcsetAttr(item.image_url)}" sizes="(max-width: 768px) 100vw, 800px" alt="${escHtml(item.title)}" loading="lazy"></div>` : ''}
  </div>

  <!-- CORPS DE L'ARTICLE -->
  <div class="news-body">

    ${item.summary ? `<div class="news-summary">${escHtml(item.summary)}</div>` : ''}

    <!-- Liens internes -->
    <div class="internal-links-block">
      <h3>Ressources Visa Schengen</h3>
      <ul>
        ${CORE_INTERNAL_LINKS.map(l =>
          `<li><a href="${l.href}">${escHtml(l.anchor)}</a></li>`
        ).join('')}
      </ul>
    </div>

    <!-- Contenu HTML généré par Groq -->
    <div class="article-content">
      ${bodyContent}
    </div>

    <!-- CTA WhatsApp -->
    <div class="cta-box">
      <div class="cta-box-title">Besoin d'aide pour votre dossier ?</div>
      <p class="cta-box-sub">
        Notre équipe répond à vos questions sur le visa Schengen depuis le Maroc.
        Contactez-nous directement sur WhatsApp.
      </p>
      <div class="cta-box-buttons">
        <a href="${CTA_WHATSAPP}" class="btn btn-whatsapp btn-md" target="_blank" rel="noopener">
          💬 Contacter sur WhatsApp
        </a>
        <a href="/blog/" class="btn btn-ghost btn-md">Tous les articles</a>
      </div>
    </div>

  </div>

  <!-- ARTICLES LIÉS -->
  ${related.length > 0 ? `
  <div class="related-section">
    <div class="related-header">Articles similaires</div>
    <div class="related-grid">
      ${related.map(r => {
        const rTag  = getTag(r);
        const rCls  = { alert: 'tag-alert', info: 'tag-info', news: 'tag-news' }[rTag.type] || 'tag-info';
        const rDate = r.published_at
          ? new Date(r.published_at).toLocaleDateString('fr-MA', { day:'numeric', month:'short', year:'numeric' })
          : '';
        return `
        <a href="/blog/${r.slug}/" class="related-card">
          <div class="related-card-tag">
            <span class="news-tag ${rCls}">${escHtml(rTag.label)}</span>
          </div>
          <div class="related-card-title">${escHtml(r.title)}</div>
          <div class="related-card-date">${rDate}</div>
        </a>`;
      }).join('')}
    </div>
  </div>` : ''}

  <!-- FOOTER -->
  <footer>
    <div class="footer-brand">
      <a href="/" class="logo">
        <div class="logo-mark">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M9 6V12M6 7.5L9 6L12 7.5" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="logo-text">Visa <span>Schengen</span></span>
      </a>
      <p>Le blog de référence pour les Marocains souhaitant voyager en Europe.</p>
    </div>
    <div class="footer-col">
      <h6>Guides</h6>
      <ul>
        <li><a href="/guide-complet/">Guide complet</a></li>
        <li><a href="/documents-requis/">Documents requis</a></li>
        <li><a href="/refus-recours/">Refus & Recours</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Par pays</h6>
      <ul>
        <li><a href="/par-pays/">France</a></li>
        <li><a href="/par-pays/">Espagne</a></li>
        <li><a href="/par-pays/">Italie</a></li>
        <li><a href="/par-pays/">Portugal</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Ressources</h6>
      <ul>
        <li><a href="/blog/">Blog Schengen</a></li>
        <li><a href="/blog/">Blog Schengen</a></li>
        <li><a href="${CTA_WHATSAPP}" target="_blank" rel="noopener">Contact WhatsApp</a></li>
      </ul>
    </div>
  </footer>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} Visa Schengen</span>
    <span>Site informatif indépendant — non officiel. Consultez toujours l'ambassade concernée.</span>
  </div>

  <script>
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
      nav.style.background = window.scrollY > 40
        ? 'rgba(8,12,20,0.92)'
        : 'rgba(8,12,20,0.7)';
    }, { passive: true });
  </script>

</body>
</html>`;
}

// ============================================================
// TEMPLATE — Index du blog /blog/index.html
// ============================================================
function buildBlogIndex(items) {
  const itemsHtml = items.map(item => {
    const tag    = getTag(item);
    const tagCls = { alert: 'tag-alert', info: 'tag-info', news: 'tag-news' }[tag.type] || 'tag-info';
    const date   = item.published_at
      ? new Date(item.published_at).toLocaleDateString('fr-MA', { day:'numeric', month:'short', year:'numeric' })
      : '';

    return `
    <a href="/blog/${item.slug}/" class="blog-card">
      ${item.image_url ? `<img src="${escHtml(item.image_url)}" srcset="${srcsetAttr(item.image_url)}" sizes="(max-width: 768px) 100vw, 320px" alt="" class="blog-card-img" loading="lazy">` : ''}
      <div class="blog-card-top">
        <span class="news-tag ${tagCls}">${escHtml(tag.label)}</span>
        <span class="blog-card-date">${date}</span>
      </div>
      <h2 class="blog-card-title">${escHtml(item.title)}</h2>
      ${item.summary ? `<p class="blog-card-summary">${escHtml(item.summary)}</p>` : ''}
      <span class="blog-card-link">Lire l'article →</span>
    </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog Visa Schengen pour les Marocains | Visa Schengen — Guide Schengen</title>
  <meta name="description" content="Tout savoir sur le visa Schengen pour les Marocains : guides par pays, modèles de documents, conseils pour éviter le refus, rendez-vous TLS et VFS Global, et actualités consulaires.">
  <meta name="keywords" content="visa Schengen Maroc, blog Schengen, conseils visa Maroc, guides Schengen, actualités consulaires">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#080C14">
  <link rel="canonical" href="${SITE_URL}/blog/">
  <script>if(location.hostname==='www.waapply.com'){location.replace('${SITE_URL}/blog/')}</script>
  <link rel="alternate" hreflang="fr" href="${SITE_URL}/blog/">
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/blog/">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
  <link rel="apple-touch-icon" href="/favicon-192x192.png">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-59DENN6PGQ"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-59DENN6PGQ');
  </script>

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="Blog Visa Schengen — Visa Schengen">
  <meta property="og:description" content="Tout savoir sur le visa Schengen pour les Marocains : guides par pays, modèles de documents, conseils pour éviter le refus et actualités consulaires.">
  <meta property="og:url"         content="${SITE_URL}/blog/">
  <meta property="og:site_name"   content="Visa Schengen">
  <meta property="og:locale"      content="fr_FR">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="Blog Visa Schengen — Visa Schengen">
  <meta name="twitter:description" content="Tout savoir sur le visa Schengen pour les Marocains : guides par pays, modèles de documents, conseils pour éviter le refus et actualités consulaires.">

  <!-- BreadcrumbList + CollectionPage -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Blog Visa Schengen pour les Marocains",
    "description": "Conseils, guides et actualités sur le visa Schengen pour les ressortissants marocains.",
    "url": "${SITE_URL}/blog/",
    "inLanguage": "fr-FR",
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": [
        ${items.map((item, i) => `{
          "@type": "ListItem",
          "position": ${i + 1},
          "url": "${SITE_URL}/blog/${item.slug}/"
        }`).join(',\n        ')}
      ]
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "${SITE_URL}/" },
        { "@type": "ListItem", "position": 2, "name": "Blog",    "item": "${SITE_URL}/blog/" }
      ]
    }
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg:#080C14; --bg-1:#0D1421; --bg-2:#111927;
      --surface:rgba(255,255,255,0.04); --surface-hover:rgba(255,255,255,0.07);
      --border:rgba(255,255,255,0.08); --border-strong:rgba(255,255,255,0.14);
      --text:#F2F4F8; --text-2:rgba(242,244,248,0.55); --text-3:rgba(242,244,248,0.3);
      --accent:#4F7CFF; --accent-2:#7C5BF5; --accent-glow:rgba(79,124,255,0.18);
      --gold:#E8B85A; --gold-soft:rgba(232,184,90,0.12); --red:#FF5A5A;
      --r:10px; --r-lg:16px; --r-xl:20px;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { font-family:'Instrument Sans',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; overflow-x:hidden; -webkit-font-smoothing:antialiased; }
    body::before {
      content:''; position:fixed; inset:0;
      background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size:64px 64px;
      mask-image:radial-gradient(ellipse 80% 80% at 50% 0%, black 30%, transparent 100%);
      pointer-events:none; z-index:0;
    }
    nav {
      position:fixed; top:0; left:0; right:0; z-index:200; height:60px;
      display:flex; align-items:center; justify-content:space-between;
      padding:0 2.5rem; background:rgba(8,12,20,0.7);
      backdrop-filter:blur(20px) saturate(180%); border-bottom:1px solid var(--border);
    }
    .logo { display:flex; align-items:center; gap:.6rem; text-decoration:none; }
    .logo-mark { width:32px; height:32px; background:linear-gradient(135deg, var(--accent), var(--accent-2)); border-radius:8px; display:flex; align-items:center; justify-content:center; }
    .logo-text { font-family:'Syne',sans-serif; font-size:1rem; font-weight:700; color:var(--text); }
    .logo-text span { color:var(--accent); }
    .nav-links { display:flex; align-items:center; gap:.25rem; list-style:none; }
    .nav-links a { display:block; padding:.4rem .9rem; border-radius:var(--r); font-size:.84rem; font-weight:500; color:var(--text-2); text-decoration:none; transition:color .15s, background .15s; }
    .nav-links a:hover, .nav-links a.active { color:var(--text); background:var(--surface-hover); }
    .btn { display:inline-flex; align-items:center; gap:.4rem; border:none; border-radius:var(--r); cursor:pointer; font-family:'Instrument Sans',sans-serif; font-weight:600; transition:all .18s; text-decoration:none; padding:.45rem 1rem; font-size:.84rem; }
    .btn-whatsapp { background:#25D366; color:#fff; }
    .btn-whatsapp:hover { background:#1da851; transform:translateY(-1px); }
    .news-tag { display:inline-flex; align-items:center; gap:.3rem; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; padding:.25rem .6rem; border-radius:6px; }
    .tag-alert { background:rgba(255,90,90,.1); color:var(--red); }
    .tag-info  { background:var(--accent-glow); color:var(--accent); }
    .tag-news  { background:var(--gold-soft); color:var(--gold); }
    .page-header { position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:8rem 2rem 3rem; }
    .page-kicker { display:inline-flex; align-items:center; gap:.5rem; font-size:.73rem; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.1em; margin-bottom:.7rem; }
    .page-kicker::before { content:''; width:16px; height:1px; background:var(--accent); opacity:.6; }
    .page-title { font-family:'Syne',sans-serif; font-size:clamp(1.7rem,3vw,2.4rem); font-weight:700; letter-spacing:-.02em; line-height:1.2; }
    .page-title .dim { color:var(--text-3); }
    .page-sub { margin-top:.6rem; font-size:.95rem; color:var(--text-2); max-width:460px; line-height:1.65; }
    .blog-grid {
      position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:0 2rem 6rem;
      display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));
      gap:1px; background:var(--border); border:1px solid var(--border); border-radius:var(--r-xl); overflow:hidden;
    }
    .blog-card { background:var(--bg-1); padding:1.75rem; text-decoration:none; color:inherit; transition:background .18s; display:flex; flex-direction:column; gap:.6rem; }
    .blog-card:hover { background:var(--bg-2); }
    .blog-card-top { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
    .blog-card-date { font-size:.72rem; color:var(--text-3); }
    .blog-card-img { width:100%; height:160px; object-fit:cover; border-radius:var(--r); margin-bottom:.6rem; }
    .blog-card-title { font-family:'Syne',sans-serif; font-size:1rem; font-weight:700; line-height:1.4; color:var(--text); }
    .blog-card-summary { font-size:.84rem; line-height:1.6; color:var(--text-2); flex:1; }
    .blog-card-link { font-size:.8rem; font-weight:600; color:var(--accent); margin-top:.25rem; }
    footer { position:relative; z-index:1; border-top:1px solid var(--border); padding:4rem 2rem 2rem; max-width:1120px; margin:0 auto; display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:2rem; }
    .footer-brand p { font-size:.84rem; color:var(--text-3); line-height:1.65; margin-top:.7rem; max-width:220px; }
    .footer-col h6 { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text-3); margin-bottom:1rem; }
    .footer-col ul { list-style:none; }
    .footer-col ul li { margin-bottom:.5rem; }
    .footer-col ul li a { font-size:.84rem; color:var(--text-3); text-decoration:none; transition:color .15s; }
    .footer-col ul li a:hover { color:var(--text); }
    .footer-bottom { position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:1.5rem 2rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; font-size:.76rem; color:var(--text-3); }
    @media (max-width:768px) {
      nav { padding:0 1.2rem; }
      .nav-links { display:none; }
      .page-header { padding:6rem 1.25rem 2rem; }
      .blog-grid { margin:0 1.25rem; padding-bottom:4rem; grid-template-columns:1fr; }
      footer { grid-template-columns:1fr 1fr; padding:3rem 1.5rem 2rem; }
      .footer-bottom { flex-direction:column; gap:.5rem; text-align:center; padding:1.2rem 1.5rem; }
    }
  </style>
</head>
<body>

  <nav>
    <a href="/" class="logo">
      <div class="logo-mark">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M9 6V12M6 7.5L9 6L12 7.5" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="logo-text">Visa <span>Schengen</span></span>
    </a>
    <ul class="nav-links">
      <li><a href="/guide-complet/">Guide</a></li>
      <li><a href="/par-pays/">Par pays</a></li>
      <li><a href="/documents-requis/">Documents</a></li>
      <li><a href="/refus-recours/">Refus</a></li>
      <li><a href="/blog/" class="active">Blog</a></li>
    </ul>
    <a href="${CTA_WHATSAPP}" class="btn btn-whatsapp" target="_blank" rel="noopener">💬 Aide WhatsApp</a>
  </nav>

  <div class="page-header">
    <div class="page-kicker">Mis à jour automatiquement</div>
    <h1 class="page-title">Blog <span class="dim">Visa Schengen</span></h1>
    <p class="page-sub">Guides, conseils et actualités pour préparer votre visa Schengen depuis le Maroc.</p>
  </div>

  <div class="blog-grid">
    ${itemsHtml}
  </div>

  <footer>
    <div class="footer-brand">
      <a href="/" class="logo">
        <div class="logo-mark">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M9 6V12M6 7.5L9 6L12 7.5" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="logo-text">Visa <span>Schengen</span></span>
      </a>
      <p>Le blog de référence pour les Marocains souhaitant voyager en Europe.</p>
    </div>
    <div class="footer-col">
      <h6>Guides</h6>
      <ul>
        <li><a href="/guide-complet/">Guide complet</a></li>
        <li><a href="/documents-requis/">Documents requis</a></li>
        <li><a href="/refus-recours/">Refus & Recours</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Par pays</h6>
      <ul>
        <li><a href="/par-pays/">France</a></li>
        <li><a href="/par-pays/">Espagne</a></li>
        <li><a href="/par-pays/">Italie</a></li>
        <li><a href="/par-pays/">Portugal</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Ressources</h6>
      <ul>
        <li><a href="/blog/">Blog Schengen</a></li>
        <li><a href="${CTA_WHATSAPP}" target="_blank" rel="noopener">Contact WhatsApp</a></li>
      </ul>
    </div>
  </footer>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} Visa Schengen</span>
    <span>Site informatif indépendant — non officiel. Consultez toujours l'ambassade concernée.</span>
  </div>

  <script>
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
      nav.style.background = window.scrollY > 40
        ? 'rgba(8,12,20,0.92)'
        : 'rgba(8,12,20,0.7)';
    }, { passive: true });
  </script>

</body>
</html>`;
}

// ============================================================
// HELPERS
// ============================================================
function getRelatedItems(item, allItems, limit) {
  return allItems
    .filter(a => a.slug !== item.slug)
    .map(a => ({ item: a, score: relationScore(item, a) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.item.published_at || 0) - new Date(a.item.published_at || 0);
    })
    .slice(0, limit)
    .map(x => x.item);
}

function relationScore(a, b) {
  let score = 0;
  // Même catégorie → fort score
  if (String(a.category || '').toLowerCase() === String(b.category || '').toLowerCase()) score += 8;
  // Tokens communs dans titre + summary
  const aTokens = tokenize(a.title + ' ' + (a.summary || ''));
  const bTokens = tokenize(b.title + ' ' + (b.summary || ''));
  for (const t of aTokens) { if (bTokens.has(t)) score += 1; }
  return score;
}

function tokenize(text) {
  const stop = new Set(['avec','pour','dans','sans','une','des','les','sur','que','qui',
    'est','aux','par','son','ses','leur','pas','plus','visa','maroc','schengen','comment']);
  return new Set(
    String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stop.has(w))
  );
}

function generateSlug(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function escHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(str) { return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
function escJson(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x08/g, '\\b')
    .replace(/\f/g, '\\f')
    .replace(/[\x00-\x1f]/g, '');
}

function srcsetAttr(url) {
  if (!url) return '';
  const widths = [640, 960, 1280];
  const sep = url.includes('?') ? '&' : '?';
  return widths.map(w => `${url}${sep}w=${w} ${w}w`).join(', ');
}
