/**
 * ============================================================
 *  MAKE MONEY AI — Extension de code.gs
 * ============================================================
 *
 *  Ce fichier s'appuie sur les Script Properties et les
 *  fonctions déjà définies dans code.gs. Aucun token à
 *  reconfigurer ici — il utilise les mêmes propriétés :
 *
 *  Script Properties requises (déjà dans code.gs) :
 *  ┌─────────────────┬──────────────────────────────────────┐
 *  │ GITHUB_TOKEN    │ ton Personal Access Token GitHub     │
 *  │ GITHUB_REPO     │ ex: INVOOFFICE/ai-news               │
 *  └─────────────────┴──────────────────────────────────────┘
 *  Optionnelle :
 *  │ AI_NEWS_SITE_ORIGIN │ ex: https://waapply.com         │
 *
 *  COLONNES DE LA FEUILLE MakeMoneyAI (14 colonnes) :
 *  A  ID           | Numéro (1, 2, 3...)
 *  B  Title        | Titre viral clickbait
 *  C  Source       | Source (ex: "AI Generated")
 *  D  Category     | AI Tools / Side Hustle / Passive Income...
 *  E  Image URL    | URL de l'image principale
 *  F  Published At | Date de publication (YYYY-MM-DD)
 *  G  Description  | Contenu HTML complet (1200+ mots)
 *  H  Summary      | Résumé 2-3 phrases
 *  I  SEO Title    | Titre SEO max 60 caractères
 *  J  Meta Desc    | Description méta max 160 caractères
 *  K  Keywords     | Mots-clés (virgule-séparés)
 *  L  Slug         | URL slug (auto si vide)
 *  M  Status       | vide = en attente | "published" = envoyé
 *  N  Added At     | Date d'ajout (auto-remplie)
 * ============================================================
 */

// ──────────────────────────────────────────────────────────
//  CONFIG MakeMoneyAI
//  ⚠️  GITHUB_TOKEN et GITHUB_REPO viennent automatiquement
//      des Script Properties configurées dans code.gs
//      (Fichier → Propriétés du projet → Propriétés de script)
// ──────────────────────────────────────────────────────────
var MMA_CONFIG = {
  SHEET_NAME:       'MakeMoneyAI',
  GITHUB_FILE:      'make-money-ai.json',   // fichier JSON cible dans le repo
  GITHUB_BRANCH:    'main',
  ARTICLES_PER_RUN: 5,
  DEFAULT_OG_IMAGE: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop&q=80',
  TOPICS: [
    'AI Tools', 'Make Money Online', 'Side Hustle',
    'Passive Income', 'Automation', 'Freelance', 'Affiliate Marketing'
  ]
};

// ──────────────────────────────────────────────────────────
//  COLONNES (index 0-based) — 14 colonnes
//  A=0  B=1  C=2  D=3  E=4  F=5  G=6  H=7
//  I=8  J=9  K=10 L=11 M=12 N=13
// ──────────────────────────────────────────────────────────
var MMA_COL = {
  ID:           0,   // A — ID
  TITLE:        1,   // B — Title
  SOURCE:       2,   // C — Source
  CATEGORY:     3,   // D — Category
  IMAGE:        4,   // E — Image URL
  PUBLISHED_AT: 5,   // F — Published At
  DESCRIPTION:  6,   // G — Description (HTML complet)
  SUMMARY:      7,   // H — Summary
  SEO_TITLE:    8,   // I — SEO Title
  META_DESC:    9,   // J — Meta Description
  KEYWORDS:    10,   // K — Keywords
  SLUG:        11,   // L — Slug
  STATUS:      12,   // M — Status (vide / "published")
  ADDED_AT:    13    // N — Added At
};

// ──────────────────────────────────────────────────────────
//  HELPERS — Réutilisent code.gs via aiNews_getProp_()
// ──────────────────────────────────────────────────────────

/** Lit le GITHUB_TOKEN déjà sauvegardé dans Script Properties */
function mma_getToken_() {
  var token = aiNews_getProp_('GITHUB_TOKEN');
  if (!token) {
    throw new Error(
      '❌ GITHUB_TOKEN introuvable dans les Script Properties.\n' +
      'Va dans : Extensions → Apps Script → ⚙️ Paramètres du projet → Propriétés de script\n' +
      'et ajoute : GITHUB_TOKEN = ghp_xxxx...'
    );
  }
  return token;
}

