# VisaPath — Architecture Globale

## Vue d'ensemble

Plateforme statique (GitHub Pages) pour l'évaluation et l'information sur le visa Schengen pour les Marocains. Deux systèmes principaux : **Évaluateur de dossier** (local + GAS) et **Blog automatique** (GAS → Groq IA → blogs.json → frontend + pages statiques).

---

## 1. Structure des fichiers

```
visapath/
├── index.html                          # Page unique SPA-like
│
├── assets/
│   ├── css/
│   │   ├── main.css                    # Point d'entrée CSS (imports uniquement)
│   │   ├── base/
│   │   │   ├── _variables.css          # Variables CSS (couleurs, rayons, polices)
│   │   │   ├── _reset.css              # Reset global
│   │   │   ├── _typography.css         # Styles typo globaux
│   │   │   └── _animations.css         # @keyframes uniquement
│   │   ├── layout/
│   │   │   ├── _nav.css                # Barre de navigation fixe
│   │   │   ├── _hero.css               # Section hero (intro + métriques)
│   │   │   ├── _sections.css           # Structure générique des sections
│   │   │   └── _footer.css            # Pied de page
│   │   ├── components/
│   │   │   ├── _buttons.css            # Boutons (.btn, .btn-gold, .btn-ghost, .btn-whatsapp)
│   │   │   ├── _forms.css              # Formulaires, champs, sélecteurs
│   │   │   ├── _evaluator.css          # Évaluateur de dossier
│   │   │   ├── _result.css             # Résultat d'évaluation (score, barre, cellules)
│   │   │   ├── _features.css           # Grille des fonctionnalités
│   │   │   ├── _countries.css          # Taux par pays (chips)
│   │   │   └── _news.css               # Section blog (news-layout, squelettes, tags)
│   │   └── utilities/
│   │       └── _responsive.css         # Tous les @media queries
│   │
│   └── js/
│       ├── main.js                     # Point d'entrée JS, imports + events
│       ├── news.js                     # Charge blogs.json → injecte #blog
│       ├── evaluator.js                # Logique évaluateur (score, résultat, fallback)
│       ├── api.js                      # Proxy GAS (fetch vers Web App)
│       └── icons.js                    # Fonctions SVG pures
│
├── scripts/
│   └── build-news-pages.mjs            # Build statique des pages blog (Node.js)
│
├── blogs.json                          # Données du blog (pushé par GAS, lu par frontend + build)
├── .github/workflows/
│   └── build-static-recipes.yml        # CI : génère blog/ + sitemap sur push blogs.json
├── visapath-news.gs                    # Google Apps Script (automatisation blog)
├── .nojekyll                           # Désactive Jekyll sur GitHub Pages
└── ARCHITECTURE.md                     # Ce fichier
```

---

## 2. Flux de données

```
┌─────────────────────────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT (visapath-news.gs)                          │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌─────────────────────┐       │
│  │  Groq AI  │───▶│  Google  │───▶│  updateBlogsJson()  │       │
│  │ (Llama 3) │    │  Sheet   │    │  → blogs.json       │       │
│  └──────────┘    └──────────┘    └──────────┬──────────┘       │
│                                            Push GitHub         │
└────────────────────────────────────────────────────────────────┘
                     │
                     ▼  (Push sur master — blogs.json modifié)
         ┌──────────────────────────────────────────────────┐
         │              GITHUB ACTIONS                       │
         │  build-static-recipes.yml                         │
         │  └─ node scripts/build-news-pages.mjs             │
         │      ├─ blog/<slug>/index.html  (pages détail)    │
         │      ├─ blog/index.html         (index blog)      │
         │      ├─ sitemap.xml             (SEO)             │
         │      ├─ llms.txt               (LLM context)      │
         │      └─ robots.txt            (SEO)              │
         └──────────────────────────────────────────────────┘
                     │
                     ▼  (même branche, commit automatique)
         ┌──────────────────────────────────────────────────┐
         │              FRONTEND (GitHub Pages)              │
         │                                                   │
         │  index.html                                       │
         │  ├─ assets/js/main.js                             │
         │  │   └─ import { loadNews } from './news.js'     │
         │  │       └─ fetch blogs.json → rendu #blog       │
         │  │   └─ import { calculer } from './evaluator.js'│
         │  │       └─ analyse dossier → résultat #result   │
         │  └─ assets/css/main.css                           │
         └──────────────────────────────────────────────────┘
```

---

## 3. Interface Utilisateur (index.html — SPA-like)

