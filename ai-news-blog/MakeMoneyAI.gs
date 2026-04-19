/**
 * ============================================================
 *  MAKE MONEY AI — Google Apps Script
 * ============================================================
 *
 *  SETUP RAPIDE :
 *  1. Dans Google Sheets → Extensions → Apps Script → coller ce code
 *  2. Lancer setupMakeMoneyAISheet() UNE SEULE FOIS pour créer la feuille
 *  3. Coller tes articles directement (14 colonnes, voir ci-dessous)
 *  4. Cliquer Menu → Publier 5 articles → GitHub
 *     (ou installer le déclencheur quotidien 19h EST)
 *
 *  COLONNES DE LA FEUILLE MakeMoneyAI (14 colonnes) :
 *  A  ID           | Identifiant unique (ex: 1, 2, 3...)
 *  B  Title        | Titre de l'article (clickbait, viral)
 *  C  Source       | Source (ex: "AI Generated")
 *  D  Category     | Catégorie (AI Tools, Side Hustle, Passive Income...)
 *  E  Image URL    | URL de l'image principale
 *  F  Published At | Date de publication (YYYY-MM-DD)
 *  G  Description  | Contenu complet de l'article (HTML avec H2/H3)
 *  H  Summary      | Résumé 2-3 phrases
 *  I  SEO Title    | Titre SEO max 60 caractères
 *  J  Meta Description | Description méta max 160 caractères
 *  K  Keywords     | Mots-clés SEO (virgule-séparés)
 *  L  Slug         | URL slug (auto-généré si vide)
 *  M  Status       | vide = en attente | "published" = envoyé GitHub
 *  N  Added At     | Date d'ajout (auto-remplie)
 * ============================================================
 */

// ──────────────────────────────────────────────
//  CONFIGURATION — Mettre à jour ces valeurs
// ──────────────────────────────────────────────
var MAKE_MONEY_CONFIG = {
  SHEET_NAME:       "MakeMoneyAI",
  GITHUB_OWNER:     "INVOOFFICE",           // ← ton username GitHub
  GITHUB_REPO:      "ai-news",              // ← nom du dépôt
  GITHUB_FILE:      "make-money-ai.json",   // ← fichier JSON cible
  GITHUB_BRANCH:    "main",
  GITHUB_TOKEN:     "",                     // ← ton GitHub Personal Access Token
  ARTICLES_PER_RUN: 5,                      // Nombre d'articles publiés par déclenchement
  DEFAULT_OG_IMAGE: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop&q=80",
  SITE_NAME:        "waapply",
  CANONICAL_ORIGIN: "",                     // ex: "https://waapply.com"
  TOPICS: [
    "AI Tools", "Make Money Online", "Side Hustle",
    "Passive Income", "Automation", "Freelance", "Affiliate Marketing"
  ]
};

