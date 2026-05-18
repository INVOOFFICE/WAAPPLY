# SEOEXPERT — Architecture SEO de l'interface Schengen Maroc

## Vue d'ensemble

Stratégie SEO complète pour `https://waapply.com` (anciennement `schengen-maroc.com`).  
L'objectif est de **dominer les requêtes de visa Schengen pour les Marocains** sur Google Search, Bing, et les assistants IA.

---

## 1. Architecture des URLs

```
waapply.com/
├── /                              # SPA-like : évaluateur + blog hero
├── /guide-complet/                # Guide A→Z du visa tourisme (pilier)
├── /documents-requis/             # Documents par situation pro (pilier)
├── /refus-recours/                # Refus, recours, lettre type (pilier)
├── /par-pays/                     # Comparatif 26 pays Schengen (pilier)
├── /blog/                         # Index blog
├── /blog/<slug>/                  # Articles blog (pages filles)
├── /actualites/                   # Actualités consulaires
├── /robots.txt
├── /sitemap.xml
├── /ads.txt
├── /llms.txt                      # Contexte pour LLM (AI discoverability)
└── /sw.js                         # Service Worker
```

**Règle :** chaque URL est une page HTML statique (pas de `?param=` ni `#hash` pour le contenu indexable).  
Les ancres (`#evaluateur`, `#pays`) sont réservées aux interactions JS non-indexables.

---

## 2. On-Page SEO — Template par page

Chaque page suit un template strict avec les balises suivantes :

### Métadonnées obligatoires (dans `<head>`)

```html
<title>Mot-clé principal — Guide complet 2026 pour les Marocains</title>
<meta name="description" content="<155 car. — 1 phrase accrocheuse mot-clé first>">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://waapply.com/<path>/">
<link rel="alternate" hreflang="fr" href="https://waapply.com/<path>/">
<link rel="alternate" hreflang="x-default" href="https://waapply.com/<path>/">

<!-- Open Graph -->
<meta property="og:type"        content="article">
<meta property="og:title"       content="<60 car.>">
<meta property="og:description" content="<155 car.>">
<meta property="og:url"         content="https://waapply.com/<path>/">
<meta property="og:site_name"   content="Schengen Maroc">
<meta property="og:image"       content="https://images.unsplash.com/<id>?q=80&w=1172&auto=format&fit=crop">

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="<60 car.>">
<meta name="twitter:description" content="<155 car.>">

<!-- Google AdSense -->
<meta name="google-adsense-account" content="ca-pub-2269008589730162">
```

### Schema.org (JSON-LD)

Deux blocs obligatoires sur chaque page :

**Bloc 1 — Article / BlogPosting :**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "description": "...",
  "datePublished": "2025-01-15T09:00:00.000Z",
  "dateModified": "2026-05-18T09:00:00.000Z",
  "inLanguage": "fr-MA",
  "author": { "@type": "Organization", "name": "Schengen Maroc", "url": "https://waapply.com" },
  "publisher": { "@type": "Organization", "name": "Schengen Maroc", "url": "https://waapply.com" },
  "mainEntityOfPage": "https://waapply.com/<path>/",
  "about": ["tag1","tag2",...],
  "keywords": "mot-clé1, mot-clé2, ..."
}
```

**Bloc 2 — BreadcrumbList :**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil",  "item": "https://waapply.com/" },
    { "@type": "ListItem", "position": 2, "name": "Page", "item": "https://waapply.com/<path>/" }
  ]
}
```

Les articles blog utilisent `BlogPosting` au lieu d'`Article` et incluent un 3e niveau dans le BreadcrumbList (`Blog` → `Article`).

---

## 3. SEO Technique

### Sitemap (`sitemap.xml`)

Généré automatiquement par `scripts/build-news-pages.mjs` à chaque push.

**Inclut :**
- Toutes les pages statiques (`/`, `/guide-complet/`, `/documents-requis/`, `/refus-recours/`, `/par-pays/`)
- Tous les articles blog (`/blog/<slug>/`)
- L'index blog (`/blog/`)