Une seule page HTML avec ancres (`#evaluateur`, `#pays`, `#outils`, `#blog`).

### Sections

| Section | ID | Contenu | Chargement |
|---|---|---|---|
| Navigation | `nav` | Logo, liens, CTA WhatsApp | Statique |
| Hero | `hero` | Titre, sous-titre, métriques (94%, 18k+, etc.) | Statique |
| Évaluateur | `#evaluateur` | Formulaire 7 champs + résultat | Dynamique (JS) |
| Destinations | `#pays` | Chips taux d'acceptation par pays | Statique |
| Outils | `#outils` | Grille 6 fonctionnalités | Statique |
| Blog | `#blog` | Article principal + 3 articles latéraux | Dynamique (fetch blogs.json) |
| Footer | `footer` | Liens, marque, copyright | Statique |

### États du blog

1. **Squelette** (chargement) : classes `.skel-*` avec animation shimmer CSS
2. **Rempli** (données chargées) : `news.js` injecte le HTML dans `.news-layout`
3. **Vide** (pas de données) : la section entière `#blog` passe en `display: none`

---

## 4. Système Évaluateur

### Flux

```
Formulaire (7 champs)
    │
    ▼
calculer() dans evaluator.js
    │
    ├─▶ validerFormulaire() → messages d'erreur inline
    │
    ├─▶ analyserDossierViaGAS() → API Google Apps Script (proxy)
    │   └─ timeout 3s → fallback local
    │
    └─▶ localScore() → algorithme offline (COUNTRY map + règles)
        │
        ▼
    showResult() → injecte score %, verdict, barre, cellules, conseils
```

### Les 7 champs du formulaire

| Champ | ID | Type | Options |
|---|---|---|---|
| Pays | `pays` | select | France, Espagne, Italie, Allemagne, Portugal, Pays-Bas, Autre |
| Type visa | `type-visa` | select | Tourisme |
| Situation | `situation` | select | CDI, CDD, Indépendant, Étudiant, Retraité, Sans emploi |
| Revenu | `revenu` | number | MAD/mois |
| Historique | `historique` | select | Visa respecté, Jamais, Refus antérieur |
| Solde | `solde` | number | MAD |
| Liens Maroc | `liens` | select | Forts, Moyens, Faibles, Aucun |

### Algorithme de score (fallback local)

Base par pays (6-10) + modificateurs :
- Situation pro : -5 à +15
- Revenus : 0 à +15 (seuils 6000, 8000, 15000 MAD)
- Historique : -20 à +18
- Solde : 0 à +12 (seuil variable par pays)
- Liens Maroc : -10 à +15
- Bonus taux pays : (taux - 65) × 1.2

Score final : entre 8 et 96.

---

## 5. Système Blog

### Google Apps Script (`visapath-news.gs`)

Déclenché quotidiennement (9h) ou manuellement via menu Sheets.

**Étapes :**
1. `pickTopic()` → sélectionne aléatoirement un sujet non utilisé (55 sujets, 7 catégories)
2. `generateArticle(topic)` → 2 appels Groq :
   - Appel 1 → métadonnées SEO (JSON) : description, summary, seo_title, meta_description, keywords
   - Appel 2 → contenu HTML complet (1200-1700 mots, structure H2/H3, FAQ, liens internes)
3. `saveToSheet(article)` → Google Sheet (16 colonnes)
4. `updateBlogsJson()` → push `blogs.json` sur GitHub (master)

**Structure Google Sheet (16 colonnes) :**

| Col | Champ | Description |
|---|---|---|
| A | ID | UUID |
| B | Title | Titre complet |
| C | Source | "Schengen Maroc Blog" |
| D | Category | Actualités Schengen, Visa par pays, Dossier & Documents, etc. |
| E | Image URL | URL image (pré-remplie manuelle) |
| F | URL | URL canonical complète |
| G | Published At | ISO date |
| H | Description | 1 phrase max 155 car. |
| I | Summary | 2 phrases max 270 car. |
| J | SEO Title | max 60 car. |
| K | Meta Description | max 155 car. |
| L | Keywords | 8-12 mots-clés |
| M | Slug | généré depuis le titre |
| N | Status | "published" |
| O | Added At | ISO date |
| P | Content HTML | Article complet 1200-1700 mots |

### Frontend (`news.js`)

```js
loadNews()
  → fetch blogs.json (3 URLs fallback)
  → filtre : status === 'published' && slug && title
  → prend le 1er article → .news-main
  → prend les 3 suivants → .news-list
  → injection HTML dans .news-layout
```

