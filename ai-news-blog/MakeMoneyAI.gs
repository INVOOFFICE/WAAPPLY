/**
 * ============================================================
 *  MAKE MONEY AI — Google Apps Script
 * ============================================================
 *
 *  SETUP RAPIDE :
 *  1. Dans Google Sheets → Extensions → Apps Script → coller ce code
 *  2. Lancer setupMakeMoneyAISheet() UNE SEULE FOIS pour créer la feuille
 *  3. Remplir les lignes manuellement dans la feuille "MakeMoneyAI"
 *  4. Lancer publishMakeMoneyAI() pour publier 5 articles vers GitHub
 *     (un déclencheur peut être configuré pour automatiser ça)
 *
 *  COLONNES DE LA FEUILLE MakeMoneyAI :
 *  A  id           | Identifiant unique (auto-généré si vide)
 *  B  title        | Titre de l'article
 *  C  seoTitle     | Titre SEO (optimisé pour Google, max 60 chars)
 *  D  metaDescription | Description méta (max 160 chars)
 *  E  category     | Catégorie (ex: Make Money Online, AI Income, Freelance...)
 *  F  image        | URL de l'image principale
 *  G  imageAlt     | Texte alternatif de l'image
 *  H  url          | URL source de l'article
 *  I  source       | Nom de la source
 *  J  publishedAt  | Date de publication (format ISO 8601)
 *  K  description  | Description courte
 *  L  summary      | Résumé complet
 *  M  intro        | Introduction (1-2 phrases)
 *  N  bullets      | Points clés (séparés par |)
 *  O  whyItMatters | Pourquoi c'est important
 *  P  keywords     | Mots-clés SEO (séparés par virgule)
 *  Q  slug         | Slug URL (auto-généré si vide)
 *  R  published    | Statut: vide = non publié, "YES" = publié
 * ============================================================
 */

// ──────────────────────────────────────────────
//  CONFIGURATION — Mettre à jour ces valeurs
// ──────────────────────────────────────────────
var MAKE_MONEY_CONFIG = {
  SHEET_NAME:      "MakeMoneyAI",
  GITHUB_OWNER:    "INVOOFFICE",           // ← ton username GitHub
  GITHUB_REPO:     "ai-news",              // ← nom du dépôt
  GITHUB_FILE:     "make-money-ai.json",   // ← fichier JSON cible
  GITHUB_BRANCH:   "main",
  GITHUB_TOKEN:    "",                     // ← ton GitHub Personal Access Token
  ARTICLES_PER_RUN: 5,                    // Nombre d'articles publiés par déclenchement
  DEFAULT_OG_IMAGE: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop&q=80",
  SITE_NAME:       "waapply",
  CANONICAL_ORIGIN: "",                   // ex: "https://waapply.com"
  TOPICS: [
    "Make Money Online", "AI Income", "Freelance",
    "Side Hustle", "Passive Income", "Affiliate Marketing", "Digital Products"
  ]
};

// ──────────────────────────────────────────────
//  COLONNES (index 0-based)
// ──────────────────────────────────────────────
var MMA_COL = {
  ID:               0,   // A
  TITLE:            1,   // B
  SEO_TITLE:        2,   // C
  META_DESC:        3,   // D
  CATEGORY:         4,   // E
  IMAGE:            5,   // F
  IMAGE_ALT:        6,   // G
  URL:              7,   // H
  SOURCE:           8,   // I
  PUBLISHED_AT:     9,   // J
  DESCRIPTION:     10,   // K
  SUMMARY:         11,   // L
  INTRO:           12,   // M
  BULLETS:         13,   // N
  WHY_IT_MATTERS:  14,   // O
  KEYWORDS:        15,   // P
  SLUG:            16,   // Q
  PUBLISHED_FLAG:  17,   // R
};

