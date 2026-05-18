// ============================================================
// SCHENGEN MAROC BLOG — Automatisation avec Groq + GitHub
// Google Apps Script — Code.gs
// ============================================================
// Propriétés du script à configurer dans Project Settings :
//   GROQ_API_KEY   → console.groq.com
//   GITHUB_TOKEN   → Personal Access Token GitHub (scope: repo)
//   GITHUB_OWNER   → ton username GitHub (ex: MonSite)
//   GITHUB_REPO    → nom du repo (ex: schengen-maroc)
// ============================================================

const CONFIG = {
  GROQ_API_KEY: PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY'),
  GITHUB_TOKEN: PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'),
  GITHUB_OWNER: PropertiesService.getScriptProperties().getProperty('GITHUB_OWNER'),
  GITHUB_REPO:  PropertiesService.getScriptProperties().getProperty('GITHUB_REPO'),
  SHEET_NAME:   'Articles',
  SITE_URL:     'https://waapply.com',
  CTA_WHATSAPP: 'https://wa.me/212XXXXXXXXX?text=Bonjour%20%F0%9F%91%8B%20Je%20voudrais%20des%20infos%20sur%20le%20visa%20Schengen.',
};

const COL = {
  ID:               1,  // A
  TITLE:            2,  // B
  SOURCE:           3,  // C
  CATEGORY:         4,  // D
  IMAGE_URL:        5,  // E
  URL:              6,  // F
  PUBLISHED_AT:     7,  // G
  DESCRIPTION:      8,  // H
  SUMMARY:          9,  // I
  SEO_TITLE:        10, // J
  META_DESCRIPTION: 11, // K
  KEYWORDS:         12, // L
  SLUG:             13, // M
  STATUS:           14, // N
  ADDED_AT:         15, // O
  CONTENT_HTML:     16, // P
  ERROR_LOG:        17, // Q
};