/** Lit le GITHUB_REPO déjà sauvegardé dans Script Properties */
function mma_getRepo_() {
  var repo = aiNews_getProp_('GITHUB_REPO');
  if (!repo) {
    throw new Error(
      '❌ GITHUB_REPO introuvable dans les Script Properties.\n' +
      'Ajoute : GITHUB_REPO = INVOOFFICE/ai-news'
    );
  }
  return repo;
}

/** Génère un slug URL-friendly depuis le titre */
function mma_slugify_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'article';
}

/** Formate une date en ISO 8601 */
function mma_dateIso_(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  var d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ──────────────────────────────────────────────────────────
//  MENU — s'ajoute au onOpen() de code.gs
//  (onOpen() est déjà déclaré dans code.gs, on utilise
//   la même fonction en ajoutant un sous-menu)
// ──────────────────────────────────────────────────────────

/**
 * Ajoute le sous-menu MakeMoneyAI au menu principal de code.gs.
 * Appelle cette fonction depuis onOpen() dans code.gs OU
 * utilise la version autonome ci-dessous si code.gs l'importe.
 *
 * ⚠️  Dans code.gs, remplace :
 *    function onOpen() { aiNews_onOpen(); }
 * par :
 *    function onOpen() { aiNews_onOpen(); mma_addMenu_(); }
 */
function mma_addMenu_() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🤑 MakeMoneyAI')
    .addItem('📋 Créer la feuille MakeMoneyAI', 'mma_setupSheet')
    .addSeparator()
    .addItem('🚀 Publier 5 articles → GitHub (maintenant)', 'mma_publishArticles')
    .addSeparator()
    .addItem('⏰ Installer déclencheur quotidien (19h EST)', 'mma_createTrigger')
    .addItem('🗑️  Supprimer le déclencheur', 'mma_deleteTrigger')
    .addSeparator()
    .addItem('📊 Voir le statut des articles', 'mma_showStatus')
    .addItem('🔑 Vérifier la configuration', 'mma_checkConfig')
    .addToUi();
}

