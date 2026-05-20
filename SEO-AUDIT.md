# Audit SEO — VisaPath / waapply.com

**Date :** 20 mai 2026
**Outil :** Audit manuel complet (code source + pages générées)
**Périmètre :** index.html, blog/, pages piliers, sitemap, robots.txt, JSON-LD, performance, balisage

---

## Résumé exécutif

| Niveau | Nombre |
|--------|--------|
| 🔴 Critique | 5 |
| 🟠 Haute priorité | 7 |
| 🟡 Priorité moyenne | 6 |
| 🔵 Faible priorité | 4 |

---

## 🔴 Critique

### C1. JSON-LD corrompu par `\b` dans `escJson()`

**Fichier :** `scripts/build-news-pages.mjs:1020-1029`

La fonction `escJson()` produit du JSON invalide en insérant `\b` devant chaque mot :

```json
"headline": "\bVisa\b \bSchengen\b \bAllemagne\b ..."
```

**Impact :** Google Search Console rejette tous les `BlogPosting` et `BreadcrumbList` des articles de blog. Aucune donnée structurée n'est lue.

**Correctif :** Modifier la regex de remplacement pour ne cibler que le caractère `\b` (backspace, `\x08`) et pas l'ancre regex `\b`.

---

### C2. `index.html` — aucune meta description, canonical, hreflang, OG, Twitter Card, Schema

**Fichier :** `index.html`

| Élément | Statut |
|---------|--------|
| `<meta name="description">` | ❌ Absent |
| `<link rel="canonical">` | ❌ Absent |
| `<link rel="alternate" hreflang="fr">` | ❌ Absent |
| `<meta property="og:title">` | ❌ Absent |
| `<meta name="twitter:card">` | ❌ Absent |
| `<script type="application/ld+json">` | ❌ Absent |

**Impact :** La page d'accueil n'a aucun signal SEO structuré. Pas d'affichage enrichi dans les SERP. Pas de partage social correct.

---

### C3. Pas de page 404 personnalisée

`404.html` introuvable dans le dépôt.

**Impact :** GitHub Pages sert sa page 404 générique, sans navigation ni recherche. Les utilisateurs égarés rebondissent. Google interprète cela comme un signal de qualité faible.

---

### C4. Fichier `CNAME` corrompu par des marqueurs de conflit git

**Fichier :** `CNAME`

Contient :
```
<<<<<<< Updated upstream
waapply.com
=======
waapply.com
>>>>>>> Stashed changes
```

**Impact :** GitHub Pages peut ne pas reconnaître le domaine personnalisé correctement, causant des indisponibilités ou un serveur sur le mauvais domaine.

---

### C5. Sitemap — 4 pages piliers absentes

**Fichier :** `sitemap.xml`

Présent : `/`, `/blog/`, 10 articles de blog.
Absent : `/guide-complet/`, `/documents-requis/`, `/refus-recours/`, `/par-pays/`.

**Impact :** Ces pages ne sont pas soumises à Google, réduisant leur indexation et leur visibilité.

---

## 🟠 Haute priorité

### H1. URLs `schengen-maroc.com` dans certains articles de blog

Plusieurs articles dans `blogs.json`/`blogs-latest.json` ont le champ `url` pointant vers l'ancien domaine :

```
https://schengen-maroc.com/blog/visa-schengen-allemagne-...
```

**Impact :** Google peut considérer ces URLs comme du contenu dupliqué ou les indexer sous le mauvais domaine.

---

### H2. Blog index (`blog/index.html`) — Twitter Cards absents, pas de `CollectionPage` schema

**Fichier :** généré par `build-news-pages.mjs` (`buildBlogIndex()`)

- ❌ Pas de `<meta name="twitter:card">`
- ❌ Pas de `<meta name="twitter:title">`
- ❌ Pas de `<meta name="twitter:description">`
- ❌ Pas de `CollectionPage` ou `Blog` schema (seulement `BreadcrumbList`)

---

### H3. Aucun fichier `_headers`

**Impact :** Pas de cache-control pour les assets statiques (CSS, JS, images). Pas d'en-têtes de sécurité (X-Frame-Options, X-Content-Type-Options, Permissions-Policy, etc.). Sur GitHub Pages, `_headers` est le seul moyen de définir des en-têtes HTTP.