// ============================================================
// MENU
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('✈️ SCHENGEN BLOG')
    .addItem('▶️  Générer un article maintenant',    'testManual')
    .addSeparator()
    .addItem('🔁 Installer trigger quotidien',        'installDailyTrigger')
    .addItem('🗑️  Supprimer tous les triggers',       'removeAllTriggers')
    .addSeparator()
    .addItem('☁️  Push blogs.json → GitHub',          'updateBlogsJson')
    .addItem('📋 Créer/Réinitialiser la feuille',     'initSheet')
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
function runDailyArticle(showAlert) {
  let article = null;
  let row     = null;

  try {
    Logger.log('=== SCHENGEN BLOG — Démarrage ===');

    const topic = pickTopic();
    Logger.log('Sujet choisi : ' + topic.title);

    article = generateArticle(topic);
    Logger.log('Article généré : ' + article.title);

    row = saveToSheet(article);
    Logger.log('Enregistré à la ligne : ' + row);

    // Push GitHub avec retry interne (3 tentatives)
    try {
      updateBlogsJson();
    } catch (githubErr) {
      logSheetError(article.id, 'GitHub push failed: ' + githubErr.toString());
      sendErrorEmail(githubErr, article.title + ' (ligne ' + row + ')');
      throw new Error('Échec push GitHub après 3 tentatives : ' + githubErr.toString());
    }

    Logger.log('GitHub mis à jour avec succès');
    Logger.log('=== Terminé avec succès ===');

    sendSuccessEmail(article.title, row);

    if (showAlert) {
      SpreadsheetApp.getUi().alert(
        '✅ Article généré !',
        '"' + article.title + '"\nLigne ' + row + ' dans la feuille ' + CONFIG.SHEET_NAME + '.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

  } catch (e) {
    Logger.log('ERREUR : ' + e.toString());

    if (article && article.id) {
      logSheetError(article.id, 'Final: ' + e.toString());
    }

    sendErrorEmail(e, article ? article.title + ' (ligne ' + row + ')' : null);

    if (showAlert) {
      SpreadsheetApp.getUi().alert('❌ Erreur', e.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}

// ============================================================
// SUJETS SEO — Visa Schengen pour Marocains
// ============================================================
function pickTopic() {
  const topics = [

    // ── Actualités & Mises à jour ──────────────────────────
    { title: 'Politique Schengen 2025 : ce qui change pour les demandeurs marocains',            category: 'Actualités Schengen' },
    { title: 'Nouvelles règles consulaires Europe 2025 : impact sur les Marocains',              category: 'Actualités Schengen' },
    { title: 'Visa Schengen et liste noire Maroc : rumeurs, vérités et recours',                 category: 'Actualités Schengen' },
    { title: 'Fermeture consulaire et délais : comment adapter sa demande de visa en 2025',       category: 'Actualités Schengen' },
    { title: 'Accords de facilitation Maroc-UE : avancées et impact sur le visa Schengen',       category: 'Actualités Schengen' },
    { title: 'EES et ETIAS : ce que les Marocains doivent savoir pour 2025-2026',                category: 'Actualités Schengen' },
    { title: 'Taux de refus visa Schengen pour les Marocains : données officielles 2024-2025',   category: 'Actualités Schengen' },

    // ── Guide complet par pays ─────────────────────────────
    { title: 'Visa Schengen France depuis le Maroc : dossier complet 2025',                      category: 'Visa par pays' },
    { title: 'Visa Schengen Espagne pour Marocains : TLS Contact, rendez-vous et documents',     category: 'Visa par pays' },
    { title: 'Visa Schengen Italie pour Marocains : conditions et procédure consulaire',          category: 'Visa par pays' },
    { title: 'Visa Schengen Allemagne pour Marocains : où déposer et quoi préparer',             category: 'Visa par pays' },
    { title: 'Visa Schengen Pays-Bas depuis Casablanca ou Rabat : guide pratique',               category: 'Visa par pays' },
    { title: 'Visa Schengen Belgique pour Marocains : délais, refus fréquents et astuces',       category: 'Visa par pays' },
    { title: 'Visa Schengen Portugal pour Marocains : VFS Global et dossier type',               category: 'Visa par pays' },
    { title: 'Visa Schengen Grèce pour Marocains : tourisme et conditions simplifiées',          category: 'Visa par pays' },
    { title: 'Visa Schengen Suisse pour Marocains : spécificités hors UE',                       category: 'Visa par pays' },

    // ── Documents & Constitution du dossier ───────────────
    { title: 'Documents requis pour un visa Schengen depuis le Maroc : liste complète',          category: 'Dossier & Documents' },
    { title: 'Lettre de motivation visa Schengen : modèle et erreurs à éviter',                  category: 'Dossier & Documents' },
    { title: 'Justificatif financier pour visa Schengen : quel montant et quelle preuve ?',      category: 'Dossier & Documents' },
    { title: 'Assurance voyage visa Schengen : comment choisir la bonne couverture au Maroc',    category: 'Dossier & Documents' },
    { title: 'Réservation d\'hôtel pour visa Schengen : confirmation ou simulation ?',           category: 'Dossier & Documents' },
    { title: 'Réservation de vol pour visa Schengen : faut-il acheter le billet avant ?',        category: 'Dossier & Documents' },
    { title: 'Attestation de travail pour visa Schengen : modèle et conseils',                   category: 'Dossier & Documents' },
    { title: 'Extrait de compte bancaire pour visa Schengen : durée, format et seuils',          category: 'Dossier & Documents' },
    { title: 'Acte de naissance et état civil pour visa Schengen : traduction et légalisation',  category: 'Dossier & Documents' },

    // ── Profils spécifiques ────────────────────────────────
    { title: 'Visa Schengen pour étudiant marocain : documents et établissements reconnus',      category: 'Profils spécifiques' },
    { title: 'Visa Schengen pour salarié marocain : prouver son attachement au Maroc',           category: 'Profils spécifiques' },
    { title: 'Visa Schengen pour fonctionnaire marocain : avantages et justificatifs',           category: 'Profils spécifiques' },
    { title: 'Visa Schengen pour retraité marocain : revenus, pension et documents',             category: 'Profils spécifiques' },
    { title: 'Visa Schengen pour auto-entrepreneur marocain : comment justifier ses revenus',    category: 'Profils spécifiques' },
    { title: 'Visa Schengen pour commercant marocain : registre de commerce et preuves',         category: 'Profils spécifiques' },
    { title: 'Visa Schengen pour famille résidant en Europe : invitation et hébergement',        category: 'Profils spécifiques' },
    { title: 'Visa Schengen pour mineur marocain : autorisation parentale et démarches',         category: 'Profils spécifiques' },
    { title: 'Primo-demandeur visa Schengen au Maroc : erreurs à éviter absolument',             category: 'Profils spécifiques' },

    // ── Refus & Recours ────────────────────────────────────
    { title: 'Refus visa Schengen au Maroc : causes fréquentes et comment réagir',               category: 'Refus & Recours' },
    { title: 'Comment contester un refus de visa Schengen depuis le Maroc',                      category: 'Refus & Recours' },
    { title: 'Lettre de recours visa Schengen refusé : modèle et arguments efficaces',           category: 'Refus & Recours' },
    { title: 'Quand redéposer après un refus de visa Schengen ?',                                category: 'Refus & Recours' },
    { title: 'Fichier SIS et interdiction Schengen : comment savoir et agir ?',                  category: 'Refus & Recours' },

    // ── Procédure & Rendez-vous ────────────────────────────
    { title: 'Prendre rendez-vous visa Schengen au Maroc : TLS Contact, VFS, BLS',              category: 'Procédure & RDV' },
    { title: 'Délais de traitement visa Schengen : combien de temps attendre depuis le Maroc ?', category: 'Procédure & RDV' },
    { title: 'Frais de visa Schengen en 2025 : tarifs consulaires et frais de service',          category: 'Procédure & RDV' },
    { title: 'Suivi de demande visa Schengen en ligne : comment savoir où en est son dossier',   category: 'Procédure & RDV' },
    { title: 'Visa Schengen multiple entrées : qui peut en bénéficier au Maroc ?',               category: 'Procédure & RDV' },
    { title: 'Visa Schengen longue durée vs court séjour : différences et critères',             category: 'Procédure & RDV' },

    // ── Conseils pratiques ─────────────────────────────────
    { title: '10 erreurs qui font refuser le visa Schengen aux Marocains',                       category: 'Conseils pratiques' },
    { title: 'Comment augmenter ses chances d\'obtenir le visa Schengen au Maroc',              category: 'Conseils pratiques' },
    { title: 'Voyage Schengen avec visa : droits, durée et pays autorisés',                      category: 'Conseils pratiques' },
    { title: 'Visa Schengen : peut-on changer de pays de destination après obtention ?',         category: 'Conseils pratiques' },
    { title: 'Passeport marocain et visa Schengen : validité requise et pages libres',           category: 'Conseils pratiques' },
  ];

  const used      = getUsedTitles();
  const available = topics.filter(t => !used.includes(t.title));
  const pool      = available.length > 0 ? available : topics;
  const recent    = getLastPublishedTitles(10);

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    const candidateText = candidate.title + ' ' + candidate.category;

    let tooSimilar = false;
    for (let r = 0; r < recent.length; r++) {
      const sim = jaccardSimilarity(candidateText, recent[r].title + ' ' + recent[r].category);
      if (sim > 0.7) {
        tooSimilar = true;
        Logger.log('⚠️ Similarité ' + sim.toFixed(2) + ' avec "' + recent[r].title.substring(0, 40) + '" — re-tirage');
        break;
      }
    }

    if (!tooSimilar) return candidate;
  }

  Logger.log('⚠️ Aucun sujet original trouvé après 5 tentatives — dernier candidat forcé');
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
// GÉNÉRATION — 2 appels séparés (métadonnées + HTML)
// ============================================================
function generateArticle(topic) {
  const slug = generateSlug(topic.title);
  const now  = new Date().toISOString();
  const primaryKeyword = topic.category + ' - ' + topic.title;

  // ── Appel 1 : Métadonnées SEO (JSON) ──
  const metaPrompt =
    'Tu es un expert SEO spécialisé dans le visa Schengen pour les Marocains, tu connais par cœur les vraies questions que les gens tapent sur Google au Maroc.\n' +
    'Génère les métadonnées SEO pour un article de blog sur :\n' +
    'Sujet : "' + topic.title + '"\n' +
    'Catégorie : "' + topic.category + '"\n\n' +
    'Contexte du site : site informatif pour les Marocains qui veulent un visa Schengen — ils en ont marre des infos vagues, ils veulent du concret.\n' +
    'Cible : Marocains de 22-45 ans, plutôt actifs (salariés, commerçants, étudiants, mères de famille) qui cherchent sur Google des réponses à leurs doutes.\n\n' +
    'Règles :\n' +
    '- Titre SEO : max 60 car., punchy, avec un mot qui accroche l\'émotion (ex: "éviter", "refus", "gratuit", "rapide", "obligatoire").\n' +
    '- Meta description : max 155 car., parle comme si tu répondais à un ami — pas de jargon. Finis par un appel discret à lire.\n' +
    '- Mots-clés : 8-12, inclus des variantes "darija-friendly" comme "visa Schengen Maroc 2025", "document visa France Maroc", "rendez-vous TLS Casablanca".\n' +
    '- Description : 1 phrase max 155 car., qui donne LA réponse à la question principale.\n' +
    '- Summary : 2 phrases max 270 car., avec contexte marocain et bénéfice clair.\n\n' +
    'Réponds UNIQUEMENT avec ce JSON brut, sans markdown, sans texte avant ou après :\n' +
    '{\n' +
    '  "description": "…",\n' +
    '  "summary": "…",\n' +
    '  "seo_title": "…",\n' +
    '  "meta_description": "…",\n' +
    '  "keywords": "…"\n' +
    '}';

  const metaText = callGroq(metaPrompt, 700);
  const meta     = parseJsonSafe(metaText);

  // ── Appel 2 : Contenu HTML complet — ton marocain, exemples concrets, FAQ réaliste ──
  const htmlPrompt =
    'Tu es un rédacteur marocain qui aide les gens à obtenir leur visa Schengen. Tu écris comme tu parlerais à un pote dans un café à Casablanca — chaleureux, direct, sans blabla.\n\n' +
    'Rédige un article HTML complet sur :\n' +
    'Sujet : "' + topic.title + '"\n' +
    'Catégorie : "' + topic.category + '"\n\n' +
    '=== PUBLIC CIBLE ===\n' +
    'Marocains de 22-45 ans, plutôt actifs, qui veulent voyager en Europe mais qui ont peur du refus. Beaucoup sont primo-demandeurs, certains ont déjà eu un refus. Ils veulent des réponses VRAIES, pas des généralités.\n\n' +
    '=== STRUCTURE OBLIGATOIRE ===\n' +
    '1. <p>Introduction : accroche directe — "Vous êtes marocain et vous voulez un visa Schengen ? Voici exactement ce qu\'il faut faire." Plante le décor : le stress, les files à VFS/TLS, la peur du refus. Promets une réponse claire.\n' +
    '2. <h2>En résumé</h2> — la réponse courte à la question principale, 3-4 lignes max.\n' +
    '3. Au moins 4 sections <h2> avec des sous-sections <h3>. Chaque section répond à une vraie question que les Marocains se posent. Utilise des sous-titres qui ressemblent à des recherches Google (ex: "Quels documents pour un CDI ?", "Combien coûte le visa en 2025 ?", "Où déposer à Casablanca ou Rabat ?").\n' +
    '4. <h2>FAQ</h2> — 5 vraies questions que les Marocains tapent sur Google, avec des réponses courtes et honnêtes. Inspire-toi de questions comme :\n' +
    '   - "Puis-je voyager dans un autre pays Schengen que celui de mon visa ?"\n' +
    '   - "Combien de temps avant mon voyage dois-je déposer ?"\n' +
    '   - "Est-ce que je peux travailler avec un visa touristique ?"\n' +
    '   - "Mon passeport est-il valable pour le visa ? (6 mois ou 3 mois ?)"\n' +
    '   - " Que faire si on me refuse le visa ?"\n' +
    '5. <h2>Conclusion</h2> — résumé sympa + prochaine action concrète.\n\n' +
    '=== EXIGENCES DE CONTENU ===\n' +
    '- Longueur : 1200 à 1700 mots.\n' +
    '- TON : conversationnel marocain francophone — utilise "vous" poli mais chaleureux. Phrases courtes. Pas de langue de bois. Évite le jargon administratif.\n' +
    '- EXEMPLES CONCRETS OBLIGATOIRES :\n' +
    '  * Centres : "TLS Contact à Casablanca (Boulevard Ghandi) ouvre les créneaux à 8h le lundi" — "VFS Global à Rabat, comptez 30 min de visite"\n' +
    '  * Délais réels : "En mars 2025, les rendez-vous France à VFS Casablanca sont à 4-6 semaines. Pour l\'Italie, c\'est 2-3 semaines."\n' +
    '  * Montants précis : "Le visa coûte 90€ (environ 980 MAD). L\'assurance voyage : 50-150 MAD selon la durée."\n' +
    '  * Situations : "Si vous êtes commerçant à Tanger, vous devez fournir votre registre de commerce + les 2 dernières déclarations fiscales."\n' +
    '- MISES EN GARDE UTILES : "Attention aux pages Facebook qui promettent un visa en 48h — c\'est une arnaque." "Ne réservez pas un vol non remboursable avant d\'avoir le visa."\n' +
    '- SEO : utilise naturellement : visa Schengen Maroc, documents visa, TLS Contact, VFS Global, passeport marocain, rendez-vous visa, refus visa, consulat France Maroc, BLS International.\n\n' +
    'Liens internes obligatoires (à intégrer naturellement dans le texte) :\n' +
    '- <a href="/guide-complet/">guide complet visa Schengen Maroc</a>\n' +
    '- <a href="/documents-requis/">liste des documents requis</a>\n' +
    '- <a href="/refus-recours/">que faire en cas de refus</a>\n' +
    '- <a href="/actualites/">actualités consulaires Schengen</a>\n' +
    '- <a href="/par-pays/">visa Schengen par pays</a>\n\n' +
    'Balises autorisées : h2, h3, p, ul, ol, li, strong, em, a.\n' +
    'INTERDIT : h1, html, head, body, script, style, table, markdown (```), commentaires.\n' +
    'Commence directement par <p>.';

  const contentHtml = callGroq(htmlPrompt, 8000);

  return {
    id:               Utilities.getUuid(),
    title:            topic.title,
    source:           'Schengen Maroc Blog',
    category:         topic.category,
    image_url:        '',
    url:              CONFIG.SITE_URL + '/blog/' + slug + '/',
    published_at:     now,
    description:      safe(meta.description, 160),
    summary:          safe(meta.summary, 300),
    seo_title:        safe(meta.seo_title || topic.title, 60),
    meta_description: safe(meta.meta_description || meta.description, 155),
    keywords:         meta.keywords || '',
    slug:             slug,
    status:           'published',
    added_at:         now,
    content_html:     contentHtml.trim(),
  };
}

// ============================================================
// APPEL API GROQ
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
      temperature: 0.7,
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
// PARSER JSON ROBUSTE
// ============================================================
function parseJsonSafe(text) {
  // Tentative 1 : bloc ```json...```
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()); } catch (e) {}
  }

  // Tentative 2 : premier {...} trouvé
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (e) {}
    // Tentative 3 : nettoyer virgules trailing
    try { return JSON.parse(braceMatch[0].replace(/,(\s*[}\]])/g, '$1')); } catch (e) {}
  }

  // Tentative 4 : extraction champ par champ (fallback ultime)
  Logger.log('⚠️ parseJsonSafe fallback : ' + text.substring(0, 200));
  return extractFieldsFallback(text);
}