// ──────────────────────────────────────────────────────────
//  1. CRÉER LA FEUILLE MakeMoneyAI
// ──────────────────────────────────────────────────────────
function mma_setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName(MMA_CONFIG.SHEET_NAME);
  if (existing) {
    SpreadsheetApp.getUi().alert(
      '⚠️ La feuille "' + MMA_CONFIG.SHEET_NAME + '" existe déjà.\n' +
      'Supprime-la d\'abord si tu veux la recréer.'
    );
    return;
  }

  var sheet = ss.insertSheet(MMA_CONFIG.SHEET_NAME);

  // ── En-têtes — 14 colonnes exactes ──
  var headers = [
    'ID', 'Title', 'Source', 'Category', 'Image URL',
    'Published At', 'Description', 'Summary',
    'SEO Title', 'Meta Description', 'Keywords',
    'Slug', 'Status', 'Added At'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ── Style en-tête — vert Make Money ──
  var hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setBackground('#064e3b');
  hRange.setFontColor('#6ee7b7');
  hRange.setFontWeight('bold');
  hRange.setFontSize(10);
  hRange.setHorizontalAlignment('center');

  // ── Largeurs des colonnes ──
  var widths = [50, 320, 120, 140, 200, 110, 500, 300, 200, 280, 280, 200, 90, 160];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // ── Figer la 1ère ligne ──
  sheet.setFrozenRows(1);

  // ── Validation Status (M) ──
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['', 'published'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, MMA_COL.STATUS + 1, 300, 1).setDataValidation(statusRule);

  // ── Validation Category (D) ──
  var catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(MMA_CONFIG.TOPICS, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, MMA_COL.CATEGORY + 1, 300, 1).setDataValidation(catRule);

  // ── Lignes alternées ──
  sheet.getRange(2, 1, 300, headers.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

  // ── Note d'aide ──
  sheet.getRange('A1').setNote(
    '📋 STRUCTURE MakeMoneyAI — 14 colonnes\n\n' +
    'A  ID           → Numéro (1, 2, 3...)\n' +
    'B  Title        → Titre viral clickbait\n' +
    'C  Source       → ex: AI Generated\n' +
    'D  Category     → AI Tools / Side Hustle / etc.\n' +
    'E  Image URL    → URL image Unsplash\n' +
    'F  Published At → YYYY-MM-DD\n' +
    'G  Description  → Contenu HTML complet (1200+ mots)\n' +
    'H  Summary      → 2-3 phrases résumé\n' +
    'I  SEO Title    → max 60 caractères\n' +
    'J  Meta Desc    → max 160 caractères\n' +
    'K  Keywords     → virgule-séparés\n' +
    'L  Slug         → url-friendly (auto si vide)\n' +
    'M  Status       → vide = en attente / published = envoyé ✅\n' +
    'N  Added At     → auto-rempli\n\n' +
    '🔑 GITHUB_TOKEN & GITHUB_REPO déjà dans Script Properties\n\n' +
    'WORKFLOW:\n' +
    '1. Colle tes 50 articles (A → N)\n' +
    '2. Laisse la colonne M (Status) VIDE\n' +
    '3. Menu 🤑 → Publier 5 articles → GitHub\n' +
    '4. La colonne M se remplit automatiquement ✅'
  );

  SpreadsheetApp.getUi().alert(
    '✅ Feuille "' + MMA_CONFIG.SHEET_NAME + '" créée !\n\n' +
    '📋 14 colonnes configurées :\n' +
    'ID | Title | Source | Category | Image URL\n' +
    'Published At | Description | Summary\n' +
    'SEO Title | Meta Description | Keywords\n' +
    'Slug | Status | Added At\n\n' +
    '🔑 Tokens récupérés automatiquement depuis Script Properties ✅\n' +
    '→ GITHUB_TOKEN : ' + (aiNews_getProp_('GITHUB_TOKEN') ? '✅ configuré' : '❌ MANQUANT') + '\n' +
    '→ GITHUB_REPO  : ' + (aiNews_getProp_('GITHUB_REPO')  ? '✅ ' + aiNews_getProp_('GITHUB_REPO') : '❌ MANQUANT')
  );
}

// ──────────────────────────────────────────────────────────
//  2. PUBLIER 5 ARTICLES VERS GITHUB
//     Utilise aiNews_githubRequest_() et aiNews_githubPutFile_()
//     de code.gs — même token, même repo
// ──────────────────────────────────────────────────────────
function mma_publishArticles() {
  var token = mma_getToken_();
  var repo  = mma_getRepo_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MMA_CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('❌ Feuille "' + MMA_CONFIG.SHEET_NAME + '" introuvable. Lance mma_setupSheet() d\'abord.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('ℹ️ Aucune donnée dans ' + MMA_CONFIG.SHEET_NAME);
    SpreadsheetApp.getActiveSpreadsheet().toast('Aucun article dans la feuille.', 'ℹ️ MakeMoneyAI', 4);
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  // ── Trouver les articles non encore publiés ──
  var pending = [];
  data.forEach(function(row, idx) {
    var title  = String(row[MMA_COL.TITLE]  || '').trim();
    var status = String(row[MMA_COL.STATUS] || '').trim().toLowerCase();
    if (title && status !== 'published') {
      pending.push({ row: row, rowIndex: idx + 2 });
    }
  });

  if (!pending.length) {
    Logger.log('ℹ️ MakeMoneyAI: tous les articles sont déjà publiés.');
    aiNews_notify_('🤑 MakeMoneyAI : tous les articles sont déjà publiés ! 🎉');
    return;
  }

  var toPublish = pending.slice(0, MMA_CONFIG.ARTICLES_PER_RUN);
  Logger.log('📤 MakeMoneyAI: ' + toPublish.length + ' articles à publier (sur ' + pending.length + ' en attente)');

  // ── Récupérer le JSON actuel depuis GitHub ──
  var currentData = mma_fetchCurrentJson_(repo, token);
  var existingArticles = currentData.articles || [];
  var existingSlugs = {};
  existingArticles.forEach(function(a) { if (a.slug) existingSlugs[a.slug] = true; });

  // ── Construire les nouveaux articles ──
  var newArticles = [];
  toPublish.forEach(function(item) {
    var article = mma_buildArticle_(item.row);
    if (!existingSlugs[article.slug]) {
      newArticles.push(article);
    }
  });

  if (!newArticles.length) {
    Logger.log('⚠️ MakeMoneyAI: tous les slugs existent déjà sur GitHub');
    aiNews_notify_('⚠️ MakeMoneyAI : ces articles existent déjà sur GitHub.');
    return;
  }

  // ── Fusionner : nouveaux EN PREMIER ──
  var merged = newArticles.concat(existingArticles);

  // ── Construire le JSON final ──
  var siteOrigin = (aiNews_getProp_('AI_NEWS_SITE_ORIGIN') || '').replace(/\/+$/, '');
  var finalJson = {
    site: {
      name:           'waapply',
      canonicalOrigin: siteOrigin,
      language:       'en',
      defaultOgImage: MMA_CONFIG.DEFAULT_OG_IMAGE,
      topics:         MMA_CONFIG.TOPICS
    },
    articles: merged
  };

  // ── Pousser via aiNews_githubPutFile_() de code.gs ──
  var content = JSON.stringify(finalJson, null, 2) + '\n';
  aiNews_githubPutFile_(
    repo,
    MMA_CONFIG.GITHUB_FILE,
    MMA_CONFIG.GITHUB_BRANCH,
    token,
    content,
    'feat(mma): publish ' + newArticles.length + ' MakeMoneyAI articles'
  );

  // ── Marquer Status = "published" + remplir Added At ──
  var now = Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'
  );
  toPublish.forEach(function(item) {
    sheet.getRange(item.rowIndex, MMA_COL.STATUS   + 1).setValue('published');
    var addedAt = String(item.row[MMA_COL.ADDED_AT] || '').trim();
    if (!addedAt) {
      sheet.getRange(item.rowIndex, MMA_COL.ADDED_AT + 1).setValue(now);
    }
  });

  Logger.log('✅ MakeMoneyAI: ' + newArticles.length + ' articles publiés → ' + MMA_CONFIG.GITHUB_FILE);
  aiNews_notify_('✅ MakeMoneyAI : ' + newArticles.length + ' articles publiés vers GitHub !');
}

// ──────────────────────────────────────────────────────────
//  HELPER — Récupère le JSON actuel depuis GitHub
//           Réutilise aiNews_githubRequest_() de code.gs
// ──────────────────────────────────────────────────────────
function mma_fetchCurrentJson_(repo, token) {
  var url =
    'https://api.github.com/repos/' + repo +
    '/contents/' + MMA_CONFIG.GITHUB_FILE +
    '?ref=' + MMA_CONFIG.GITHUB_BRANCH;

  try {
    var res = aiNews_githubRequest_('get', url, token, null);
    if (!res || !res.content) return { articles: [] };
    var decoded = Utilities.newBlob(Utilities.base64Decode(res.content)).getDataAsString();
    return JSON.parse(decoded);
  } catch (e) {
    // Fichier n'existe pas encore → JSON vide
    Logger.log('ℹ️ MakeMoneyAI: ' + MMA_CONFIG.GITHUB_FILE + ' absent sur GitHub, sera créé.');
    return { articles: [] };
  }
}

// ──────────────────────────────────────────────────────────
//  HELPER — Construit un objet article depuis une ligne
// ──────────────────────────────────────────────────────────
function mma_buildArticle_(row) {
  var title       = String(row[MMA_COL.TITLE]       || '').trim();
  var source      = String(row[MMA_COL.SOURCE]      || 'AI Generated').trim();
  var category    = String(row[MMA_COL.CATEGORY]    || 'Make Money Online').trim();
  var image       = String(row[MMA_COL.IMAGE]       || '').trim() || MMA_CONFIG.DEFAULT_OG_IMAGE;
  var publishedAt = mma_dateIso_(row[MMA_COL.PUBLISHED_AT]);
  var description = String(row[MMA_COL.DESCRIPTION] || '').trim();
  var summary     = String(row[MMA_COL.SUMMARY]     || '').trim() || description.slice(0, 300);
  var seoTitle    = String(row[MMA_COL.SEO_TITLE]   || '').trim() || title.slice(0, 60);
  var metaDesc    = String(row[MMA_COL.META_DESC]   || '').trim();
  var keywords    = String(row[MMA_COL.KEYWORDS]    || '').trim();
  var slug        = String(row[MMA_COL.SLUG]        || '').trim() || mma_slugify_(title);
  var id          = String(row[MMA_COL.ID]          || '').trim() || Utilities.getUuid();

  return {
    id:              id,
    title:           title,
    seoTitle:        seoTitle,
    metaDescription: metaDesc,
    category:        category,
    image:           image,
    imageAlt:        title,
    source:          { name: source },
    publishedAt:     publishedAt,
    description:     description,
    summary:         summary,
    intro:           summary || description.slice(0, 400),
    bullets:         [summary ? summary.slice(0, 150) : description.slice(0, 150)],
    whyItMatters:    summary,
    keywords:        keywords,
    slug:            slug
  };
}

// ──────────────────────────────────────────────────────────
//  3. STATUT DES ARTICLES
// ──────────────────────────────────────────────────────────
function mma_showStatus() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MMA_CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Feuille "' + MMA_CONFIG.SHEET_NAME + '" introuvable.');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('ℹ️ Aucun article dans la feuille.');
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var total = 0, published = 0, pending = 0;

  data.forEach(function(row) {
    var title  = String(row[MMA_COL.TITLE]  || '').trim();
    if (!title) return;
    total++;
    String(row[MMA_COL.STATUS] || '').trim().toLowerCase() === 'published' ? published++ : pending++;
  });

  SpreadsheetApp.getUi().alert(
    '📊 Statut MakeMoneyAI\n\n' +
    'Total articles  : ' + total + '\n' +
    '✅ Publiés      : ' + published + '\n' +
    '⏳ En attente   : ' + pending + '\n\n' +
    (pending > 0
      ? '👉 Lance "Publier 5 articles" pour envoyer ' +
        Math.min(pending, MMA_CONFIG.ARTICLES_PER_RUN) + ' articles vers GitHub.'
      : '🎉 Tous les articles sont publiés !')
  );
}