### Build statique (`build-news-pages.mjs`)

Déclenché par GitHub Actions sur chaque push modifiant `blogs.json`.

Génère :
- `blog/<slug>/index.html` — page détail optimisée SEO (Schema.org, OG, Twitter Card)
- `blog/index.html` — index de tous les articles
- `sitemap.xml` — toutes les URLs
- `llms.txt` — contexte pour LLM
- `robots.txt` — directive crawl

### Mapping catégorie → tag visuel

| Catégorie | Type CSS | Label |
|---|---|---|
| Actualités Schengen | `tag-alert` (rouge) | Important |
| Visa par pays | `tag-info` (bleu) | Visa par pays |
| Dossier & Documents | `tag-info` (bleu) | Documents |
| Profils spécifiques | `tag-news` (or) | Profil |
| Refus & Recours | `tag-alert` (rouge) | Refus |
| Procédure & RDV | `tag-info` (bleu) | Procédure |
| Conseils pratiques | `tag-news` (or) | Conseils |

---

## 6. Architecture CSS

### Cascade d'import (`main.css`)

```
1. Base        → variables, reset, typographie, animations
2. Layout      → nav, hero, sections, footer
3. Composants  → boutons, formulaires, évaluateur, résultat,
                 fonctionnalités, pays, news
4. Utilitaires → responsive (tous les @media)
```

### Règles strictes
- Aucun `<style>` inline dans `index.html`
- Aucune `@media` hors de `_responsive.css`
- Aucun `@keyframes` hors de `_animations.css`
- Aucune variable CSS hors de `_variables.css`
- Design tokens : `--bg`, `--accent`, `--r`, `--text`, etc.

---

## 7. Architecture JavaScript (ES Modules)

### Graphe de dépendances

```
main.js
  ├── evaluator.js
  │     └── api.js         (fetch GAS)
  │     └── icons.js        (SVG)
  └── news.js               (fetch blogs.json, rendu DOM)
```

### Responsabilités

| Fichier | Rôle | DOM ? |
|---|---|---|
| `main.js` | Entry point, IntersectionObserver, event binding | Oui |
| `news.js` | Fetch blogs.json, rendu blog | Oui |
| `evaluator.js` | Validation, score, résultat, fallback local | Oui (showResult) |
| `api.js` | Fetch GAS Web App (POST) | Non |
| `icons.js` | Fonctions SVG pures | Non |

---

## 8. GitHub Actions Pipeline

### Déclencheur

Push sur `master` modifiant :
- `blogs.json`
- `scripts/build-news-pages.mjs`
- `.github/workflows/build-static-recipes.yml`

### Étapes

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20)
3. `node scripts/build-news-pages.mjs` → génère pages statiques
4. Commit + push des fichiers générés : `blog/`, `sitemap.xml`, `llms.txt`, `robots.txt`

---

## 9. Formats de données

### blogs.json (flat array — poussé par GAS, lu par frontend + build)

```json
[
  {
    "id": "uuid",
    "title": "Visa Schengen France depuis le Maroc : dossier complet 2025",
    "source": "Schengen Maroc Blog",
    "category": "Visa par pays",
    "image_url": "",
    "url": "https://waapply.com/blog/visa-schengen-france-maroc-dossier/",
    "published_at": "2025-05-18T09:00:00.000Z",
    "description": "Tout savoir sur le visa Schengen France pour les Marocains...",
    "summary": "Guide complet avec documents, délais, rendez-vous VFS Global...",
    "seo_title": "Visa Schengen France pour Marocains 2025",
    "meta_description": "Guide complet pour obtenir votre visa Schengen France depuis le Maroc...",
    "keywords": "visa Schengen France, Maroc, VFS Global, documents",
    "slug": "visa-schengen-france-maroc-dossier",
    "status": "published",
    "added_at": "2025-05-18T09:00:00.000Z",
    "content_html": "<p>Introduction...</p><h2>...</h2>..."
  }
]
```

---

## 10. Configuration requise

### Google Apps Script — Script Properties

| Propriété | Description |
|---|---|
| `GROQ_API_KEY` | Clé API Groq (console.groq.com) |
| `GITHUB_TOKEN` | Personal Access Token (scope: repo) |
| `GITHUB_OWNER` | Username GitHub |
| `GITHUB_REPO` | Nom du dépôt |

### GitHub — Permissions

Le workflow nécessite `contents: write` pour pusher les pages générées.