function extractFieldsFallback(text) {
  const fields = ['description', 'summary', 'seo_title', 'meta_description', 'keywords'];
  const result = {};
  fields.forEach(function(field) {
    const re = new RegExp('"' + field + '"\\s*:\\s*"([^"]*)"');
    const m  = text.match(re);
    result[field] = m ? m[1] : '';
  });
  return result;
}

// ── Tronquer proprement ─────────────────────────────────────
function safe(str, max) {
  if (!str) return '';
  str = String(str).trim();
  return str.length <= max ? str : str.substring(0, max - 1) + '…';
}

// ============================================================
// GOOGLE SHEET — Enregistrement avec gestion images pré-remplies
// ============================================================
function saveToSheet(article) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();

  // Chercher une ligne avec image (col E) mais sans ID (col A)
  // = ligne pré-remplie manuellement avec une URL d'image
  let imageUrl  = '';
  let targetRow = -1;

  for (let i = 1; i < data.length; i++) {
    const cellId    = String(data[i][COL.ID - 1]        || '').trim();
    const cellImage = String(data[i][COL.IMAGE_URL - 1] || '').trim();

    if (cellImage !== '' && cellId === '') {
      imageUrl  = cellImage;
      targetRow = i + 1;
      break;
    }
  }

  const rowValues = [
    article.id,
    article.title,
    article.source,
    article.category,
    imageUrl !== '' ? imageUrl : (article.image_url || ''),
    article.url,
    article.published_at,
    article.description,
    article.summary,
    article.seo_title,
    article.meta_description,
    article.keywords,
    article.slug,
    article.status,
    article.added_at,
  ];

  let sheetRow;

  if (targetRow > 0) {
    sheetRow = targetRow;
    sheet.getRange(sheetRow, 1, 1, rowValues.length).setValues([rowValues]);
    sheet.getRange(sheetRow, COL.CONTENT_HTML).setValue(article.content_html || '');
    sheet.getRange(sheetRow, COL.ERROR_LOG).setValue('');
    Logger.log('✅ Article ligne ' + sheetRow + ' — image : ' + imageUrl);
  } else {
    sheet.appendRow(rowValues);
    sheetRow = sheet.getLastRow();
    sheet.getRange(sheetRow, COL.CONTENT_HTML).setValue(article.content_html || '');
    sheet.getRange(sheetRow, COL.ERROR_LOG).setValue('');
    Logger.log('✅ Article ligne ' + sheetRow + ' — sans image');
  }

  return sheetRow;
}

function getSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    createSheetHeader(sheet);
  }
  return sheet;
}

function createSheetHeader(sheet) {
  const headers = [
    'ID', 'Title', 'Source', 'Category', 'Image URL', 'URL',
    'Published At', 'Description', 'Summary', 'SEO Title',
    'Meta Description', 'Keywords', 'Slug', 'Status', 'Added At', 'Content HTML', 'Error Log',
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#003399')   // Bleu drapeau EU / Schengen
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(COL.CONTENT_HTML, 80);
  sheet.setColumnWidth(COL.TITLE, 300);
  sheet.setColumnWidth(COL.DESCRIPTION, 250);
}

function initSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const existing = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (existing) {
    existing.clear();
    createSheetHeader(existing);
  } else {
    const sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    createSheetHeader(sheet);
  }
  SpreadsheetApp.getUi().alert(
    '✅ Feuille initialisée',
    'La feuille "' + CONFIG.SHEET_NAME + '" a été réinitialisée avec les en-têtes.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// GITHUB — Push blogs.json
// ============================================================
function updateBlogsJson() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    Logger.log('Aucun article à exporter.');
    return;
  }

  const articles = data.slice(1)
    .filter(row => row[COL.STATUS - 1] === 'published' && row[COL.ID - 1])
    .map(row => ({
      id:               row[COL.ID - 1],
      title:            row[COL.TITLE - 1],
      source:           row[COL.SOURCE - 1],
      category:         row[COL.CATEGORY - 1],
      image_url:        row[COL.IMAGE_URL - 1] || '',
      url:              row[COL.URL - 1],
      published_at:     row[COL.PUBLISHED_AT - 1] instanceof Date
                          ? row[COL.PUBLISHED_AT - 1].toISOString()
                          : row[COL.PUBLISHED_AT - 1],
      description:      row[COL.DESCRIPTION - 1],
      summary:          row[COL.SUMMARY - 1],
      seo_title:        row[COL.SEO_TITLE - 1],
      meta_description: row[COL.META_DESCRIPTION - 1],
      keywords:         row[COL.KEYWORDS - 1],
      slug:             row[COL.SLUG - 1],
      status:           row[COL.STATUS - 1],
      added_at:         row[COL.ADDED_AT - 1] instanceof Date
                          ? row[COL.ADDED_AT - 1].toISOString()
                          : row[COL.ADDED_AT - 1],
      content_html:     row[COL.CONTENT_HTML - 1] || '',
    }));

  Logger.log(articles.length + ' article(s) → GitHub');
  const json = JSON.stringify(articles, null, 2);
  const ts   = new Date().toISOString();

  const LATEST_COUNT = 10;
  const latest = articles.slice(0, LATEST_COUNT);
  const archive = articles.slice(LATEST_COUNT);

  pushFileToGithub('blogs.json',         json,                              'chore: mise à jour blogs.json — ' + ts);
  pushFileToGithub('blogs-latest.json',  JSON.stringify(latest, null, 2),   'chore: mise à jour blogs-latest.json — ' + ts);
  if (archive.length > 0) {
    pushFileToGithub('blogs-archive.json', JSON.stringify(archive, null, 2), 'chore: mise à jour blogs-archive.json — ' + ts);
  }
}

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

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let sha = null;
      try {
        const getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
        if (getResp.getResponseCode() === 200) {
          sha = JSON.parse(getResp.getContentText()).sha;
        }
      } catch (e) {
        Logger.log('SHA non trouvé (nouveau fichier) : ' + e);
      }

      const payload = {
        message: message,
        content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
        branch:  'master',
      };
      if (sha) payload.sha = sha;

      const response = UrlFetchApp.fetch(apiUrl, {
        method:             'PUT',
        headers:            headers,
        payload:            JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      const code = response.getResponseCode();
      if (code >= 400) {
        throw new Error('GitHub API error ' + code + ' : ' + response.getContentText());
      }

      Logger.log('✅ GitHub push OK : ' + path + ' (' + code + ')');
      return;

    } catch (e) {
      Logger.log('⚠️ Tentative ' + attempt + '/3 GitHub push échouée : ' + e.toString());
      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000;
        Logger.log('   Nouvelle tentative dans ' + delay + 'ms...');
        Utilities.sleep(delay);
      } else {
        throw e;
      }
    }
  }
}

