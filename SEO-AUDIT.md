# Audit SEO — Visa Schengen / waapply.com

**Date :** 21 mai 2026 (mise à jour)
**Outil :** Audit manuel complet (code source + pages générées)
**Périmètre :** index.html, blog/, pages piliers, sitemap, robots.txt, JSON-LD, performance, balisage

---

## Résumé exécutif

| Niveau | Avant (20 mai) | Après (21 mai) |
|--------|----------------|----------------|
| 🔴 Critique | 5 | 0 |
| 🟠 Haute priorité | 7 | 0 |
| 🟡 Priorité moyenne | 6 | 1 |
| 🔵 Faible priorité | 4 | 1 |

---

## 🔴 Critique — 0 restante (5 résolues)

### ~~C1. JSON-LD corrompu par `\b` dans `escJson()`~~ ✅ RÉSOLU

La fonction `escJson()` utilise `\x08` (backspace) correctement — pas de confusion avec l'ancre regex `\b`.

### ~~C2. `index.html` — aucune meta description, canonical, hreflang, OG, Twitter Card, Schema~~ ✅ RÉSOLU

`index.html` contient désormais :
- ✅ `<meta name="description">` — 208 caractères
- ✅ `<link rel="canonical">`
- ✅ `<link rel="alternate" hreflang="fr">` + `x-default`
- ✅ `<meta property="og:title">`, `og:description`, `og:url`, `og:site_name`, `og:locale`, `og:image`
- ✅ `<meta name="twitter:card">`, `twitter:title`, `twitter:description`
- ✅ `<script type="application/ld+json">` — `WebSite` + `Organization`

### ~~C3. Pas de page 404 personnalisée~~ ✅ RÉSOLU

`404.html` créé (8328 octets) avec navigation complète.

### ~~C4. Fichier `CNAME` corrompu par des marqueurs de conflit git~~ ✅ RÉSOLU

`CNAME` contient uniquement `waapply.com`.

### ~~C5. Sitemap — 4 pages piliers absentes~~ ✅ RÉSOLU

`sitemap.xml` inclut désormais :
- `/guide-complet/`
- `/documents-requis/`
- `/refus-recours/`
- `/par-pays/`

---

## 🟠 Haute priorité — 0 restante (7 résolues)

### ~~H1. URLs `schengen-maroc.com` dans blogs.json~~ ✅ RÉSOLU

Toutes les URLs dans `blogs.json` et `blogs-latest.json` ont été corrigées vers `waapply.com`.

### ~~H2. Blog index — Twitter Cards absents, pas de `CollectionPage` schema~~ ✅ RÉSOLU

`blog/index.html` contient désormais :
- ✅ `<meta name="twitter:card">`, `twitter:title`, `twitter:description`
- ✅ `<meta property="og:locale">`
- ✅ `<meta name="theme-color">`
- ✅ `CollectionPage` schema JSON-LD

### ~~H3. Aucun fichier `_headers`~~ ✅ RÉSOLU

`_headers` créé avec :
- Security headers : X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS
- Cache-Control : `/assets/*` (24h), `/blog/*` (1h), `*.json` (no-cache), `*.xml` (1h)

### ~~H4. Aucun fichier `_redirects`~~ ✅ RÉSOLU

`_redirects` créé avec :
- 301 ancien domaine → `waapply.com`
- 301 `/actualites/` → `/blog/`
- 301 trailing slash normalization
- 301 articles orphelins → blog

### ~~H5. Pas de `manifest.json` (PWA)~~ ✅ RÉSOLU

`manifest.json` créé avec icônes réelles (PNG, plus de data URI).

### ~~H6. Service Worker limité au cache JSON uniquement~~ ✅ RÉSOLU

`sw.js` gère désormais :
- Cache-first pour CSS/JS/images
- Stale-while-revalidate pour JSON
- Network-first pour HTML avec fallback offline → `404.html`

### ~~H7. Page d'accueil pas dans la balise `<title>` des articles de blog~~ ✅ RÉSOLU