// ──────────────────────────────────────────────────────────
//  4. VÉRIFIER LA CONFIGURATION
// ──────────────────────────────────────────────────────────
function mma_checkConfig() {
  var token = aiNews_getProp_('GITHUB_TOKEN');
  var repo  = aiNews_getProp_('GITHUB_REPO');
  var origin = aiNews_getProp_('AI_NEWS_SITE_ORIGIN');

  SpreadsheetApp.getUi().alert(
    '🔑 Configuration MakeMoneyAI\n\n' +
    '(Propriétaires partagées avec code.gs)\n\n' +
    'GITHUB_TOKEN    : ' + (token ? '✅ Configuré (' + token.slice(0,8) + '...)' : '❌ MANQUANT') + '\n' +
    'GITHUB_REPO     : ' + (repo  ? '✅ ' + repo : '❌ MANQUANT') + '\n' +
    'AI_NEWS_SITE_ORIGIN : ' + (origin ? '✅ ' + origin : '⚠️ vide (optionnel)') + '\n\n' +
    'Fichier cible   : ' + MMA_CONFIG.GITHUB_FILE + '\n' +
    'Branche         : ' + MMA_CONFIG.GITHUB_BRANCH + '\n\n' +
    ((!token || !repo)
      ? '⚠️ Pour configurer :\nExtensions → Apps Script\n→ ⚙️ Paramètres du projet\n→ Propriétés de script\n→ Ajouter GITHUB_TOKEN et GITHUB_REPO'
      : '✅ Tout est configuré !')
  );
}

