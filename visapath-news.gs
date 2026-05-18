// ============================================================
// VISAPATH — Automatisation Actualités Schengen via Groq + GitHub
// Google Apps Script — Code.gs
// ============================================================
// Propriétés du script à configurer (Fichier → Propriétés du projet) :
//   GROQ_API_KEY   → console.groq.com
//   GITHUB_TOKEN   → Personal Access Token GitHub (scope: repo)
//   GITHUB_OWNER   → ton username GitHub (ex: visapath-ma)
//   GITHUB_REPO    → nom du repo (ex: visapath)
// ============================================================

const CONFIG = {
  GROQ_API_KEY:  PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY'),
  GITHUB_TOKEN:  PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'),
  GITHUB_OWNER:  PropertiesService.getScriptProperties().getProperty('GITHUB_OWNER'),
  GITHUB_REPO:   PropertiesService.getScriptProperties().getProperty('GITHUB_REPO'),
  SHEET_NAME:    'Actualites',
  SITE_URL:      'https://visapath.ma',
};

// Colonnes de la feuille Google Sheet
const COL = {
  ID:           1,  // A
  TITLE:        2,  // B
  SUMMARY:      3,  // C
  TAG_TYPE:     4,  // D  → "alert" | "info" | "news"
  TAG_LABEL:    5,  // E  → ex: "France", "Général", "Important"
  PUBLISHED_AT: 6,  // F
  IS_MAIN:      7,  // G  → TRUE si article principal (news-main), FALSE sinon
  STATUS:       8,  // H  → "published" | "draft"
  ADDED_AT:     9,  // I
};

// ============================================================
// MENU
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ VISAPATH NEWS')
    .addItem('▶️  Générer une actualité maintenant',   'testManual')
    .addSeparator()
    .addItem('🔁 Installer trigger quotidien',          'installDailyTrigger')
    .addItem('🗑️  Supprimer tous les triggers',         'removeAllTriggers')
    .addSeparator()
    .addItem('☁️  Push news.json → GitHub',             'updateNewsJson')
    .addSeparator()
    .addItem('📋 Créer en-têtes feuille',               'createSheetHeader')
    .addToUi();
}