// ============================================================
// UTILITAIRES
// ============================================================
function generateSlug(title) {
  return title
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

// ============================================================
// SIMILARITÉ — Jaccard sur tokens (évite les doublons sémantiques)
// ============================================================

var STOP_WORDS = {
  avec:1,pour:1,dans:1,sans:1,une:1,des:1,les:1,sur:1,que:1,qui:1,
  est:1,aux:1,par:1,son:1,ses:1,leur:1,pas:1,plus:1,visa:1,maroc:1,
  schengen:1,comment:1,faire:1,tout:1,tous:1,entre:1,chez:1,depuis:1,
  pendant:1,avant:1,apres:1,tres:1,bien:1,mais:1,ou:1,pour:1,car:1,
  elle:1,nous:1,vous:1,ils:1,elles:1,ca:1,ce:1,cet:1,cette:1,ces:1,
  sont:1,etait:1,ont:1,ete:1,avoir:1,etre:1,peut:1,peuvent:1,doit:1,
  doivent:1,leur:1,leurs:1,quoi:1,dont:1,aussi:1,tres:1,encore:1,
  meme:1,donc:1,enfin:1,voici:1,voila:1,ni:1,hors:1,selon:1,sous:1,
  vers:1,des:1,plus:1,non:1,oui:1,deja:1,jamais:1,rien:1,seul:1,
};

function tokenize(text) {
  var raw = String(text || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(function(w) { return w.length > 3 && !STOP_WORDS[w]; });
  var seen = {};
  return raw.filter(function(w) { return seen[w] ? false : (seen[w] = true); });
}

function jaccardSimilarity(a, b) {
  var tokensA = tokenize(a);
  var tokensB = tokenize(b);
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  var intersection = 0;
  for (var i = 0; i < tokensA.length; i++) {
    for (var j = 0; j < tokensB.length; j++) {
      if (tokensA[i] === tokensB[j]) { intersection++; break; }
    }
  }

  var union = tokensA.length + tokensB.length - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getLastPublishedTitles(n) {
  var sheet = getSheet();
  var data  = sheet.getDataRange().getValues();
  var result = [];
  for (var i = data.length - 1; i > 0 && result.length < n; i--) {
    if (String(data[i][COL.ID - 1] || '').trim() !== '') {
      result.push({
        title: data[i][COL.TITLE - 1] || '',
        category: data[i][COL.CATEGORY - 1] || '',
      });
    }
  }
  return result;
}

// ============================================================
// ERRORS — Log feuille + email d'alerte
// ============================================================

function logSheetError(articleId, errorMessage) {
  try {
    const sheet = getSheet();
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][COL.ID - 1] || '').trim() === String(articleId || '').trim()) {
        const row = i + 1;
        const ts  = new Date().toISOString();
        const log = '[' + ts + '] ' + errorMessage;
        const prev = String(data[i][COL.ERROR_LOG - 1] || '').trim();
        const full = prev ? prev + '\n' + log : log;
        sheet.getRange(row, COL.ERROR_LOG).setValue(full.substring(0, 5000));
        Logger.log('📝 Erreur loguée ligne ' + row + ' : ' + log);
        return;
      }
    }
    Logger.log('⚠️ Ligne introuvable pour l\'ID : ' + articleId);
  } catch (e2) {
    Logger.log('⚠️ Impossible d\'écrire error_log : ' + e2);
  }
}