// ──────────────────────────────────────────────
//  COLONNES (index 0-based) — 14 colonnes
//  A=0  B=1  C=2  D=3  E=4  F=5  G=6  H=7
//  I=8  J=9  K=10 L=11 M=12 N=13
// ──────────────────────────────────────────────
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
  ADDED_AT:    13,   // N — Added At
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

  // ── En-têtes — 14 colonnes exactes ──
  var headers = [
    "ID", "Title", "Source", "Category", "Image URL",
    "Published At", "Description", "Summary",
    "SEO Title", "Meta Description", "Keywords",
    "Slug", "Status", "Added At"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ── Style de l'en-tête — vert Make Money ──
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#064e3b");   // vert foncé
  headerRange.setFontColor("#6ee7b7");    // vert clair
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment("center");

  // ── Largeurs des colonnes ──
  var colWidths = [
    50,   // A — ID
    320,  // B — Title
    120,  // C — Source
    140,  // D — Category
    200,  // E — Image URL
    110,  // F — Published At
    500,  // G — Description (large!)
    300,  // H — Summary
    200,  // I — SEO Title
    280,  // J — Meta Description
    280,  // K — Keywords
    200,  // L — Slug
    90,   // M — Status
    160   // N — Added At
  ];
  colWidths.forEach(function(w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  // ── Figer la 1ère ligne ──
  sheet.setFrozenRows(1);

  // ── Validation de la colonne Status (M = col 13) ──
  var statusRange = sheet.getRange(2, MMA_COL.STATUS + 1, 200, 1);
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["", "published"], true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusRule);

  // ── Validation de la colonne Category (D = col 4) ──
  var catRange = sheet.getRange(2, MMA_COL.CATEGORY + 1, 200, 1);
  var catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(MAKE_MONEY_CONFIG.TOPICS, true)
    .setAllowInvalid(true)
    .build();
  catRange.setDataValidation(catRule);

  // ── Couleur alternée pour les lignes de données ──
  sheet.getRange(2, 1, 200, headers.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

  // ── Note d'aide dans la cellule A1 ──
  sheet.getRange("A1").setNote(
    "📋 STRUCTURE MakeMoneyAI — 14 colonnes\n\n" +
    "A  ID           → Numéro (1, 2, 3...)\n" +
    "B  Title        → Titre viral clickbait\n" +
    "C  Source       → ex: AI Generated\n" +
    "D  Category     → AI Tools / Side Hustle / etc.\n" +
    "E  Image URL    → URL image Unsplash\n" +
    "F  Published At → YYYY-MM-DD\n" +
    "G  Description  → Contenu HTML complet (1200+ mots)\n" +
    "H  Summary      → 2-3 phrases résumé\n" +
    "I  SEO Title    → max 60 caractères\n" +
    "J  Meta Desc    → max 160 caractères\n" +
    "K  Keywords     → virgule-séparés\n" +
    "L  Slug         → url-friendly (auto si vide)\n" +
    "M  Status       → vide = en attente / published = envoyé\n" +
    "N  Added At     → auto-rempli\n\n" +
    "WORKFLOW:\n" +
    "1. Colle tes 50 articles (colonnes A à N)\n" +
    "2. Laisse la colonne M (Status) VIDE\n" +
    "3. Menu → Publier 5 articles → GitHub\n" +
    "4. La colonne M se remplit automatiquement"
  );

  SpreadsheetApp.getUi().alert(
    '✅ Feuille "' + MAKE_MONEY_CONFIG.SHEET_NAME + '" créée !\n\n' +
    '📋 14 colonnes configurées :\n' +
    'ID | Title | Source | Category | Image URL\n' +
    'Published At | Description | Summary\n' +
    'SEO Title | Meta Description | Keywords\n' +
    'Slug | Status | Added At\n\n' +
    '⚙️ Prochaine étape :\n' +
    '→ Configurer GITHUB_TOKEN dans le script\n' +
    '→ Coller tes articles et lancer la publication'
  );

  Logger.log('✅ Sheet "' + MAKE_MONEY_CONFIG.SHEET_NAME + '" — 14 colonnes créées avec succès');
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

  // Lire toutes les lignes (14 colonnes)
  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  // ── Trouver les articles non encore publiés (Status != "published") ──
  var unpublished = [];
  data.forEach(function(row, idx) {
    var title  = String(row[MMA_COL.TITLE] || "").trim();
    var status = String(row[MMA_COL.STATUS] || "").trim().toLowerCase();
    if (title && status !== "published") {
      unpublished.push({ row: row, rowIndex: idx + 2 });
    }
  });

  if (!unpublished.length) {
    Logger.log("ℹ️ Aucun article à publier dans " + cfg.SHEET_NAME);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Tous les articles sont déjà publiés !", "ℹ️ MakeMoneyAI", 4
    );
    return;
  }

  // ── Prendre les N premiers articles non publiés ──
  var toPublish = unpublished.slice(0, cfg.ARTICLES_PER_RUN);
  Logger.log("📤 Articles à publier : " + toPublish.length + " (sur " + unpublished.length + " en attente)");

  // ── Récupérer le JSON actuel depuis GitHub ──
  var currentJson = fetchMakeMoneyJsonFromGitHub_(cfg);
  var existingArticles = (currentJson.articles || []);
  var existingSlugs = {};
  existingArticles.forEach(function(a) { existingSlugs[a.slug] = true; });

  // ── Construire les nouveaux articles ──
  var newArticles = [];
  toPublish.forEach(function(item) {
    var article = buildArticleFromRow_(item.row, cfg);
    if (!existingSlugs[article.slug]) {
      newArticles.push(article);
    }
  });

  if (!newArticles.length) {
    Logger.log("⚠️ Tous les articles sélectionnés existent déjà dans GitHub");
    return;
  }

  // ── Fusionner : nouveaux articles EN PREMIER ──
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

  // ── Marquer Status = "published" + remplir Added At si vide ──
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  toPublish.forEach(function(item) {
    // Colonne M (Status) = index 13 en 1-based
    sheet.getRange(item.rowIndex, MMA_COL.STATUS + 1).setValue("published");
    // Colonne N (Added At) = index 14 en 1-based, si pas déjà remplie
    var addedAt = String(item.row[MMA_COL.ADDED_AT] || "").trim();
    if (!addedAt) {
      sheet.getRange(item.rowIndex, MMA_COL.ADDED_AT + 1).setValue(now);
    }
  });

  Logger.log("✅ " + newArticles.length + " articles publiés vers GitHub (" + cfg.GITHUB_FILE + ")");
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "✅ " + newArticles.length + " articles publiés vers GitHub !",
    "🤑 MakeMoneyAI",
    6
  );
}