function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getUi().alert(
    '🗑️ Triggers supprimés',
    triggers.length + ' trigger(s) supprimé(s).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// POINT D'ENTRÉE PRINCIPAL
// ============================================================
function runDailyNews(showAlert) {
  try {
    Logger.log('=== VISAPATH NEWS — Démarrage ===');

    const topic = pickTopic();
    Logger.log('Sujet : ' + topic.title);

    const article = generateNews(topic);
    Logger.log('Actualité générée : ' + article.title);

    const row = saveToSheet(article);
    Logger.log('Enregistré ligne : ' + row);

    updateNewsJson();
    Logger.log('GitHub mis à jour → news.json');

    Logger.log('=== Terminé avec succès ===');

    if (showAlert) {
      SpreadsheetApp.getUi().alert(
        '✅ Actualité générée !',
        '"' + article.title + '"\nLigne ' + row + ' — Tag : ' + article.tag_label,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

  } catch (e) {
    Logger.log('ERREUR : ' + e.toString());
    sendErrorEmail(e);
    if (showAlert) {
      SpreadsheetApp.getUi().alert('❌ Erreur', e.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}

// ============================================================
// SUJETS — Politiques Schengen & consulaires pour Marocains
// ============================================================

// Sujets structurés : chaque entrée a un titre de contexte et un pays/scope
const TOPICS = [
  // ── FRANCE ──
  { title: 'Nouvelles exigences documents France visa Schengen Maroc',     country: 'France',    tag_type: 'alert' },
  { title: 'Délais traitement consulat France Maroc 2025',                  country: 'France',    tag_type: 'info'  },
  { title: 'Refus visa France en hausse Maroc causes',                      country: 'France',    tag_type: 'alert' },
  { title: 'VFS Global France créneaux disponibles Casablanca Rabat',       country: 'France',    tag_type: 'info'  },
  { title: 'France assurance voyage obligatoire montant minimum',           country: 'France',    tag_type: 'news'  },

  // ── ESPAGNE ──
  { title: 'Espagne consulat délais visa Schengen Maroc nouvelles mesures', country: 'Espagne',   tag_type: 'info'  },
  { title: 'BLS International Espagne Maroc rendez-vous visa',              country: 'Espagne',   tag_type: 'news'  },
  { title: 'Taux acceptation visa Espagne ressortissants marocains',        country: 'Espagne',   tag_type: 'info'  },
  { title: 'Espagne nouvelles règles réservation hôtel preuve voyage',      country: 'Espagne',   tag_type: 'alert' },

  // ── ITALIE ──
  { title: 'Italie formulaire Schengen harmonisé nouvelles instructions',   country: 'Italie',    tag_type: 'news'  },
  { title: 'Visa Italie Maroc délais consulat 2025',                        country: 'Italie',    tag_type: 'info'  },
  { title: 'Ouverture créneaux consulat Italie Casablanca',                 country: 'Italie',    tag_type: 'info'  },

  // ── PORTUGAL ──
  { title: 'VFS Global Portugal nouvelles plages horaires Maroc',           country: 'Portugal',  tag_type: 'info'  },
  { title: 'Visa Portugal taux acceptation Maroc',                          country: 'Portugal',  tag_type: 'news'  },

  // ── ALLEMAGNE ──
  { title: 'Allemagne visa Schengen ressortissants marocains conditions',   country: 'Allemagne', tag_type: 'info'  },
  { title: 'Consulat Allemagne Casablanca nouvelles procédures',            country: 'Allemagne', tag_type: 'news'  },

  // ── GÉNÉRAL SCHENGEN ──
  { title: 'Hausse frais visa Schengen 2025 impact Maroc',                  country: 'Général',   tag_type: 'alert' },
  { title: 'Digitalisation visa Schengen biométrie nouvelles règles',       country: 'Général',   tag_type: 'news'  },
  { title: 'Surge demandes visa Schengen été 2025 délais consulaires',      country: 'Général',   tag_type: 'alert' },
  { title: 'Nouveau règlement EES entrée sortie Schengen impact Maroc',     country: 'Général',   tag_type: 'alert' },
  { title: 'Statistiques refus visa Schengen Marocains 2024 bilan',        country: 'Général',   tag_type: 'news'  },
  { title: 'Schengen informations biométriques données voyageurs Maroc',    country: 'Général',   tag_type: 'info'  },
  { title: 'Assurance voyage Schengen conditions minimales marocains',      country: 'Général',   tag_type: 'info'  },
  { title: 'Lettre invitation hébergement nouvelles exigences Schengen',    country: 'Général',   tag_type: 'info'  },
  { title: 'Alerte pic dépôts visa Schengen Maroc été périodes éviter',    country: 'Général',   tag_type: 'alert' },
  { title: 'Schengen ETIAS mise en œuvre calendrier Maroc',                 country: 'Général',   tag_type: 'alert' },

  // ── PAYS-BAS / BELGIQUE ──
  { title: 'Pays-Bas visa Schengen conditions dossier Maroc',               country: 'Pays-Bas',  tag_type: 'info'  },
  { title: 'Belgique consulat rendez-vous visa Maroc 2025',                 country: 'Belgique',  tag_type: 'info'  },
];

function pickTopic() {
  const used      = getUsedTitles();
  const available = TOPICS.filter(t => !used.includes(t.title));
  const pool      = available.length > 0 ? available : TOPICS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getUsedTitles() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => String(row[COL.ID - 1] || '').trim() !== '')
    .map(row => row[COL.TITLE - 1])
    .filter(Boolean);
}

// ============================================================
// GÉNÉRATION — Appel Groq pour produire titre + résumé news
// ============================================================
function generateNews(topic) {
  const now = new Date();

  // Décider si cet article sera le "main" (principal) ou secondaire
  // Logique : le premier de la journée est main, les suivants sont secondaires
  const isMain = decideIfMain();

  const prompt =
    'Tu es un journaliste expert en immigration et visas Schengen, spécialisé pour le marché marocain.\n' +
    'Génère une actualité consulaire/Schengen réaliste et utile pour des Marocains souhaitant voyager en Europe.\n\n' +
    'Sujet principal : "' + topic.title + '"\n' +
    'Pays/scope : ' + topic.country + '\n' +
    'Type de tag : ' + topic.tag_type + ' (alert = urgent/important, info = information utile, news = nouveauté)\n' +
    'Article principal (plus long) : ' + (isMain ? 'OUI' : 'NON') + '\n\n' +
    'Contexte : VisaPath, plateforme marocaine de guide visa Schengen, public = Marocains demandeurs de visa.\n' +
    'Ton : professionnel, factuel, utile, sans alarmisme excessif.\n' +
    'Période : mai-juin 2025.\n\n' +
    'RÈGLES STRICTES :\n' +
    '- Le titre doit être accrocheur, concret, max 90 caractères\n' +
    '- Le résumé doit être en français, informatif et utile\n' +
    (isMain
      ? '- Résumé long : 2 à 3 phrases, 120 à 200 caractères, donne des détails concrets\n'
      : '- Résumé court : 1 phrase max 100 caractères, va droit au but\n') +
    '- Mentionner des éléments concrets : délais, montants, villes (Casablanca, Rabat, etc.), dates si pertinent\n' +
    '- NE PAS inventer de nouvelles politiques radicales — rester crédible et plausible\n' +
    '- Eviter le sensationnalisme\n\n' +
    'Réponds UNIQUEMENT avec ce JSON brut, sans markdown, sans texte avant ni après :\n' +
    '{\n' +
    '  "title": "titre de l\'actualité max 90 caractères",\n' +
    '  "summary": "résumé de l\'actualité",\n' +
    '  "tag_label": "' + topic.country + '"\n' +
    '}';

  const raw  = callGroq(prompt, 500);
  const data = parseJsonSafe(raw);

  return {
    id:           Utilities.getUuid(),
    title:        safe(data.title  || topic.title, 90),
    summary:      safe(data.summary || '', 300),
    tag_type:     topic.tag_type,
    tag_label:    data.tag_label || topic.country,
    published_at: now.toISOString(),
    is_main:      isMain,
    status:       'published',
    added_at:     now.toISOString(),
  };
}

// Décide si l'article doit être le "principal" (news-main) pour la journée
// Règle : on vérifie si un is_main=TRUE existe déjà aujourd'hui dans la feuille
function decideIfMain() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10); // YYYY-MM-DD

  const hasMainToday = data.slice(1).some(function(row) {
    const pub      = row[COL.PUBLISHED_AT - 1];
    const isMainCell = String(row[COL.IS_MAIN - 1]).toUpperCase();
    const pubStr   = pub instanceof Date ? pub.toISOString().substring(0, 10)
                                         : String(pub).substring(0, 10);
    return isMainCell === 'TRUE' && pubStr === todayStr;
  });

  return !hasMainToday; // main si aucun main aujourd'hui
}

// ============================================================
// GOOGLE SHEET
// ============================================================
function saveToSheet(article) {
  const sheet     = getSheet();
  const rowValues = [
    article.id,
    article.title,
    article.summary,
    article.tag_type,
    article.tag_label,
    article.published_at,
    article.is_main ? 'TRUE' : 'FALSE',
    article.status,
    article.added_at,
  ];

  sheet.appendRow(rowValues);
  const sheetRow = sheet.getLastRow();
  Logger.log('✅ Actualité ligne ' + sheetRow + ' — main: ' + article.is_main);
  return sheetRow;
}

function getSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    _createHeader(sheet);
  }
  return sheet;
}

function createSheetHeader() {
  const sheet = getSheet();
  _createHeader(sheet);
  SpreadsheetApp.getUi().alert('✅ En-têtes créés', 'La feuille "Actualites" est prête.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function _createHeader(sheet) {
  if (sheet.getLastRow() > 0) return; // ne pas écraser si déjà présent
  const headers = ['ID', 'Title', 'Summary', 'Tag Type', 'Tag Label', 'Published At', 'Is Main', 'Status', 'Added At'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0D1421')
    .setFontColor('#4F7CFF');
  sheet.setFrozenRows(1);
}

// ============================================================
// GITHUB — Push news.json
// Format consommé directement par le HTML VisaPath
// ============================================================
function updateNewsJson() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    Logger.log('Aucune actualité à exporter.');
    return;
  }

  // Lire toutes les actualités publiées, triées par date décroissante
  const items = data.slice(1)
    .filter(row => row[COL.STATUS - 1] === 'published' && row[COL.ID - 1])
    .map(row => {
      const title = row[COL.TITLE - 1];
      const tagType = row[COL.TAG_TYPE - 1];
      const tagLabel = row[COL.TAG_LABEL - 1];
      return {
        id:           row[COL.ID - 1],
        title:        title,
        slug:         slugify(title),
        summary:      row[COL.SUMMARY - 1],
        category:     mapCategory(tagType, tagLabel),
        tag_type:     tagType,
        tag_label:    tagLabel,
        published_at: row[COL.PUBLISHED_AT - 1] instanceof Date
                        ? row[COL.PUBLISHED_AT - 1].toISOString()
                        : row[COL.PUBLISHED_AT - 1],
        status:       row[COL.STATUS - 1],
      };
    })
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  // Garder seulement les 20 dernières pour le fichier JSON (légèreté)
  const recent = items.slice(0, 20);

  Logger.log(recent.length + ' actualité(s) → GitHub blogs.json');
  pushFileToGithub('blogs.json', JSON.stringify(recent, null, 2), 'chore: mise à jour blogs.json VisaPath');
}

// ============================================================
// GITHUB — Push fichier
// ============================================================
function pushFileToGithub(path, content, message) {
  const apiUrl =
    'https://api.github.com/repos/' +
    CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO +
    '/contents/' + path;

  const headers = {
    'Authorization':        'Bearer ' + CONFIG.GITHUB_TOKEN,
    'Accept':               'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Récupérer SHA si le fichier existe déjà
  let sha = null;
  try {
    const getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
    if (getResp.getResponseCode() === 200) {
      sha = JSON.parse(getResp.getContentText()).sha;
    }
  } catch (e) { /* fichier n'existe pas encore, sha reste null */ }

  const payload = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch:  'main',
  };
  if (sha) payload.sha = sha;

  const response = UrlFetchApp.fetch(apiUrl, {
    method:             'PUT',
    headers:            headers,
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() >= 400) {
    throw new Error(
      'GitHub API error ' + response.getResponseCode() +
      ' : ' + response.getContentText()
    );
  }

  Logger.log('✅ GitHub push OK : ' + path);
}

// ============================================================
// GROQ API
// ============================================================
function callGroq(prompt, maxTokens) {
  const response = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:             'POST',
    contentType:        'application/json',
    headers:            { 'Authorization': 'Bearer ' + CONFIG.GROQ_API_KEY },
    payload:            JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  maxTokens,
      temperature: 0.72,
    }),
    muteHttpExceptions: true,
  });

  const code   = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (code >= 400 || !result.choices || !result.choices[0]) {
    throw new Error('Groq erreur ' + code + ' : ' + response.getContentText());
  }

  return result.choices[0].message.content;
}