function sendErrorEmail(error, articleInfo) {
  try {
    const subject = articleInfo
      ? '[SCHENGEN BLOG] Échec publication : ' + articleInfo
      : '[SCHENGEN BLOG] Erreur génération article';

    const body =
      'Une erreur est survenue lors de la génération/publication automatique d\'article.\n\n' +
      (articleInfo ? 'Article : ' + articleInfo + '\n\n' : '') +
      'Erreur :\n' + error.toString() + '\n\n' +
      'Stack trace :\n' + (error.stack || 'Non disponible') + '\n\n' +
      'Date : ' + new Date().toISOString() + '\n' +
      'Feuille : ' + CONFIG.SHEET_NAME;

    GmailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body);
    Logger.log('📧 Email d\'alerte envoyé');
  } catch (e) {
    Logger.log('Email d\'alerte non envoyé : ' + e);
  }
}

function sendSuccessEmail(articleTitle, row) {
  try {
    GmailApp.sendEmail(
      Session.getActiveUser().getEmail(),
      '[SCHENGEN BLOG] ✅ Article publié',
      'Article publié avec succès sur GitHub Pages.\n\n' +
      'Titre : ' + articleTitle + '\n' +
      'Ligne : ' + row + '\n' +
      'URL : ' + CONFIG.SITE_URL + '/blog/\n' +
      'Date : ' + new Date().toISOString()
    );
    Logger.log('📧 Email de confirmation envoyé');
  } catch (e) {
    Logger.log('Email de confirmation non envoyé : ' + e);
  }
}

// ============================================================
// TRIGGERS
// ============================================================
function installDailyTrigger() {
  // Supprimer tous les triggers existants d'abord
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Créer un trigger quotidien à 9h00
  ScriptApp.newTrigger('runDailyArticle')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Trigger installé',
    'Un article sera généré automatiquement chaque jour à 9h00.\n\nVérifiez dans Éditions > Déclencheurs.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function testManual() {
  runDailyArticle(true);
}