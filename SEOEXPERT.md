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

### Processus de recherche de mots-clés avant rédaction

Avant chaque article, le prompt Groq identifie systématiquement :
1. **Mot-clé principal** — le plus gros volume de recherche Google Maroc
2. **10 mots-clés secondaires** — longue traîne, conversationnels, en français marocain
3. **10 questions Google potentielles** — extraites des "People also ask" et des suggestions Google
4. **Variantes locales marocaines** — ex: "tls rabat", "prix visa mad", "rendez-vous vfs casa", "document visa france maroc"

### Règles de placement du mot-clé principal

| Emplacement | Obligatoire ? |
|---|---|
| H1 (titre de l'article) | ✅ |
| 40 premiers mots de l'introduction | ✅ |
| Au moins un H2 | ✅ |
| Meta description | ✅ |
| URL (slug) | ✅ |
| Title SEO (< 60 car.) | ✅ |
| Conclusion | ✅ (fortement recommandé) |

### Nouveaux critères de contenu (2026)

| Critère | Ancien | Nouveau |
|---|---|---|
| Longueur minimale | 1200 mots | **1800 mots** |
| Structure | 4 sections H2 | **5+ sections H2** |
| Tableaux | Interdits | **Autorisés si pertinents** (frais, délais, comparatifs) |
| Questions FAQ | 5 | **5 à 7** |
| Villes marocaines | Optionnel | **Recommandé** (Casablanca, Rabat, Tanger, Marrakech, Fès) |
| Mots-clés secondaires | Implicites | **10 explicites** + variantes locales |
| Google Discover | Non mentionné | **Optimisation explicite** |
| Conseils pratiques | Optionnel | **Obligatoire** + actionnables immédiatement |

### Exemples de recherches réelles ciblées

Ces 10 requêtes Google sont la priorité absolue :

1. `visa france maroc`
2. `rendez-vous tls france rabat`
3. `visa espagne maroc documents`
4. `refus visa france maroc`
5. `combien compte bancaire visa schengen`
6. `délai visa italie maroc`
7. `visa portugal maroc`
8. `prix visa schengen maroc`
9. `lettre motivation visa france pdf`
10. `visa schengen pour marocains`

Chaque article doit donner l'impression qu'il répond EXACTEMENT à ce qu'un Marocain a tapé sur Google.

**Prompt métadonnées SEO (GAS `visapath-news.gs`) :**

```
Tu es un expert SEO spécialisé dans la niche "Visa Schengen pour les Marocains".
Tu connais par cœur les vraies recherches Google des utilisateurs marocains.

Avant d'écrire, identifie :
1. Le mot-clé principal (celui qui a le plus de volume de recherche)
2. 10 mots-clés secondaires (longue traîne, conversationnels)
3. 10 questions Google potentielles que les Marocains tapent
4. Les variantes locales marocaines (ex: "tls rabat", "prix visa mad")

IMPORTANT — Le mot-clé principal doit pouvoir apparaître :
- dans le H1 de l'article
- dans les 40 premiers mots
- dans un H2
- dans la meta description
- dans l'URL
- dans le title SEO

Règles :
- Titre SEO : max 60 car., punchy, mot-clé principal inclus
- Meta description : max 155 car., mot-clé principal en début
- Mots-clés : 8-12 variantes "darija-friendly"
- Description : 1 phrase, mot-clé en premier mot si possible
- Summary : 2 phrases avec bénéfice clair
```

**Prompt contenu HTML (GAS `visapath-news.gs`) :**

```
Tu es un expert SEO spécialisé dans la niche "Visa Schengen pour les Marocains".
Tu écris comme tu parlerais à un pote dans un café à Casablanca.

Rédige un article HTML complet sur : [sujet]

=== OPTIMISATION GOOGLE MAROC + GOOGLE DISCOVER ===
- Le mot-clé principal doit apparaître : dans le H1, les 40 premiers mots,
  un H2, la conclusion
- Paragraphes courts — lisibilité mobile
- Ton optimisé Google Discover : accrocheur, utile, personnel
- Mentionne des villes marocaines si pertinent

=== STRUCTURE OBLIGATOIRE ===
1. Introduction : mot-clé principal dans les 40 premiers mots
2. <h2>En résumé</h2>
3. Au moins 5 sections <h2> + sous-sections <h3>
4. Si pertinent : <tableau comparatif> (frais, délais, documents)
5. <h2>FAQ</h2> — 5 à 7 vraies questions Google
6. <h2>Conclusion</h2> — CTA vers waapply.com

=== EXIGENCES ===
- Longueur : 1800 à 2500 mots (minimum 1800)
- TON : conversationnel marocain, phrases courtes, pas de jargon
- Montants précis en MAD, délais réels, exemples TLS/VFS/BLS
- Mises en garde utiles (arnaques, erreurs fréquentes)
- Conseils pratiques concrets applicables immédiatement
- Liens internes vers /guide-complet/, /documents-requis/, /refus-recours/,
  /actualites/, /par-pays/
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

## 8. Nouveautés SEO appliquées (mai 2026)

| Mise à jour | Détaillé dans |
|---|---|
| Mots-clés : identification de 10 secondaires + 10 questions + variantes locales avant rédaction | Section 4 — Processus |
| Placement strict du mot-clé principal (H1, 40 mots, H2, meta, URL, title) | Section 4 — Règles |
| Longueur article : 1800-2500 mots (au lieu de 1200-1700) | Section 4 — Critères |
| Tableaux comparatifs autorisés (frais, délais, documents) | Prompt contenu |
| Optimisation Google Discover explicite | Prompt contenu |
| Conseils pratiques actionnables immédiatement | Prompt contenu |
| 10 recherches réelles ciblées en priorité | Section 4 — Exemples |

---

## 9. Évolution prévue

- **ETIAS** → création d'une page dédiée dès le lancement officiel (mi-2026)
- **EES** → mise à jour des pages existantes avec les nouvelles règles d'entrée/sortie
- **Pages pays** → une page dédiée par pays (au lieu d'un comparatif unique) pour capturer les recherches longue traîne
- **Avis Google** → profil Google Business pour les avis clients
- **Backlinks** → partenariats avec des sites marocains (avocats, agences de voyage, forums)