**Exclut :**
- `?eval=HASH` — URL temporaire, pas de contenu propre
- Fichiers assets (CSS, JS, images)
- `robots.txt`, `sitemap.xml`, `ads.txt`, `sw.js`

### Robots.txt

```
User-agent: *
Allow: /

Sitemap: https://waapply.com/sitemap.xml
```

### Performance (Core Web Vitals)

| Métrique | Cible | Statut |
|---|---|---|
| LCP | < 2.5s | Polices Syne + Instrument Sans préchargées via `<link rel=preconnect>`, CSS inline dans `<head>`, images en `loading=lazy + srcset` |
| FID / INP | < 200ms | JS minimal (< 5 fichiers ES modules), chargé en différé (module type), pas de jQuery |
| CLS | < 0.1 | Dimensions explicites sur images, skeleton shimmer pendant chargement blog |

### Service Worker (`sw.js`)

- **Stale-while-revalidate** pour `blogs-latest.json`, blogs-archive.json`, `blogs.json`
- Cache-first pour les assets statiques (CSS, JS)
- ETag / If-None-Match pour éviter les re-téléchargements inutiles
- Pas de cache sur les pages HTML (toujours fraîches via GitHub Pages)

### AI Discoverability (`llms.txt`)

Fichier `llms.txt` généré automatiquement contenant :
- Contexte général du site
- Liste des articles blog avec URL, titre, description, date
- Liens vers les pages piliers

Permet aux LLM (ChatGPT, Claude, Gemini) de référencer correctement le site lors des réponses.

### URLs canoniques

Toutes les pages ont `<link rel="canonical">` pointant vers l'URL définitive.  
Pas de contenu dupliqué — chaque sujet a une page unique.

---

## 4. Architecture du Contenu SEO

### Pages Piliers (content pillars)

| Page | Mot-clé principal | Volume estimé | Type |
|---|---|---|---|
| `/guide-complet/` | "guide visa Schengen Maroc" | Très fort | Guide A→Z |
| `/documents-requis/` | "documents visa Schengen Maroc" | Très fort | Liste + profils |
| `/refus-recours/` | "refus visa Schengen recours Maroc" | Fort | Résolution problème |
| `/par-pays/` | "visa Schengen France Espagne Italie Maroc" | Fort | Comparatif |
| `/actualites/` | "actualités visa Schengen 2026" | Moyen | Actualités |

### Pages Filles (blog)

Générées automatiquement via le pipeline GAS → Groq → GitHub Actions.

**Categories :** Actualités Schengen, Visa par pays, Dossier & Documents, Profils spécifiques, Refus & Recours, Procédure & RDV, Conseils pratiques.

**55 sujets prédéfinis** couvrant toutes les facettes de la recherche de visa Schengen.

**Chaîne éditoriale :**
```
Google Sheet (topics + données)
  → GAS : pickTopic() → generateArticle(topic) → saveToSheet()
  → Groq API (Llama 3) : 2 appels (métadonnées SEO + contenu HTML)
  → GAS : updateBlogsJson() → push GitHub
  → GitHub Actions : build-news-pages.mjs → pages statiques + sitemap
```

### Stratégie de mots-clés

Chaque article blog cible un **mot-clé principal** (dans le titre, H1, description, URL) et **8-12 mots-clés secondaires** (dans `keywords`, `about`, contenu).

**Exemple de prompt Groq pour les métadonnées SEO :**

```
Generate a JSON object for SEO metadata for a Schengen visa article targeting
Moroccan readers. Topic: [topic]. Language: French (Morocco).
Include: title (in H1 format), seo_title (<60 chars), meta_description (<155 chars),
summary (<270 chars), keywords (8-12 comma-separated).
The title must be conversational Moroccan French, include the main keyword early,
and avoid generic titles.
```

**Exemple de prompt Groq pour le contenu :**

```
Write a complete HTML article in French (Moroccan dialect style) about [topic].
Minimum 1200 words, maximum 1700 words.
- Tone: conversational Moroccan French, use "vous", include concrete examples
  (VFS Global, TLS Contact, BLS International)