// ──────────────────────────────────────────────
//  1. CRÉER LA FEUILLE MakeMoneyAI
//     Lancer UNE SEULE FOIS
// ──────────────────────────────────────────────
function setupMakeMoneyAISheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName(MAKE_MONEY_CONFIG.SHEET_NAME);
  if (existing) {
    SpreadsheetApp.getUi().alert(
      '⚠️ La feuille "' + MAKE_MONEY_CONFIG.SHEET_NAME + '" existe déjà.'
    );
    return;
  }

  var sheet = ss.insertSheet(MAKE_MONEY_CONFIG.SHEET_NAME);

  // ── En-têtes ──
  var headers = [
    "id", "title", "seoTitle", "metaDescription", "category",
    "image", "imageAlt", "url", "source", "publishedAt",
    "description", "summary", "intro", "bullets", "whyItMatters",
    "keywords", "slug", "published"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ── Style de l'en-tête ──
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1a1a2e");
  headerRange.setFontColor("#e0e0ff");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);

  // ── Largeurs des colonnes ──
  var colWidths = [120, 300, 250, 300, 150, 250, 200, 280, 120, 160,
                   280, 350, 280, 300, 300, 250, 200, 80];
  colWidths.forEach(function(w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  // ── Figer la 1ère ligne ──
  sheet.setFrozenRows(1);

  // ── Validation de la colonne "published" (R) ──
  var publishedRange = sheet.getRange(2, MMA_COL.PUBLISHED_FLAG + 1, 100, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["", "YES"], true)
    .setAllowInvalid(false)
    .build();
  publishedRange.setDataValidation(rule);

  // ── Validation de la colonne "category" (E) ──
  var catRange = sheet.getRange(2, MMA_COL.CATEGORY + 1, 100, 1);
  var catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(MAKE_MONEY_CONFIG.TOPICS, true)
    .setAllowInvalid(true)
    .build();
  catRange.setDataValidation(catRule);

  // ── Couleur alternée pour les lignes ──
  var banding = sheet.getRange(2, 1, 100, headers.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

  // ── Note d'aide dans la cellule A1 ──
  sheet.getRange("A1").setNote(
    "Colonne A: ID unique (auto-généré si vide)\n" +
    "Colonne R: Mettre YES pour marquer comme publié\n\n" +
    "WORKFLOW:\n" +
    "1. Remplir une ligne par article\n" +
    "2. Laisser la colonne R vide\n" +
    "3. Lancer publishMakeMoneyAI() ou le déclencheur\n" +
    "4. Les 5 premiers articles non publiés seront envoyés vers GitHub\n" +
    "5. La colonne R sera automatiquement marquée YES"
  );

  SpreadsheetApp.getUi().alert(
    '✅ Feuille "' + MAKE_MONEY_CONFIG.SHEET_NAME + '" créée avec succès !\n\n' +
    'Prochaines étapes :\n' +
    '1. Remplir les lignes manuellement\n' +
    '2. Configurer GITHUB_TOKEN dans le script\n' +
    '3. Lancer publishMakeMoneyAI() pour publier'
  );

  Logger.log('✅ Sheet "' + MAKE_MONEY_CONFIG.SHEET_NAME + '" created successfully');
}

// ──────────────────────────────────────────────
//  2. PUBLIER 5 ARTICLES VERS GITHUB
//     Lancer via déclencheur ou manuellement
// ──────────────────────────────────────────────
function publishMakeMoneyAI() {
  var cfg = MAKE_MONEY_CONFIG;

  if (!cfg.GITHUB_TOKEN) {
    throw new Error("❌ GITHUB_TOKEN non configuré dans MAKE_MONEY_CONFIG");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(cfg.SHEET_NAME);
  if (!sheet) {
    throw new Error('❌ Feuille "' + cfg.SHEET_NAME + '" introuvable. Lance setupMakeMoneyAISheet() d\'abord.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("ℹ️ Aucune donnée dans la feuille " + cfg.SHEET_NAME);
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();

  // ── Trouver les articles non encore publiés ──
  var unpublished = [];
  data.forEach(function(row, idx) {
    var title         = String(row[MMA_COL.TITLE] || "").trim();
    var publishedFlag = String(row[MMA_COL.PUBLISHED_FLAG] || "").trim().toUpperCase();
    if (title && publishedFlag !== "YES") {
      unpublished.push({ row: row, rowIndex: idx + 2 }); // +2 car 1-indexed et on skip header
    }
  });

  if (!unpublished.length) {
    Logger.log("ℹ️ Aucun article à publier dans " + cfg.SHEET_NAME);
    return;
  }

  // ── Prendre les N premiers articles non publiés ──
  var toPublish = unpublished.slice(0, cfg.ARTICLES_PER_RUN);
  Logger.log("📤 Articles à publier : " + toPublish.length + " (sur " + unpublished.length + " non publiés)");

  // ── Récupérer le JSON actuel depuis GitHub ──
  var currentJson = fetchMakeMoneyJsonFromGitHub_(cfg);
  var existingArticles = (currentJson.articles || []);
  var existingSlugs = {};
  existingArticles.forEach(function(a) { existingSlugs[a.slug] = true; });

  // ── Construire les nouveaux articles ──
  var newArticles = [];
  toPublish.forEach(function(item) {
    var row = item.row;
    var article = buildArticleFromRow_(row, cfg);
    if (!existingSlugs[article.slug]) {
      newArticles.push(article);
    }
  });

  if (!newArticles.length) {
    Logger.log("⚠️ Tous les articles sélectionnés existent déjà dans GitHub");
    return;
  }

  // ── Fusionner : nouveaux articles EN PREMIER (plus récents) ──
  var mergedArticles = newArticles.concat(existingArticles);

  // ── Construire le JSON final ──
  var finalJson = {
    site: {
      name: cfg.SITE_NAME,
      canonicalOrigin: cfg.CANONICAL_ORIGIN,
      language: "en",
      defaultOgImage: cfg.DEFAULT_OG_IMAGE,
      topics: cfg.TOPICS
    },
    articles: mergedArticles
  };

  // ── Pousser vers GitHub ──
  pushJsonToGitHub_(cfg, finalJson, currentJson._sha);

  // ── Marquer les articles publiés dans la feuille ──
  toPublish.forEach(function(item) {
    sheet.getRange(item.rowIndex, MMA_COL.PUBLISHED_FLAG + 1).setValue("YES");
  });

  Logger.log("✅ " + newArticles.length + " articles publiés vers GitHub (" + cfg.GITHUB_FILE + ")");
  SpreadsheetApp.getActiveSpreadsheet().toast(
    newArticles.length + " articles publiés vers GitHub !",
    "✅ MakeMoneyAI",
    5
  );
}

// ──────────────────────────────────────────────
//  HELPERS — Fonctions internes
// ──────────────────────────────────────────────

function buildArticleFromRow_(row, cfg) {
  var id          = String(row[MMA_COL.ID] || "").trim() || generateId_();
  var title       = String(row[MMA_COL.TITLE] || "").trim();
  var seoTitle    = String(row[MMA_COL.SEO_TITLE] || "").trim() || title;
  var metaDesc    = String(row[MMA_COL.META_DESC] || "").trim();
  var category    = String(row[MMA_COL.CATEGORY] || "Make Money Online").trim();
  var image       = String(row[MMA_COL.IMAGE] || "").trim() || cfg.DEFAULT_OG_IMAGE;
  var imageAlt    = String(row[MMA_COL.IMAGE_ALT] || "").trim() || title;
  var url         = String(row[MMA_COL.URL] || "").trim();
  var source      = String(row[MMA_COL.SOURCE] || "MakeMoneyAI").trim();
  var publishedAt = formatDateIso_(row[MMA_COL.PUBLISHED_AT]);
  var description = String(row[MMA_COL.DESCRIPTION] || "").trim();
  var summary     = String(row[MMA_COL.SUMMARY] || "").trim() || description;
  var intro       = String(row[MMA_COL.INTRO] || "").trim() || description;
  var bulletsRaw  = String(row[MMA_COL.BULLETS] || "").trim();
  var whyItMatters= String(row[MMA_COL.WHY_IT_MATTERS] || "").trim();
  var keywords    = String(row[MMA_COL.KEYWORDS] || "").trim();
  var slug        = String(row[MMA_COL.SLUG] || "").trim() || slugify_(title);

  var bullets = bulletsRaw
    ? bulletsRaw.split("|").map(function(b) { return b.trim(); }).filter(Boolean)
    : [description];

  return {
    id:              id,
    title:           title,
    seoTitle:        seoTitle,
    metaDescription: metaDesc,
    category:        category,
    image:           image,
    imageAlt:        imageAlt,
    url:             url,
    source:          { name: source },
    publishedAt:     publishedAt,
    description:     description,
    summary:         summary,
    intro:           intro,
    bullets:         bullets,
    whyItMatters:    whyItMatters,
    keywords:        keywords,
    slug:            slug
  };
}

function fetchMakeMoneyJsonFromGitHub_(cfg) {
  var url = "https://api.github.com/repos/" + cfg.GITHUB_OWNER + "/" +
            cfg.GITHUB_REPO + "/contents/" + cfg.GITHUB_FILE +
            "?ref=" + cfg.GITHUB_BRANCH;

  var response = UrlFetchApp.fetch(url, {
    method: "GET",
    headers: {
      "Authorization": "token " + cfg.GITHUB_TOKEN,
      "Accept":        "application/vnd.github.v3+json"
    },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code === 404) {
    // Fichier n'existe pas encore — on retourne un JSON vide
    Logger.log("ℹ️ " + cfg.GITHUB_FILE + " n'existe pas encore sur GitHub, il sera créé.");
    return { articles: [], _sha: null };
  }
  if (code !== 200) {
    throw new Error("❌ GitHub API error " + code + ": " + response.getContentText());
  }

  var res = JSON.parse(response.getContentText());
  var sha = res.sha;
  var content = Utilities.newBlob(Utilities.base64Decode(res.content)).getDataAsString();
  var parsed = JSON.parse(content);
  parsed._sha = sha;
  return parsed;
}

function pushJsonToGitHub_(cfg, jsonData, sha) {
  var url = "https://api.github.com/repos/" + cfg.GITHUB_OWNER + "/" +
            cfg.GITHUB_REPO + "/contents/" + cfg.GITHUB_FILE;

  var content = JSON.stringify(jsonData, null, 2) + "\n";
  var encoded = Utilities.base64Encode(Utilities.newBlob(content).getBytes());

  var payload = {
    message: "feat(mma): publish " + Math.min(jsonData.articles.length, cfg.ARTICLES_PER_RUN) + " MakeMoneyAI articles [skip ci]",
    content: encoded,
    branch:  cfg.GITHUB_BRANCH
  };
  if (sha) payload.sha = sha;

  var response = UrlFetchApp.fetch(url, {
    method:  "PUT",
    headers: {
      "Authorization": "token " + cfg.GITHUB_TOKEN,
      "Accept":        "application/vnd.github.v3+json",
      "Content-Type":  "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error("❌ GitHub push failed " + code + ": " + response.getContentText());
  }
  Logger.log("✅ GitHub push OK (" + code + ")");
}

function slugify_(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "article";
}

function generateId_() {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var id = "";
  for (var i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function formatDateIso_(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  var d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

// ──────────────────────────────────────────────
//  3. MENU PERSONNALISÉ dans Google Sheets
// ──────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🤑 MakeMoneyAI")
    .addItem("📋 Créer la feuille MakeMoneyAI", "setupMakeMoneyAISheet")
    .addSeparator()
    .addItem("🚀 Publier 5 articles →  GitHub", "publishMakeMoneyAI")
    .addSeparator()
    .addItem("📊 Voir le statut des articles", "showMakeMoneyStatus")
    .addToUi();
}

// ──────────────────────────────────────────────
//  4. AFFICHER LE STATUT DES ARTICLES
// ──────────────────────────────────────────────
function showMakeMoneyStatus() {
  var cfg = MAKE_MONEY_CONFIG;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(cfg.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Feuille "' + cfg.SHEET_NAME + '" introuvable.');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert("ℹ️ Aucun article dans la feuille.");
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  var total = 0, published = 0, unpublished = 0;

  data.forEach(function(row) {
    var title = String(row[MMA_COL.TITLE] || "").trim();
    if (!title) return;
    total++;
    var flag = String(row[MMA_COL.PUBLISHED_FLAG] || "").trim().toUpperCase();
    if (flag === "YES") published++;
    else unpublished++;
  });

  SpreadsheetApp.getUi().alert(
    "📊 Statut MakeMoneyAI\n\n" +
    "Total articles : " + total + "\n" +
    "✅ Publiés     : " + published + "\n" +
    "⏳ En attente  : " + unpublished + "\n\n" +
    (unpublished > 0
      ? "👉 Lance publishMakeMoneyAI() pour publier " +
        Math.min(unpublished, cfg.ARTICLES_PER_RUN) + " articles."
      : "🎉 Tous les articles sont publiés !")
  );
}

// ──────────────────────────────────────────────
//  5. CRÉER UN DÉCLENCHEUR AUTOMATIQUE (optionnel)
//     Lance publishMakeMoneyAI() toutes les heures
//     Appeler UNE SEULE FOIS depuis l'éditeur GAS
// ──────────────────────────────────────────────
function createMakeMoneyTrigger() {
  // Supprimer les anciens déclencheurs pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "publishMakeMoneyAI") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Créer un déclencheur toutes les heures
  ScriptApp.newTrigger("publishMakeMoneyAI")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("✅ Déclencheur créé : publishMakeMoneyAI toutes les heures");
  SpreadsheetApp.getUi().alert(
    "✅ Déclencheur créé !\n\n" +
    "publishMakeMoneyAI() sera lancé automatiquement toutes les heures.\n" +
    "Tu peux le désactiver via Déclencheurs dans l'éditeur Apps Script."
  );
}

// ──────────────────────────────────────────────
//  6. SUPPRIMER LE DÉCLENCHEUR automatique
// ──────────────────────────────────────────────
function deleteMakeMoneyTrigger() {
  var deleted = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "publishMakeMoneyAI") {
      ScriptApp.deleteTrigger(t);
      deleted++;
    }
  });
  SpreadsheetApp.getUi().alert(
    deleted > 0
      ? "✅ " + deleted + " déclencheur(s) supprimé(s)."
      : "ℹ️ Aucun déclencheur trouvé."
  );
}
