# ADSENSE_AUDIT.md — WAAPPLY

- **Site :** https://waapply.com (repo `D:\waapply`, branche `master`, Cloudflare Pages)
- **Éditeur AdSense :** `pub-2269008589730162` / compte `ca-pub-2269008589730162`
- **Date de l'audit :** 14 octobre 2026
- **Portée :** pages publiques, légal, blog, pages d'offres, `ads.txt`, `robots.txt`, `sitemap.xml`, en-têtes HTTP, intégration du script AdSense, liens, mobile, performances.

> Statut global : **non approuvé**. Aucun accès AdSense / Search Console côté outil n'a permis de vérifier le statut réel (« En préparation », vérification `ads.txt`, indexation, consentement). Les éléments vérifiables publiquement sont **conformes**. Les actions restantes sont **manuelles (hors code)** et listées ci-dessous.

---

## 1. Ce qui est conforme (vérifié)

| Point | Résultat |
|---|---|
| `ads.txt` (local + live) | Présent, exact : `google.com, pub-2269008589730162, DIRECT, f08c47fec0942fa0` — live 200 / `text/plain`, sans redirection |
| Script AdSense | **1 seul** par page (17/17 fichiers), `async`, `crossorigin="anonymous"` |
| Chargement du script | Chargé + exécuté (`window.adsbygoogle` = objet ; ~67 Ko de script) |
| `<ins class="adsbygoogle">` | **Aucun** (aucune unité d'annonce — normal avant approbation) |
| Pages légales | `privacy.html` (indexable) et `terms.html` (`noindex, follow`) complètes, mention AdSense/cookies, contact WhatsApp, lien dans le footer de toutes les pages publiques sauf `waapply-payment.html` |
| `robots.txt` | 200, `Allow: /`, crawl IA autorisés, `Sitemap:` correct |
| `sitemap.xml` | 200 / `application/xml`, URLs valides |
| En-têtes live | **Aucun** CSP ni `X-Robots-Tag` bloquant ; pas de `_headers`/`_redirects` |
| SEO on-page | 1 seul `<h1>` par page, titres uniques, meta descriptions présentes, canonical correct sur toutes les pages indexables |
| Liens internes | **0 lien cassé** (509 références relatives + chemins absolus `/blog/...` testés en HTTP → 200) |
| Mobile | Navigation (drawer `.hamburger`), verrouillage du scroll, fermeture Échap, restauration du focus OK à 390 px |
| Console | **0 erreur** sur toutes les pages testées |
| Encodage | Tous les HTML : UTF-8 sans BOM, fins de ligne LF |

---

## 2. Corrections appliquées (commit local, non poussé)

1. **Meta de vérification AdSense ajoutée** — `<meta name="google-adsense-account" content="ca-pub-2269008589730162">` après le script AdSense sur **17 fichiers** (toutes les pages + `blog/_template.html`). 17 insertions, aucune autre modification, encodage intact.
2. **`waapply-payment.html`** — ajout de `<meta name="robots" content="noindex, follow">` (page orpheline de paiement, non liée).

---

## 3. Problèmes classés

### P0 — bloquants (aucun côté code)
- Aucun bloquant détectable dans le code. Vérification initiale AdSense, statut `ads.txt` et consentement EEA/UK : à faire **dans la console AdSense**.

### P1 — à corriger avant/après approbation
- **Meta de vérification** — *corrigé* (voir §2). À déployer.
- **Consentement EEA/UK (CMP)** — Google exige un CMP certifié pour les utilisateurs EEE/UK. À activer dans AdSense → *Confidentialité et messagerie*. **Action manuelle.**

### P2 — recommandé (non bloquant)
- **Article « démo/faible »** : `blog/comment-ecrire-lettre-de-motivation-europe.html` ≈ **249 mots** (7 sections), indexable et présent dans `sitemap.xml` → risque de **contenu pauvre**. Recommandation : enrichir (600–1000+ mots) ou `noindex` + retrait du sitemap. *Ne pas supprimer sans décision.*
- **Aucune source officielle citée** dans les articles (visas, permis, salaires, contrats) : seul EURES est mentionné en texte, sans lien. Recommandation : ajouter des liens vers sources officielles (EURES, portails nationaux).
- **Incohérence de chiffre** : CTA accueil « أكثر من 30 طلب توظيف كل نهار » vs mentions « 15–30 » ailleurs. À harmoniser.
- **Images non optimisées** : `assets/images/itali.jpg` ≈ 2,16 Mo, `Activit&eacute;s de service administratif et de soutien .jpg` ≈ 1,59 Mo, `Construction .jpg` ≈ 290 Ko. Total `assets/images` ≈ 9,2 Mo. Recommandation : compression / WebP.
- **Page orpheline** `waapply-payment.html` : plus indexable (*corrigé*) ; aucune canonical (inutile avec `noindex`).
- **Pas de page 404 personnalisée** : Cloudflare Pages sert sa 404 par défaut. Acceptable ; optionnel.

---

## 4. Checklist des 12 phases

| # | Phase | État |
|---|---|---|
| 1 | Préparation (git, inventaire, accès) | ✅ |
| 2 | Vérification AdSense (script, meta, ads.txt, consentement) | ⚠️ code ✅ / console à faire |
| 3 | Pages essentielles | ✅ |
| 4 | Qualité du contenu | ⚠️ points P2 listés |
| 5 | Navigation / UX (mobile, liens, 404) | ✅ |
| 6 | SEO (H1, titres, meta, canonical, robots) | ✅ |
| 7 | Performances | ⚠️ images lourdes (P2) |
| 8 | Tests Playwright (local + live) | ✅ |
| 9 | Corrections appliquées | ✅ (commit local) |
| 10 | Vérifications complémentaires | ✅ |
| 11 | Commit | ✅ (non poussé) |
| 12 | Rapport final | ✅ (ce fichier) |

---

## 5. Actions manuelles requises (hors périmètre code)

1. **Console AdSense** : vérifier le statut du site, la vérification `ads.txt`, et **configurer un CMP** (EEA/UK).
2. **Google Search Console** : soumettre `sitemap.xml`, demander l'indexation, vérifier qu'aucune page n'est exclue à tort.
3. **Google Apps Script** : passer `HOMEPAGE_PREVIEW_LIMIT` de **4 → 3** (la copie Google fait autorité ; sinon la prochaine publication automatique remettra 4 articles sur l'accueil).
4. **Déploiement** : pousser le commit local vers `master` (déclenche Cloudflare Pages) **après autorisation explicite**.

---

## 6. Preuves / commandes

- `ads.txt` live : `Invoke-WebRequest https://waapply.com/ads.txt` → 200 `text/plain`, contenu exact.
- Liens : crawl récursif de tous les `href`/`src` relatifs (509 refs) + test HTTP des chemins absolus → 200.
- AdSense runtime : `performance.getEntriesByType('resource')` contient `pagead2…` ; `typeof window.adsbygoogle === 'object'`.
- Console : 0 erreur sur `index.html`, `blog/index.html`, article, `privacy.html`, `terms.html`, `offers.html`.
- Mobile 390×844 : `body.nav-open` appliqué/déverrouillé, focus restauré sur `.hamburger`.