// ============================================================
// UTILITAIRES
// ============================================================
function parseJsonSafe(text) {
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()); } catch (e) {}
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (e) {}
    try { return JSON.parse(braceMatch[0].replace(/,(\s*[}\]])/g, '$1')); } catch (e) {}
  }
  Logger.log('⚠️ parseJsonSafe fallback : ' + text.substring(0, 200));
  return { title: '', summary: '', tag_label: '' };
}

function safe(str, max) {
  if (!str) return '';
  str = String(str).trim();
  return str.length <= max ? str : str.substring(0, max - 1) + '…';
}

function slugify(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function mapCategory(tagType, tagLabel) {
  var pays = ['France','Espagne','Italie','Portugal','Allemagne','Pays-Bas','Belgique'];
  if (pays.indexOf(tagLabel) !== -1) return 'Visa par pays';
  if (tagType === 'alert') return 'Actualités Schengen';
  if (tagType === 'news')  return 'Actualités Schengen';
  if (tagType === 'info')  return 'Conseils pratiques';
  return 'Actualités Schengen';
}

function sendErrorEmail(error) {
  try {
    GmailApp.sendEmail(
      Session.getActiveUser().getEmail(),
      '[VISAPATH] Erreur génération actualité',
      'Erreur :\n\n' + error.toString() + '\n\nStack:\n' + error.stack
    );
  } catch (e) {
    Logger.log('Email non envoyé : ' + e);
  }
}

// ============================================================
// TRIGGERS
// ============================================================
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Générer 2 actualités par jour : 8h et 14h
  ScriptApp.newTrigger('runDailyNews').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('runDailyNews').timeBased().everyDays(1).atHour(14).create();

  SpreadsheetApp.getUi().alert(
    '✅ Triggers installés',
    '2 actualités seront générées automatiquement :\n- 8h00\n- 14h00',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function testManual() {
  runDailyNews(true);
}