// ──────────────────────────────────────────────
//  HELPERS — Fonctions internes
// ──────────────────────────────────────────────

function buildArticleFromRow_(row, cfg) {
  // ── Lecture des 14 colonnes ──
  var id          = String(row[MMA_COL.ID]          || "").trim() || generateId_();
  var title       = String(row[MMA_COL.TITLE]       || "").trim();
  var source      = String(row[MMA_COL.SOURCE]      || "AI Generated").trim();
  var category    = String(row[MMA_COL.CATEGORY]    || "Make Money Online").trim();
  var image       = String(row[MMA_COL.IMAGE]       || "").trim() || cfg.DEFAULT_OG_IMAGE;
  var publishedAt = formatDateIso_(row[MMA_COL.PUBLISHED_AT]);
  var description = String(row[MMA_COL.DESCRIPTION] || "").trim();
  var summary     = String(row[MMA_COL.SUMMARY]     || "").trim() || description.slice(0, 300);
  var seoTitle    = String(row[MMA_COL.SEO_TITLE]   || "").trim() || title.slice(0, 60);
  var metaDesc    = String(row[MMA_COL.META_DESC]   || "").trim();
  var keywords    = String(row[MMA_COL.KEYWORDS]    || "").trim();
  var slug        = String(row[MMA_COL.SLUG]        || "").trim() || slugify_(title);

  // ── Générer intro et bullets depuis description si absents ──
  var intro = summary || description.slice(0, 400);
  var bullets = [
    summary ? summary.slice(0, 150) : description.slice(0, 150)
  ];

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
    intro:           intro,
    bullets:         bullets,
    whyItMatters:    summary,
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
    .addItem("🚀 Publier 5 articles →  GitHub (maintenant)", "publishMakeMoneyAI")
    .addSeparator()
    .addItem("⏰ Installer déclencheur quotidien (19h EST)", "createMakeMoneyTrigger")
    .addItem("🗑️  Supprimer le déclencheur quotidien", "deleteMakeMoneyTrigger")
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

  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var total = 0, published = 0, pending = 0;

  data.forEach(function(row) {
    var title  = String(row[MMA_COL.TITLE]  || "").trim();
    if (!title) return;
    total++;
    var status = String(row[MMA_COL.STATUS] || "").trim().toLowerCase();
    if (status === "published") published++;
    else pending++;
  });

  SpreadsheetApp.getUi().alert(
    "📊 Statut MakeMoneyAI\n\n" +
    "Total articles  : " + total + "\n" +
    "✅ Publiés      : " + published + "\n" +
    "⏳ En attente   : " + pending + "\n\n" +
    (pending > 0
      ? "👉 Lance publishMakeMoneyAI() pour envoyer " +
        Math.min(pending, cfg.ARTICLES_PER_RUN) + " articles vers GitHub."
      : "🎉 Tous les articles sont publiés !")
  );
}

// ──────────────────────────────────────────────
//  5. CRÉER UN DÉCLENCHEUR QUOTIDIEN
//     Publie 5 articles chaque jour à 19h00 (heure américaine EST)
//     = prime time USA, quand les gens sont à la maison
//     ⚠️  Régler la timezone du projet sur America/New_York :
//         Apps Script → Paramètres du projet → Fuseau horaire
// ──────────────────────────────────────────────
function createMakeMoneyTrigger() {
  // Supprimer les anciens déclencheurs pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "publishMakeMoneyAI") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Déclencheur quotidien à 19h00 (fonctionne dans le fuseau horaire du projet)
  // → Régle le fuseau horaire sur America/New_York dans les paramètres du script
  ScriptApp.newTrigger("publishMakeMoneyAI")
    .timeBased()
    .everyDays(1)          // Une fois par jour
    .atHour(19)            // À 19h00 (7 PM) — heure du projet (régler sur EST)
    .create();

  Logger.log("✅ Déclencheur quotidien créé : publishMakeMoneyAI à 19h00 (fuseau horaire du projet)");
  SpreadsheetApp.getUi().alert(
    "✅ Déclencheur quotidien installé !\n\n" +
    "📅 Publication automatique : 1x par jour à 19h00\n" +
    "🇺🇸 Prime time USA — les américains sont à la maison\n" +
    "📰 5 articles publiés à chaque déclenchement\n\n" +
    "⚠️  IMPORTANT — Vérifier le fuseau horaire :\n" +
    "Apps Script → ⚙️ Paramètres → Fuseau horaire\n" +
    "→ Choisir : America/New_York (EST/EDT)"
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