---

### H4. Aucun fichier `_redirects`

**Impact :** Impossible de mettre en place des redirections 301 depuis les anciennes URLs `schengen-maroc.com` ou depuis d'éventuelles URLs renommées.

---

### H5. Pas de `manifest.json` (PWA)

Le site a un service worker (`sw.js`) mais aucun manifeste PWA. Pas d'icône, pas de splash screen, pas d'installation possible.

---

### H6. Service Worker limité au cache JSON uniquement

`sw.js` ne cache que les requêtes `blogs-*.json` avec stale-while-revalidate.

**Impact :** Aucun cache pour les pages HTML, CSS, JS, images. Pas de fallback offline. En cas de perte de connexion, le site est totalement inaccessible.

---

### H7. Page d'accueil pas dans la balise `<title>` des articles de blog

Les articles générés ont `<title>` au format `"Titre Article — Schengen Maroc"` (hardcodé dans le template `buildBlogPage()`). Devrait être `"Titre Article | VisaPath — Guide Schengen"` pour cohérence de marque.

---

## 🟡 Priorité moyenne

### M1. Aucun `@media print` dans les CSS

Aucune rgle d'impression nulle part. La barre de navigation fixe apparaît sur l'impression. Les thèmes sombres gaspillent de l'encre.

---

### M2. Pas de favicon défini

Aucun `<link rel="icon">` ou `<link rel="apple-touch-icon">` dans `index.html` ni dans les pages générées.

---

### M3. `og:locale` absent de toutes les pages

Toutes les pages (index, blog, piliers) devraient avoir `<meta property="og:locale" content="fr_FR">`.

---

### M4. `article:modified_time` absent des articles de blog

Les articles ont `article:published_time` mais pas `article:modified_time`.

---

### M5. Blog index — pas de `<meta name="keywords">`

`blog/index.html` n'a pas de meta keywords.

---

### M6. Pas de `<meta name="theme-color">`

Aucune page ne définit la couleur du thème pour la barre d'adresse mobile.

---

## 🔵 Faible priorité

### L1. Sitemap — pas d'extension `<image:image>`

Les images des articles ne sont pas référencées dans le sitemap via `<image:image>`.

---

### L2. Pas de `WebSite` schema avec `SearchAction` sur l'index

`index.html` pourrait avoir un schema `WebSite` avec `potentialAction` / `SearchAction` pour activer le Sitelinks Search Box dans Google.

---

### L3. Pas de flux RSS/Atom

Aucun fichier `blog.xml`, `rss.xml`, `atom.xml` ou `feed.xml`.

---

### L4. Pas de balises `<link rel="next">` / `<link rel="prev">`

La pagination du blog n'est pas balisée (actuellement une seule page avec 7 articles).

---

## Recommandations immédiates (ordre d'exécution)

1. **Corriger `escJson()`** — remplacer la regex qui capture `\b` par une substitution ciblant uniquement `\x08`
2. **Corriger `CNAME`** — supprimer les marqueurs de conflit, ne garder que `waapply.com`
3. **Ajouter la meta description, canonical, hreflang, OG, Twitter Cards et schema `WebSite` sur `index.html`**
4. **Créer `404.html`** avec navigation complète et barre de recherche
5. **Ajouter les 4 pages piliers dans `sitemap.xml`**
6. **Corriger les URLs `schengen-maroc.com` dans `blogs.json` / `blogs-latest.json`** (via GAS ou script)
7. **Créer `_headers`** pour cache-control et security headers
8. **Créer `_redirects`** pour les anciennes URLs
9. **Ajouter Twitter Cards sur `blog/index.html`**
10. **Ajouter `CollectionPage` schema sur `blog/index.html`**

---

## Pages auditées

| Page | URL | Score estimé |
|------|-----|--------------|
| Accueil | `/` | 40/100 |
| Blog index | `/blog/` | 75/100 |
| Article blog | `/blog/*/` | 85/100 |
| Guide complet | `/guide-complet/` | 85/100 |
| Documents requis | `/documents-requis/` | 85/100 |
| Refus & recours | `/refus-recours/` | 85/100 |
| Par pays | `/par-pays/` | 85/100 |
