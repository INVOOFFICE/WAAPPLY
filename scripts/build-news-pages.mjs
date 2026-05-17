// ============================================================
// VISAPATH — Build News Pages
// scripts/build-news-pages.mjs
//
// Génère à partir de news.json :
//   actualites/<slug>/index.html  → page détail de chaque actualité
//   actualites/index.html          → index de toutes les actualités
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

// ── Adapter ce chemin selon ton arborescence ──
// Si le script est dans  visapath/scripts/build-news-pages.mjs
// et que le site est dans visapath/
const ROOT     = path.resolve(__dirname, '..');
const SITE_URL = 'https://visapath.ma';

// Liens internes vers les sections clés du site VisaPath
const CORE_INTERNAL_LINKS = [
  { href: '/#evaluateur', anchor: 'Évaluer mon dossier Schengen' },
  { href: '/#pays',       anchor: 'Taux d\'acceptation par pays' },
  { href: '/#outils',     anchor: 'Outils visa Schengen gratuits' },
  { href: '/actualites/', anchor: 'Toutes les actualités Schengen' },
];

// Entités sémantiques pour le schema.org et llms.txt
const ENTITY_TOPICS = [
  'visa Schengen Maroc',
  'consulat France Maroc',
  'consulat Espagne Maroc',
  'consulat Italie Maroc',
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

// ============================================================
// LECTURE DE news.json
// ============================================================
const newsJsonPath = path.join(ROOT, 'news.json');
if (!fs.existsSync(newsJsonPath)) {
  console.error('❌ news.json introuvable à : ' + newsJsonPath);
  console.log('   Lance d\'abord le Google Apps Script pour générer news.json.');
  process.exit(0);
}

const newsData = JSON.parse(fs.readFileSync(newsJsonPath, 'utf8'));

// news.json a la structure : { generated_at, main, items, all }
// On travaille sur "all" pour construire les pages
const allItems = (newsData.all || []).filter(a => a.status === 'published');

// Ajouter un slug à chaque item s'il n'en a pas
allItems.forEach(item => {
  if (!item.slug) {
    item.slug = generateSlug(item.title);
  }
});

console.log(`📰 ${allItems.length} actualité(s) à traiter...`);

// ============================================================
// GÉNÉRATION DES PAGES INDIVIDUELLES — actualites/<slug>/
// ============================================================
const actualitesDir = path.join(ROOT, 'actualites');
fs.mkdirSync(actualitesDir, { recursive: true });

for (const item of allItems) {
  const dir = path.join(actualitesDir, item.slug);
  fs.mkdirSync(dir, { recursive: true });

  const related = getRelatedItems(item, allItems, 3);
  const html    = buildNewsPage(item, allItems, related);
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log(`  ✅ actualites/${item.slug}/index.html`);
}

// ============================================================
// GÉNÉRATION DE L'INDEX — actualites/index.html
// ============================================================
const indexHtml = buildNewsIndex(allItems);
fs.writeFileSync(path.join(actualitesDir, 'index.html'), indexHtml, 'utf8');
console.log('  ✅ actualites/index.html');

// ============================================================
// GÉNÉRATION DE sitemap.xml
// ============================================================
const sitemapUrls = [
  { loc: `${SITE_URL}/`,             priority: '1.0', changefreq: 'weekly'  },
  { loc: `${SITE_URL}/actualites/`,  priority: '0.9', changefreq: 'daily'   },
  ...allItems.map(a => ({
    loc:        `${SITE_URL}/actualites/${a.slug}/`,
    priority:   '0.7',
    changefreq: 'weekly',
    lastmod:    a.published_at ? a.published_at.substring(0, 10) : '',
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
console.log('  ✅ sitemap.xml');

// ============================================================
// GÉNÉRATION DE llms.txt
// ============================================================
const llms = `# VisaPath — Actualités Schengen pour les Marocains
# Plateforme de guide visa Schengen dédiée aux ressortissants marocains
# ${SITE_URL}

## À propos
VisaPath est la plateforme marocaine de référence pour les demandes de visa Schengen.
Elle propose des outils gratuits (évaluateur de dossier, checklist, simulateur de délais),
des guides pays détaillés, et un suivi en temps réel des actualités consulaires.

## Entité
VisaPath guide les Marocains à chaque étape de leur demande de visa Schengen :
préparation du dossier, choix du consulat, prise de rendez-vous VFS/BLS,
et suivi des politiques consulaires en vigueur.

## Domaines d'expertise
- Visa Schengen pour ressortissants marocains
- Politiques consulaires : France, Espagne, Italie, Portugal, Allemagne, Pays-Bas, Belgique
- Centres de dépôt : VFS Global, BLS International (Casablanca, Rabat, Marrakech, Fès)
- Frais, délais, taux d'acceptation et statistiques Schengen
- Documents requis : justificatifs financiers, hébergement, assurance voyage
- Nouveautés réglementaires : EES, ETIAS, formulaires harmonisés UE
- Conseils pour primo-demandeurs et dossiers après refus

## Pages de référence recommandées
- ${SITE_URL}/#evaluateur
- ${SITE_URL}/#pays
- ${SITE_URL}/#outils
- ${SITE_URL}/actualites/

## Actualités disponibles
${allItems.map(a =>
  `- [${a.title}](${SITE_URL}/actualites/${a.slug}/)\n  ${a.summary || ''}`
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

console.log('\n🎉 Build VisaPath terminé avec succès !');

// ============================================================
// TEMPLATE — Page actualité individuelle
// ============================================================
function buildNewsPage(item, allItems, related) {
  const dateFormatted = item.published_at
    ? new Date(item.published_at).toLocaleDateString('fr-MA', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const TAG_CFG = {
    alert: { cls: 'tag-alert', label: item.tag_label || 'Important' },
    info:  { cls: 'tag-info',  label: item.tag_label || 'Info'      },
    news:  { cls: 'tag-news',  label: item.tag_label || 'Nouveauté' },
  };
  const tag = TAG_CFG[item.tag_type] || TAG_CFG['info'];

  const pageTitle    = escHtml(item.title) + ' — VisaPath';
  const metaDesc     = escAttr(item.summary || item.title);
  const canonicalUrl = `${SITE_URL}/actualites/${item.slug}/`;

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${metaDesc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph -->
  <meta property="og:type"        content="article">
  <meta property="og:title"       content="${escAttr(item.title)}">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:url"         content="${canonicalUrl}">
  <meta property="og:site_name"   content="VisaPath">
  <meta property="article:published_time" content="${item.published_at || ''}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary">
  <meta name="twitter:title"       content="${escAttr(item.title)}">
  <meta name="twitter:description" content="${metaDesc}">

  <!-- Schema.org NewsArticle + Breadcrumb -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "${escJson(item.title)}",
    "description": "${escJson(item.summary || item.title)}",
    "datePublished": "${item.published_at || ''}",
    "dateModified": "${item.published_at || ''}",
    "inLanguage": "fr-MA",
    "author": {
      "@type": "Organization",
      "name": "VisaPath",
      "url": "${SITE_URL}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "VisaPath",
      "url": "${SITE_URL}"
    },
    "mainEntityOfPage": "${canonicalUrl}",
    "about": ${JSON.stringify(ENTITY_TOPICS)},
    "keywords": "${escJson(item.tag_label || '')}, visa Schengen Maroc, Marocains Europe"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil",    "item": "${SITE_URL}/"            },
      { "@type": "ListItem", "position": 2, "name": "Actualités", "item": "${SITE_URL}/actualites/" },
      { "@type": "ListItem", "position": 3, "name": "${escJson(item.title)}", "item": "${canonicalUrl}" }
    ]
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">

  <style>
    /* ── Design tokens (copie de visapath-modern.html) ── */
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
      background:var(--bg);
      color:var(--text);
      min-height:100vh;
      overflow-x:hidden;
      -webkit-font-smoothing:antialiased;
    }

    body::before {
      content:'';
      position:fixed; inset:0;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size:64px 64px;
      mask-image:radial-gradient(ellipse 80% 80% at 50% 0%, black 30%, transparent 100%);
      pointer-events:none; z-index:0;
    }

    /* ── NAVBAR ── */
    nav {
      position:fixed; top:0; left:0; right:0; z-index:200;
      height:60px;
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
      border-radius:8px;
      display:flex; align-items:center; justify-content:center;
    }
    .logo-text {
      font-family:'Syne', sans-serif;
      font-size:1rem; font-weight:700;
      letter-spacing:-0.01em; color:var(--text);
    }
    .logo-text span { color:var(--accent); }
    .nav-links { display:flex; align-items:center; gap:.25rem; list-style:none; }
    .nav-links a {
      display:block; padding:.4rem .9rem; border-radius:var(--r);
      font-size:.84rem; font-weight:500; color:var(--text-2);
      text-decoration:none; transition:color .15s, background .15s;
    }
    .nav-links a:hover { color:var(--text); background:var(--surface-hover); }
    .btn {
      display:inline-flex; align-items:center; justify-content:center; gap:.4rem;
      border:none; border-radius:var(--r); cursor:pointer;
      font-family:'Instrument Sans', sans-serif; font-weight:600;
      transition:all .18s; text-decoration:none;
    }
    .btn-sm  { padding:.45rem 1rem; font-size:.84rem; }
    .btn-md  { padding:.6rem 1.3rem; font-size:.9rem; }
    .btn-lg  { padding:.8rem 1.8rem; font-size:.95rem; }
    .btn-ghost {
      background:transparent; color:var(--text-2); border:1px solid var(--border);
    }
    .btn-ghost:hover { color:var(--text); border-color:var(--border-strong); background:var(--surface-hover); }
    .btn-primary {
      background:linear-gradient(135deg, var(--accent), var(--accent-2)); color:#fff;
    }
    .btn-primary:hover { transform:translateY(-1px); box-shadow:0 8px 24px var(--accent-glow); }
    .btn-gold {
      background:linear-gradient(135deg, var(--gold), #d4954a); color:#0D1421; font-weight:700;
    }
    .btn-gold:hover { transform:translateY(-1px); box-shadow:0 8px 28px rgba(232,184,90,0.25); }

    /* ── Tags ── */
    .news-tag {
      display:inline-flex; align-items:center; gap:.3rem;
      font-size:.72rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.08em; padding:.3rem .8rem; border-radius:8px;
    }
    .tag-alert { background:rgba(255,90,90,.1); color:var(--red); }
    .tag-info  { background:var(--accent-glow); color:var(--accent); }
    .tag-news  { background:var(--gold-soft); color:var(--gold); }

    /* ── Page Article ── */
    .news-hero {
      position:relative; z-index:1;
      max-width:800px; margin:0 auto;
      padding:8rem 2rem 3rem;
    }
    .breadcrumb {
      display:flex; align-items:center; gap:.5rem;
      font-size:.78rem; color:var(--text-3);
      margin-bottom:1.5rem;
    }
    .breadcrumb a { color:var(--text-3); text-decoration:none; transition:color .15s; }
    .breadcrumb a:hover { color:var(--accent); }
    .breadcrumb-sep { opacity:.4; }

    .news-title {
      font-family:'Syne', sans-serif;
      font-size:clamp(1.6rem, 4vw, 2.4rem);
      font-weight:800;
      letter-spacing:-.03em;
      line-height:1.15;
      margin:1rem 0 1.5rem;
      background:linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      background-clip:text;
    }

    .news-meta {
      display:flex; align-items:center; gap:1rem;
      flex-wrap:wrap; margin-bottom:2.5rem;
    }
    .news-meta-date {
      display:flex; align-items:center; gap:.4rem;
      font-size:.8rem; color:var(--text-3);
    }
    .news-meta-source {
      font-size:.78rem; color:var(--text-3);
      padding:.25rem .7rem;
      background:var(--surface); border:1px solid var(--border);
      border-radius:100px;
    }

    .news-body {
      position:relative; z-index:1;
      max-width:800px; margin:0 auto;
      padding:0 2rem 4rem;
    }
    .news-summary {
      background:var(--bg-1);
      border:1px solid var(--border);
      border-left:3px solid var(--accent);
      border-radius:0 var(--r-lg) var(--r-lg) 0;
      padding:1.5rem 2rem;
      font-size:1.05rem;
      line-height:1.7;
      color:var(--text-2);
      margin-bottom:2.5rem;
    }

    /* Liens internes */
    .internal-links-block {
      background:var(--bg-1);
      border:1px solid var(--border);
      border-radius:var(--r-lg);
      padding:1.5rem 2rem;
      margin:2.5rem 0;
    }
    .internal-links-block h3 {
      font-family:'Syne', sans-serif;
      font-size:.8rem; font-weight:700;
      text-transform:uppercase; letter-spacing:.1em;
      color:var(--text-3); margin-bottom:1rem;
    }
    .internal-links-block ul { list-style:none; display:flex; flex-direction:column; gap:.5rem; }
    .internal-links-block a {
      font-size:.88rem; color:var(--accent); text-decoration:none;
      display:flex; align-items:center; gap:.4rem;
      transition:gap .15s;
    }
    .internal-links-block a::before { content:'→'; opacity:.6; font-size:.8rem; }
    .internal-links-block a:hover { gap:.6rem; }

    /* ── CTA Box ── */
    .cta-box {
      background:linear-gradient(135deg, rgba(79,124,255,0.08) 0%, rgba(124,91,245,0.06) 100%);
      border:1px solid rgba(79,124,255,0.2);
      border-radius:var(--r-xl);
      padding:2.5rem 2rem;
      text-align:center;
      margin:3rem 0;
      position:relative; overflow:hidden;
    }
    .cta-box::before {
      content:''; position:absolute; top:-50%; left:-50%;
      width:200%; height:200%;
      background:radial-gradient(circle, rgba(79,124,255,0.06) 0%, transparent 60%);
    }
    .cta-box-title {
      font-family:'Syne', sans-serif;
      font-size:clamp(1.1rem, 2.5vw, 1.5rem);
      font-weight:700; margin-bottom:.6rem; position:relative;
    }
    .cta-box-sub {
      font-size:.9rem; color:var(--text-2);
      margin-bottom:1.5rem; position:relative;
    }
    .cta-box-buttons {
      display:flex; gap:.75rem; justify-content:center;
      flex-wrap:wrap; position:relative;
    }

    /* ── Actualités liées ── */
    .related-section {
      position:relative; z-index:1;
      max-width:1100px; margin:0 auto;
      padding:0 2rem 6rem;
    }
    .related-header {
      font-family:'Syne', sans-serif;
      font-size:1.3rem; font-weight:700;
      letter-spacing:-.02em; margin-bottom:1.5rem;
    }
    .related-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
      gap:1px;
      background:var(--border);
      border:1px solid var(--border);
      border-radius:var(--r-xl);
      overflow:hidden;
    }
    .related-card {
      background:var(--bg-1);
      padding:1.5rem;
      text-decoration:none; color:inherit;
      transition:background .18s;
      display:block;
    }
    .related-card:hover { background:var(--bg-2); }
    .related-card-tag { margin-bottom:.7rem; }
    .related-card-title {
      font-size:.9rem; font-weight:600;
      line-height:1.45; color:var(--text);
      margin-bottom:.5rem;
    }
    .related-card-date { font-size:.72rem; color:var(--text-3); }

    /* ── Footer ── */
    footer {
      position:relative; z-index:1;
      border-top:1px solid var(--border);
      padding:4rem 2rem 2rem;
      max-width:1120px; margin:0 auto;
      display:grid;
      grid-template-columns:2fr 1fr 1fr 1fr;
      gap:2rem;
    }
    .footer-brand p { font-size:.84rem; color:var(--text-3); line-height:1.65; margin-top:.7rem; max-width:220px; }
    .footer-col h6 {
      font-size:.72rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.1em; color:var(--text-3); margin-bottom:1rem;
    }
    .footer-col ul { list-style:none; }
    .footer-col ul li { margin-bottom:.5rem; }
    .footer-col ul li a { font-size:.84rem; color:var(--text-3); text-decoration:none; transition:color .15s; }
    .footer-col ul li a:hover { color:var(--text); }
    .footer-bottom {
      position:relative; z-index:1;
      max-width:1120px; margin:0 auto;
      padding:1.5rem 2rem;
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
      <span class="logo-text">Visa<span>Path</span></span>
    </a>
    <ul class="nav-links">
      <li><a href="/#evaluateur">Évaluateur</a></li>
      <li><a href="/#pays">Destinations</a></li>
      <li><a href="/#outils">Outils</a></li>
      <li><a href="/actualites/">Actualités</a></li>
    </ul>
    <div style="display:flex;gap:.5rem;align-items:center;">
      <a href="/#evaluateur" class="btn btn-gold btn-sm">Évaluer mon dossier</a>
    </div>
  </nav>

  <!-- HERO ARTICLE -->
  <div class="news-hero">
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <a href="/">Accueil</a>
      <span class="breadcrumb-sep">›</span>
      <a href="/actualites/">Actualités</a>
      <span class="breadcrumb-sep">›</span>
      <span>${escHtml(item.tag_label || 'Info')}</span>
    </div>

    <span class="news-tag ${tag.cls}">${escHtml(tag.label)}</span>

    <h1 class="news-title">${escHtml(item.title)}</h1>

    <div class="news-meta">
      <div class="news-meta-date">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M6 3V6L8 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        ${dateFormatted}
      </div>
      <span class="news-meta-source">VisaPath · Actualités Schengen</span>
    </div>
  </div>

  <!-- CORPS DE L'ARTICLE -->
  <div class="news-body">

    <!-- Résumé mis en avant -->
    ${item.summary ? `<div class="news-summary">${escHtml(item.summary)}</div>` : ''}

    <!-- Liens internes VisaPath -->
    <div class="internal-links-block">
      <h3>Outils & ressources VisaPath</h3>
      <ul>
        ${CORE_INTERNAL_LINKS.map(l =>
          `<li><a href="${l.href}">${escHtml(l.anchor)}</a></li>`
        ).join('')}
      </ul>
    </div>

    <!-- CTA évaluateur -->
    <div class="cta-box">
      <div class="cta-box-title">Vérifiez vos chances avant de déposer</div>
      <p class="cta-box-sub">
        Utilisez notre évaluateur gratuit pour analyser votre dossier Schengen en 3 minutes
        et obtenir des conseils personnalisés.
      </p>
      <div class="cta-box-buttons">
        <a href="/#evaluateur" class="btn btn-gold btn-md">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M7 4.5V7L9 8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          Évaluer mon dossier
        </a>
        <a href="/actualites/" class="btn btn-ghost btn-md">Toutes les actualités</a>
      </div>
    </div>

  </div>

  <!-- ACTUALITÉS LIÉES -->
  ${related.length > 0 ? `
  <div class="related-section">
    <div class="related-header">Actualités similaires</div>
    <div class="related-grid">
      ${related.map(r => {
        const rTag = { alert: 'tag-alert', info: 'tag-info', news: 'tag-news' }[r.tag_type] || 'tag-info';
        const rDate = r.published_at
          ? new Date(r.published_at).toLocaleDateString('fr-MA', { day: 'numeric', month: 'short', year: 'numeric' })
          : '';
        return `
        <a href="/actualites/${r.slug}/" class="related-card">
          <div class="related-card-tag">
            <span class="news-tag ${rTag}">${escHtml(r.tag_label || 'Info')}</span>
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
        <span class="logo-text">Visa<span>Path</span></span>
      </a>
      <p>La plateforme de référence pour les Marocains souhaitant voyager en Europe.</p>
    </div>
    <div class="footer-col">
      <h6>Outils</h6>
      <ul>
        <li><a href="/#evaluateur">Évaluateur</a></li>
        <li><a href="/#outils">Checklist</a></li>
        <li><a href="/#outils">Simulateur</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Destinations</h6>
      <ul>
        <li><a href="/#pays">France</a></li>
        <li><a href="/#pays">Espagne</a></li>
        <li><a href="/#pays">Italie</a></li>
        <li><a href="/#pays">Portugal</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Ressources</h6>
      <ul>
        <li><a href="/actualites/">Actualités Schengen</a></li>
        <li><a href="/#faq">FAQ visa Maroc</a></li>
        <li><a href="/#evaluateur">Évaluation gratuite</a></li>
      </ul>
    </div>
  </footer>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} VisaPath Maroc</span>
    <span>Outil indicatif — non officiel. Consultez toujours l'ambassade concernée.</span>
  </div>

  <script>
    // Navbar scroll opacity
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
// TEMPLATE — Index des actualités /actualites/index.html
// ============================================================
function buildNewsIndex(items) {
  const TAG_CFG = {
    alert: 'tag-alert',
    info:  'tag-info',
    news:  'tag-news',
  };

  const itemsHtml = items.map(item => {
    const tagCls = TAG_CFG[item.tag_type] || 'tag-info';
    const date   = item.published_at
      ? new Date(item.published_at).toLocaleDateString('fr-MA', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : '';

    return `
    <a href="/actualites/${item.slug}/" class="news-card">
      <div class="news-card-top">
        <span class="news-tag ${tagCls}">${escHtml(item.tag_label || 'Info')}</span>
        <span class="news-card-date">${date}</span>
      </div>
      <h2 class="news-card-title">${escHtml(item.title)}</h2>
      ${item.summary ? `<p class="news-card-summary">${escHtml(item.summary)}</p>` : ''}
      <span class="news-card-link">Lire →</span>
    </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actualités Schengen pour les Marocains — VisaPath</title>
  <meta name="description" content="Suivez les dernières actualités sur les politiques Schengen, les changements consulaires et les informations visa pour les ressortissants marocains.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${SITE_URL}/actualites/">
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="Actualités Schengen — VisaPath">
  <meta property="og:description" content="Les dernières informations visa Schengen pour les Marocains.">
  <meta property="og:url"         content="${SITE_URL}/actualites/">
  <meta property="og:site_name"   content="VisaPath">

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
      --gold:#E8B85A; --gold-soft:rgba(232,184,90,0.12);
      --red:#FF5A5A; --r:10px; --r-lg:16px; --r-xl:20px;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
      font-family:'Instrument Sans', sans-serif;
      background:var(--bg); color:var(--text);
      min-height:100vh; overflow-x:hidden; -webkit-font-smoothing:antialiased;
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

    /* Navbar */
    nav {
      position:fixed; top:0; left:0; right:0; z-index:200; height:60px;
      display:flex; align-items:center; justify-content:space-between;
      padding:0 2.5rem; background:rgba(8,12,20,0.7);
      backdrop-filter:blur(20px) saturate(180%); border-bottom:1px solid var(--border);
    }
    .logo { display:flex; align-items:center; gap:.6rem; text-decoration:none; }
    .logo-mark {
      width:32px; height:32px;
      background:linear-gradient(135deg, var(--accent), var(--accent-2));
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
      display:inline-flex; align-items:center; gap:.4rem;
      border:none; border-radius:var(--r); cursor:pointer;
      font-family:'Instrument Sans',sans-serif; font-weight:600;
      transition:all .18s; text-decoration:none;
      padding:.45rem 1rem; font-size:.84rem;
    }
    .btn-gold { background:linear-gradient(135deg, var(--gold), #d4954a); color:#0D1421; }
    .btn-gold:hover { transform:translateY(-1px); box-shadow:0 8px 28px rgba(232,184,90,0.25); }

    /* Tags */
    .news-tag {
      display:inline-flex; align-items:center; gap:.3rem;
      font-size:.7rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.08em; padding:.25rem .6rem; border-radius:6px;
    }
    .tag-alert { background:rgba(255,90,90,.1); color:var(--red); }
    .tag-info  { background:var(--accent-glow); color:var(--accent); }
    .tag-news  { background:var(--gold-soft); color:var(--gold); }

    /* Page header */
    .page-header {
      position:relative; z-index:1;
      max-width:1120px; margin:0 auto;
      padding:8rem 2rem 3rem;
    }
    .page-kicker {
      display:inline-flex; align-items:center; gap:.5rem;
      font-size:.73rem; font-weight:600; color:var(--accent);
      text-transform:uppercase; letter-spacing:.1em; margin-bottom:.7rem;
    }
    .page-kicker::before { content:''; width:16px; height:1px; background:var(--accent); opacity:.6; }
    .page-title {
      font-family:'Syne', sans-serif;
      font-size:clamp(1.7rem, 3vw, 2.4rem);
      font-weight:700; letter-spacing:-.02em; line-height:1.2;
    }
    .page-title .dim { color:var(--text-3); }
    .page-sub { margin-top:.6rem; font-size:.95rem; color:var(--text-2); max-width:460px; line-height:1.65; }

    /* Grid d'actualités */
    .news-grid {
      position:relative; z-index:1;
      max-width:1120px; margin:0 auto;
      padding:0 2rem 6rem;
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));
      gap:1px;
      background:var(--border);
      border:1px solid var(--border);
      border-radius:var(--r-xl);
      overflow:hidden;
    }
    .news-card {
      background:var(--bg-1);
      padding:1.75rem;
      text-decoration:none; color:inherit;
      transition:background .18s;
      display:flex; flex-direction:column; gap:.6rem;
    }
    .news-card:hover { background:var(--bg-2); }
    .news-card-top {
      display:flex; align-items:center;
      justify-content:space-between; gap:.5rem;
    }
    .news-card-date { font-size:.72rem; color:var(--text-3); }
    .news-card-title {
      font-family:'Syne', sans-serif;
      font-size:1rem; font-weight:700;
      line-height:1.4; color:var(--text);
    }
    .news-card-summary {
      font-size:.84rem; line-height:1.6; color:var(--text-2);
      flex:1;
    }
    .news-card-link {
      font-size:.8rem; font-weight:600; color:var(--accent);
      margin-top:.25rem;
    }

    /* Footer */
    footer {
      position:relative; z-index:1;
      border-top:1px solid var(--border); padding:4rem 2rem 2rem;
      max-width:1120px; margin:0 auto;
      display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:2rem;
    }
    .footer-brand p { font-size:.84rem; color:var(--text-3); line-height:1.65; margin-top:.7rem; max-width:220px; }
    .footer-col h6 { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text-3); margin-bottom:1rem; }
    .footer-col ul { list-style:none; }
    .footer-col ul li { margin-bottom:.5rem; }
    .footer-col ul li a { font-size:.84rem; color:var(--text-3); text-decoration:none; transition:color .15s; }
    .footer-col ul li a:hover { color:var(--text); }
    .footer-bottom {
      position:relative; z-index:1;
      max-width:1120px; margin:0 auto; padding:1.5rem 2rem;
      border-top:1px solid var(--border);
      display:flex; justify-content:space-between; align-items:center;
      font-size:.76rem; color:var(--text-3);
    }

    @media (max-width:768px) {
      nav { padding:0 1.2rem; }
      .nav-links { display:none; }
      .page-header { padding:6rem 1.25rem 2rem; }
      .news-grid { margin:0 1.25rem; padding-bottom:4rem; grid-template-columns:1fr; }
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
      <span class="logo-text">Visa<span>Path</span></span>
    </a>
    <ul class="nav-links">
      <li><a href="/#evaluateur">Évaluateur</a></li>
      <li><a href="/#pays">Destinations</a></li>
      <li><a href="/#outils">Outils</a></li>
      <li><a href="/actualites/" class="active">Actualités</a></li>
    </ul>
    <a href="/#evaluateur" class="btn btn-gold">Évaluer mon dossier</a>
  </nav>

  <div class="page-header">
    <div class="page-kicker">En temps réel</div>
    <h1 class="page-title">Actualités <span class="dim">& mises à jour</span></h1>
    <p class="page-sub">Les dernières informations sur les politiques Schengen et les changements consulaires pour les Marocains.</p>
  </div>

  <div class="news-grid">
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
        <span class="logo-text">Visa<span>Path</span></span>
      </a>
      <p>La plateforme de référence pour les Marocains souhaitant voyager en Europe.</p>
    </div>
    <div class="footer-col">
      <h6>Outils</h6>
      <ul>
        <li><a href="/#evaluateur">Évaluateur</a></li>
        <li><a href="/#outils">Checklist</a></li>
        <li><a href="/#outils">Simulateur</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Destinations</h6>
      <ul>
        <li><a href="/#pays">France</a></li>
        <li><a href="/#pays">Espagne</a></li>
        <li><a href="/#pays">Italie</a></li>
        <li><a href="/#pays">Portugal</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h6>Ressources</h6>
      <ul>
        <li><a href="/actualites/">Actualités</a></li>
        <li><a href="/#faq">FAQ visa Maroc</a></li>
        <li><a href="/#evaluateur">Évaluation gratuite</a></li>
      </ul>
    </div>
  </footer>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} VisaPath Maroc</span>
    <span>Outil indicatif — non officiel. Consultez toujours l'ambassade concernée.</span>
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
  // Même pays/tag_label → score élevé
  let score = 0;
  if (String(a.tag_label || '').toLowerCase() === String(b.tag_label || '').toLowerCase()) score += 6;
  if (String(a.tag_type  || '').toLowerCase() === String(b.tag_type  || '').toLowerCase()) score += 2;
  // Tokens communs dans le titre
  const aTokens = tokenize(a.title + ' ' + (a.summary || ''));
  const bTokens = tokenize(b.title + ' ' + (b.summary || ''));
  for (const t of aTokens) { if (bTokens.has(t)) score += 1; }
  return score;
}

function tokenize(text) {
  const stop = new Set(['avec','pour','dans','sans','une','des','les','sur','que','qui',
    'est','les','aux','par','son','ses','leur','leur','pas','plus','visa','maroc','schengen']);
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
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function escHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(str) { return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
function escJson(str) { return String(str || '').replace(/\\/g,'\\\\').replace(/"/g,'\\"'); }