// ──────────────────────────────────────────────────────────
//  5. DÉCLENCHEUR QUOTIDIEN — 19h00 EST (prime time USA)
//     Réutilise le fuseau horaire configuré sur America/New_York
// ──────────────────────────────────────────────────────────
function mma_createTrigger() {
  // Supprimer les anciens pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'mma_publishArticles') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Déclencheur quotidien à 19h00
  // → Règle le fuseau horaire sur America/New_York dans :
  //   ⚙️ Paramètres du projet → Fuseau horaire
  ScriptApp.newTrigger('mma_publishArticles')
    .timeBased()
    .everyDays(1)
    .atHour(19)   // 19h00 (7 PM) heure du projet
    .create();

  Logger.log('✅ MakeMoneyAI: déclencheur quotidien 19h00 créé');
  aiNews_notify_(
    '✅ Déclencheur quotidien installé !\n\n' +
    '📅 Publication : 1x par jour à 19h00\n' +
    '🇺🇸 Prime time USA — les américains sont à la maison\n' +
    '📰 5 articles publiés à chaque déclenchement\n\n' +
    '⚠️  Vérifier le fuseau horaire du projet :\n' +
    'Apps Script → ⚙️ Paramètres → Fuseau horaire\n' +
    '→ Choisir : America/New_York (EST/EDT)'
  );
}

function mma_deleteTrigger() {
  var deleted = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'mma_publishArticles') {
      ScriptApp.deleteTrigger(t);
      deleted++;
    }
  });
  aiNews_notify_(
    deleted > 0
      ? '✅ ' + deleted + ' déclencheur(s) MakeMoneyAI supprimé(s).'
      : 'ℹ️ Aucun déclencheur MakeMoneyAI trouvé.'
  );
}