- Mention amounts in MAD
- Include real questions from Google Search in the FAQ section
- Structure: <h2> sections, bullet points, strong tags on key phrases
- Add 2-3 internal links to waapply.com pages
- The first 40 words must contain the main keyword
```

### Maillage interne

Système de liens automatiques entre les pages :
- **Footer :** navigation vers les 3 piliers + blog + actualités
- **Navbar :** Guide | Par pays | Documents | Refus | Blog
- **CTA box :** lien vers WhatsApp + page complémentaire
- **Liens utiles :** en fin de chaque page, 5-6 liens vers les autres pages
- **Contenu :** liens contextuels dans les articles blog (`<a href="/guide-complet/">`)

---

## 5. Google AdSense

```html
<!-- Meta tag vérification -->
<meta name="google-adsense-account" content="ca-pub-2269008589730162">

<!-- Script AdSense (chargé async dans <head>) -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2269008589730162" crossorigin="anonymous"></script>
```

**Fichier `ads.txt` :**
```
google.com, pub-2269008589730162, DIRECT, f08c47fec0942fa0
```

Plaqué sur l'ensemble du site via GitHub Pages.

---

## 6. Monitoring SEO

### Actuel

| Outil | Usage |
|---|---|
| Google Search Console | Suivi indexation, clics, impressions, erreurs crawl |
| Google Analytics | Trafic, comportement utilisateur, pages populaires |
| Sitemap XML | Sourmission automatique via GitHub Pages |

### Recommandé (à implémenter)

- **PageSpeed Insights** → surveillance Core Web Vitals après chaque déploiement
- **Ahrefs / Semrush** → analyse backlinks, mots-clés concurrents (France, Espagne, Allemagne vs Maroc)
- **Google Index Check** → script CI pour vérifier que toutes les nouvelles pages sont indexées sous 48h
- **Redirect mapping** → `schengen-maroc.com` → `waapply.com` (301 permanent, déjà fait)

---

## 7. Bonnes pratiques appliquées

| Règle | Appliquée ? |
|---|---|
| Une URL = un sujet | ✅ |
| Pas de contenu dupliqué | ✅ (chaque page est unique) |
| H1 = titre de la page (1 seul) | ✅ |
| Balises title uniques < 60 car. | ✅ |
| Meta descriptions uniques < 155 car. | ✅ |
| Images avec `alt` text | ✅ (via Groq) |
| URLs en kebab-case | ✅ |
| Pas de paramètres dans les URLs indexables | ✅ |
| HTTPS (GitHub Pages) | ✅ |
| Responsive design | ✅ |
| Structured data (JSON-LD) | ✅ |
| Open Graph + Twitter Card | ✅ |
| Hreflang (fr + x-default) | ✅ |
| Breadcrumb (visuel + schema) | ✅ |
| Sitemap XML | ✅ (auto-généré) |
| Robots.txt | ✅ |
| llms.txt (AI discoverability) | ✅ |
| pagespeed : lazy loading + srcset | ✅ |
| pagespeed : preconnect polices | ✅ |
| pagespeed : CSS critique inline | ✅ |
| pagespeed : JS module différé | ✅ |
| AdSense vérifié (meta + ads.txt) | ✅ |
| 301 redirection ancien domaine | ✅ |

---

## 8. Évolution prévue

- **ETIAS** → création d'une page dédiée dès le lancement officiel (mi-2026)
- **EES** → mise à jour des pages existantes avec les nouvelles règles d'entrée/sortie
- **Pages pays** → une page dédiée par pays (au lieu d'un comparatif unique) pour capturer les recherches longue traîne
- **Avis Google** → profil Google Business pour les avis clients
- **Backlinks** → partenariats avec des sites marocains (avocats, agences de voyage, forums)