Les articles blog ont `<title>` au format `"Titre Article | Visa Schengen — Guide Schengen"`.

---

## 🟡 Priorité moyenne — 1 restante (5 résolues)

### M1. Aucun `@media print` dans les CSS

Toujours manquant. Aucune règle d'impression nulle part. Barre de navigation fixe sur l'impression. Faible priorité — ne bloque pas l'indexation.

### ~~M2. Pas de favicon défini~~ ✅ RÉSOLU

Toutes les pages ont désormais :
- ✅ `/favicon.ico`
- ✅ `/favicon-32x32.png`
- ✅ `/favicon-192x192.png`
- ✅ `<link rel="apple-touch-icon">`
- ✅ Plus de data URI

### ~~M3. `og:locale` absent de toutes les pages~~ ✅ RÉSOLU

`<meta property="og:locale" content="fr_FR">` présent sur index.html, blog/index.html, et articles blog.

### ~~M4. `article:modified_time` absent des articles de blog~~ ✅ RÉSOLU

Les articles blog incluent `<meta property="article:modified_time">`.

### ~~M5. Blog index — pas de `<meta name="keywords">`~~ ✅ RÉSOLU

`blog/index.html` inclut `<meta name="keywords">`.

### ~~M6. Pas de `<meta name="theme-color">`~~ ✅ RÉSOLU

`<meta name="theme-color" content="#080C14">` présent sur toutes les pages.

---

## 🔵 Faible priorité — 1 restante (3 résolues)

### L1. Sitemap — pas d'extension `<image:image>`

Toujours pas implémenté. Les images des articles ne sont pas référencées avec `<image:image>` dans le sitemap.

### ~~L2. Pas de `WebSite` schema avec `SearchAction`~~ ✅ RÉSOLU

`index.html` inclut un schema `WebSite` avec `potentialAction` / `SearchAction`.

### ~~L3. Pas de flux RSS/Atom~~ ✅ RÉSOLU

`rss.xml` généré automatiquement par le build script.

### ~~L4. Pas de balises `<link rel="next">` / `<link rel="prev">`~~ ✅ RÉSOLU

Non pertinent — le blog tient sur une seule page.

---

## Améliorations supplémentaires (non listées dans l'audit initial)

| Amélioration | Statut |
|---|---|
| WhatsApp buttons avec pré-remplissage par service premium | ✅ |
| Redirection www → non-www (JS) sur toutes les pages | ✅ |
| Liens internes dans footer (plus de `#`) | ✅ |
| Performance JS : `Promise.any()` parallèle au lieu de 6 fetchs séquentiels | ✅ |
| `favicon.ico` + `favicon-32x32.png` + `favicon-192x192.png` réels (plus de data URI) | ✅ |
| `og:image` (`assets/img/og-default.jpg`) créé | ✅ |
| Meta description élargie à 208 caractères (dans la limite 150-220) | ✅ |
| Premium section avec glassmorphism et boutons WhatsApp | ✅ |
| CSS responsive : breakpoints 480/640/768/1024px | ✅ |

---

## Pages auditées — Scores mis à jour

| Page | URL | Score avant | Score après |
|------|-----|-------------|-------------|
| Accueil | `/` | 40/100 | **90/100** |
| Blog index | `/blog/` | 75/100 | **95/100** |
| Article blog | `/blog/*/` | 85/100 | **95/100** |
| Guide complet | `/guide-complet/` | 85/100 | **95/100** |
| Documents requis | `/documents-requis/` | 85/100 | **95/100** |
| Refus & recours | `/refus-recours/` | 85/100 | **95/100** |
| Par pays | `/par-pays/` | 85/100 | **95/100** |

---

## Recommandations restantes

1. **`@media print`** — Ajouter des règles d'impression pour masquer la nav fixe et optimiser le contraste (faible priorité)
2. **`<image:image>` dans sitemap** — Ajouter les images des articles dans le sitemap XML (faible priorité)
3. **Groq API key** — Régénérer la clé API Groq dans Google Apps Script (bloquant pour la génération d'articles)
