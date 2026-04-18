# Architecture du Système "AI News"

Ce document décrit le fonctionnement global du système d'automatisation et de publication statique de la plateforme (Hardening AI News Pipeline).

## 1. Source des Données (Déclencheur)
Le système est alimenté par l'arrivée de nouvelles données d'articles.
*   **Google Apps Script** (depuis le pipeline source) envoie de nouveaux articles et met à jour le fichier `news.json` à la racine du dépôt.

## 2. Pipeline d'Automatisation (GitHub Actions)
*   **Workflow (`.github/workflows/build-static-ai-news.yml`) :** Il est déclenché automatiquement à chaque `push` détectant une modification sur le fichier `news.json`.
*   **Objectif :** Ce workflow configure l'environnement Node.js et exécute le script de génération de pages statiques (`scripts/build-ai-news-pages.mjs`).
*   **Validation :** Une fois l'exécution du script terminée, le bot de GitHub Actions prend tous les fichiers générés, crée un commit (`chore: rebuild static pages [skip ci]`) et réalise un *push* automatique sur la branche. (Cela permet d'éviter les conditions de concurrence ou "race conditions" constatées précédemment).

## 3. Génération de Site Statique (SSG)
*   **Script de build (`scripts/build-ai-news-pages.mjs`) :**
    *   **Lecture du JSON :** Le script parse `news.json`.
    *   **Nettoyage & Normalisation :** Le script génère des "slugs" sécurisés pour les URL, formate les dates et catégories.
    *   **Génération HTML :** Pour chaque article, il injecte les données dans le template métier (`article.html`) pour générer des pages SEO dans des dossiers dédiés : `articles/<slug>/index.html`.
    *   **SEO et Flux :** Il génère dynamiquement le `sitemap.xml` et le flux RSS `feed.xml`.
    *   **Fichiers de données optimisés :** Il crée `news-latest.json` (ne contenant que les 20 derniers articles) pour optimiser le temps de chargement initial. Il réécrit aussi `news.json` de façon structurée.
    *   **Nettoyage :** Il supprime les dossiers correspondants à des articles devenus obsolètes ou supprimés de la base.

## 4. Rendu Frontend (Vanilla JS)
*   **Hydratation Progressive :** Le fichier `main.js` de l'index principal procède en deux temps :
    1.  Il télécharge extrêmement rapidement `news-latest.json` pour afficher le *Hero* (carrousel avec les 5 articles "à la une") et les premières pages et retirer la vue "squelette" (Skeleton Loaders).
    2.  En arrière-plan, il télécharge paritairement le lourd fichier `news.json` complet pour autoriser la pagination avancée, les recherches et filtres locaux sur les mots clefs.
*   **Recherche et Filtres :** Le traitement de la recherche et du filtrage par catégories navigue instantanément en mémoire, synchronisant l'état dans l'URL (via `window.history.pushState` : `?q=...&cat=...&page=...`).
