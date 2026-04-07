/**
 * WaApply — Fetch AI-related news (RSS, Hacker News, NewsAPI) into the sheet as raw rows.
 *
 * Depends on BlogSyncToGitHub.gs: getArticleSheet_(), ensureHeaderRow_(), getColumnIndices_().
 * Rapport.gs : journal des saisies sur la feuille « Rapport » (recommandé).
 *
 * Script property (optional): NEWS_API_KEY — NewsAPI.org; omitted → NewsAPI skipped silently.
 *
 * Menu: onOpen() in BlogSyncToGitHub.gs calls addIAMenuItems(), or call it manually after your menu.
 *
 * Déclencheur quotidien (installIATrendsTrigger) : 1 exécution/jour à l’heure configurée (défaut 8h,
 * fuseau du projet). Chaque run ajoute jusqu’à N lignes (défaut 5) : articles IA récents non déjà présents (slug).
 *
 * Propriétés optionnelles : IA_FETCH_DAILY_MAX (1–20, défaut 5), IA_TRIGGER_HOUR (0–23, défaut 8).
 */

var IA_RSS_FEEDS = [
  'https://techcrunch.com/tag/artificial-intelligence/feed',
  'https://venturebeat.com/category/ai/feed',
  'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
];

var IA_KEYWORDS = [
  'ai',
  'llm',
  'chatgpt',
  'openai',
  'gemini',
  'claude',
  'gpt',
  'neural',
  'deep learning',
  'generative',
  'transformer',
  'copilot',
  'mistral',
  'anthropic',
  'artificial intelligence',
];

var IA_DEFAULT_FETCH_DAILY_MAX = 5;
var IA_DEFAULT_TRIGGER_HOUR = 8;
var IA_ID_MAX_LEN = 60;
var IA_EXCERPT_MAX = 200;
var IA_BODY_MAX = 800;
var IA_TRIGGER_HANDLER = 'fetchIATrendsToSheet';
var IA_HN_MAX_ITEMS = 50;
var IA_TAG_VALUE = 'AI News';

/** Max new rows per run (menu test + déclencheur). Script property IA_FETCH_DAILY_MAX (1–20), défaut 5. */
function getIaMaxNewPerRun_() {
  var raw = PropertiesService.getScriptProperties().getProperty('IA_FETCH_DAILY_MAX');
  if (raw) {
    var n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 20) {
      return n;
    }
  }
  return IA_DEFAULT_FETCH_DAILY_MAX;
}

/** Heure du déclencheur quotidien (0–23, fuseau du projet). Script property IA_TRIGGER_HOUR, défaut 8. */
function getIaTriggerHour_() {
  var raw = PropertiesService.getScriptProperties().getProperty('IA_TRIGGER_HOUR');
  if (raw) {
    var h = parseInt(raw, 10);
    if (!isNaN(h) && h >= 0 && h <= 23) {
      return h;
    }
  }
  return IA_DEFAULT_TRIGGER_HOUR;
}

function addIAMenuItems() {
  Logger.log('addIAMenuItems: building WaApply → AI trends menu');
  var maxN = getIaMaxNewPerRun_();
  var hour = getIaTriggerHour_();
  SpreadsheetApp.getUi()
    .createMenu('WaApply → AI trends')
    .addItem('Fetch AI articles — test (max ' + maxN + ')', 'fetchIATrendsToSheet')
    .addSeparator()
    .addItem(
      'Installer déclencheur quotidien — ' + hour + 'h, ' + maxN + ' articles/jour',
      'installIATrendsTrigger'
    )
    .addItem('Supprimer le déclencheur fetch', 'removeIATrendsTrigger')
    .addSeparator()
    .addItem('Ouvrir la feuille Rapport (journal)', 'openRapportSheet')
    .addToUi();
}

/**
 * Déclencheur automatique : 1 fois par jour à l’heure configurée, ajoute jusqu’à N articles IA récents (défaut 5).
 * À activer une fois via le menu ; nécessite autorisation « déclencheurs ».
 */
function installIATrendsTrigger() {
  var hour = getIaTriggerHour_();
  var maxN = getIaMaxNewPerRun_();
  Logger.log('installIATrendsTrigger: removing existing triggers (quiet)');
  var removed = removeIATrendsTriggersCore_();
  Logger.log('installIATrendsTrigger: removed ' + removed + ' prior trigger(s)');

  ScriptApp.newTrigger(IA_TRIGGER_HANDLER)
    .timeBased()
    .atHour(hour)
    .everyDays(1)
    .create();
  Logger.log(
    'installIATrendsTrigger: created daily trigger at hour ' + hour + ' → ' + IA_TRIGGER_HANDLER + ' (max ' + maxN + ' rows)'
  );

  SpreadsheetApp.getUi().alert(
    'Déclencheur installé',
    'Exécution chaque jour à ' +
      hour +
      ':00 (fuseau du projet Apps Script). Jusqu’à ' +
      maxN +
      ' nouveaux articles IA par jour (sources RSS + Hacker News + NewsAPI si clé). Voir Exécutions pour le journal.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function removeIATrendsTrigger() {
  var removed = removeIATrendsTriggersCore_();
  Logger.log('removeIATrendsTrigger: removed ' + removed + ' trigger(s)');
  SpreadsheetApp.getUi().alert(
    'Déclencheur IA',
    removed > 0
      ? removed + ' déclencheur(s) supprimé(s) pour ' + IA_TRIGGER_HANDLER + '.'
      : 'Aucun déclencheur ' + IA_TRIGGER_HANDLER + ' à supprimer.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Deletes all time-based triggers for IA fetch. No UI.
 * @returns {number} count removed
 */
function removeIATrendsTriggersCore_() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === IA_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return removed;
}

function fetchIATrendsToSheet() {
  Logger.log('fetchIATrendsToSheet: entry');
  try {
    fetchIATrendsToSheet_();
  } catch (e) {
    Logger.log('fetchIATrendsToSheet ERROR: ' + e + ' stack: ' + (e.stack || ''));
    if (typeof appendRapportLog_ === 'function') {
      try {
        appendRapportLog_(
          'ERREUR_IA_TRENDS',
          'Échec fetch IA Trends',
          '',
          String(e.message || e)
        );
      } catch (rapportErr) {
        Logger.log('appendRapportLog_ (IA error): ' + rapportErr);
      }
    }
    try {
      SpreadsheetApp.getUi().alert(
        'IA Trends fetch failed',
        String(e.message || e),
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (uiErr) {
      Logger.log('fetchIATrendsToSheet: no UI (scheduled run?): ' + uiErr);
    }
    throw e;
  }
}

function fetchIATrendsToSheet_() {
  Logger.log(
    'fetchIATrendsToSheet_: start (max ' + getIaMaxNewPerRun_() + ' new rows/run, daily trigger hour=' + getIaTriggerHour_() + ')'
  );

  var sheet = getArticleSheet_();
  Logger.log('fetchIATrendsToSheet_: sheet name = ' + sheet.getName());

  ensureHeaderRow_(sheet);
  Logger.log('fetchIATrendsToSheet_: header row ensured');

  var values = sheet.getDataRange().getValues();
  if (values.length < 1) {
    throw new Error('Sheet has no header row.');
  }

  var ci = getColumnIndices_(values);
  Logger.log('fetchIATrendsToSheet_: column indices resolved');

  var existingIds = loadExistingIds_(values, ci);
  Logger.log('fetchIATrendsToSheet_: existing non-empty ids in sheet = ' + Object.keys(existingIds).length);

  var candidates = [];
  Logger.log('fetchIATrendsToSheet_: fetching RSS feeds (' + IA_RSS_FEEDS.length + ')');
  candidates = candidates.concat(fetchAllRss_());
  Logger.log('fetchIATrendsToSheet_: after RSS, items = ' + candidates.length);

  Logger.log('fetchIATrendsToSheet_: fetching Hacker News top stories');
  candidates = candidates.concat(fetchHackerNewsTop_());
  Logger.log('fetchIATrendsToSheet_: after HN, items = ' + candidates.length);

  Logger.log('fetchIATrendsToSheet_: fetching NewsAPI (if key present)');
  candidates = candidates.concat(fetchNewsApi_());
  Logger.log('fetchIATrendsToSheet_: after NewsAPI, items = ' + candidates.length);

  var filtered = [];
  var seenSlug = {};
  for (var i = 0; i < candidates.length; i++) {
    var it = candidates[i];
    if (!it.title || String(it.title).trim() === '') {
      continue;
    }
    var desc = String(it.summary || '').trim();
    if (!matchesAiKeywords_(String(it.title), desc)) {
      continue;
    }
    var slug = slugifyForId_(it.title, IA_ID_MAX_LEN);
    if (!slug) {
      continue;
    }
    if (seenSlug[slug]) {
      Logger.log('fetchIATrendsToSheet_: skip duplicate slug in batch: ' + slug);
      continue;
    }
    if (existingIds[slug]) {
      Logger.log('fetchIATrendsToSheet_: skip slug already in sheet: ' + slug);
      continue;
    }
    seenSlug[slug] = true;
    it.slug = slug;
    it.cleanSummary = normalizeSummary_(desc);
    filtered.push(it);
  }
  Logger.log('fetchIATrendsToSheet_: after filter + dedupe, count = ' + filtered.length);

  var maxNew = getIaMaxNewPerRun_();
  var toWrite = filtered.slice(0, maxNew);
  if (toWrite.length === 0) {
    Logger.log('fetchIATrendsToSheet_: nothing new to append');
    try {
      SpreadsheetApp.getActive().toast(
        'No new AI-related items (or all slugs already in sheet).',
        'IA Trends',
        5
      );
    } catch (t) {
      Logger.log('fetchIATrendsToSheet_: toast skipped: ' + t);
    }
    return;
  }

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  Logger.log('fetchIATrendsToSheet_: today = ' + today + ', appending ' + toWrite.length + ' row(s)');

  var numCols = sheet.getLastColumn();
  for (var w = 0; w < toWrite.length; w++) {
    var item = toWrite[w];
    var excerpt = excerptFromPlainDescription_(item.cleanSummary);
    var bodyHtml = buildRichArticleBodyHtml_(item, today);

    Logger.log(
      'fetchIATrendsToSheet_: row ' + (w + 1) + '/' + toWrite.length + ' id=' + item.slug + ' title=' + item.title
    );

    appendArticleRow_(sheet, ci, numCols, {
      id: item.slug,
      title: String(item.title).trim(),
      date: today,
      tag: IA_TAG_VALUE,
      excerpt: excerpt,
      body: bodyHtml,
      published: '',
    });
    existingIds[item.slug] = true;
  }

  Logger.log('fetchIATrendsToSheet_: done');
  if (typeof appendRapportLog_ === 'function') {
    try {
      var slugs = toWrite.map(function (it) {
        return it.slug;
      });
      appendRapportLog_(
        'SAISIE_IA_TRENDS',
        'Saisie IA Trends : ' + toWrite.length + ' nouvelle(s) ligne(s) dans Articles',
        slugs,
        ''
      );
    } catch (rapportErr) {
      Logger.log('appendRapportLog_ (IA success): ' + rapportErr);
    }
  }
  try {
    SpreadsheetApp.getActive().toast('IA Trends: added ' + toWrite.length + ' row(s).', 'IA Trends', 8);
  } catch (t2) {
    Logger.log('fetchIATrendsToSheet_: toast skipped: ' + t2);
  }
}

function loadExistingIds_(values, ci) {
  var map = {};
  for (var r = 1; r < values.length; r++) {
    var id = String(values[r][ci.id] || '')
      .trim()
      .toLowerCase();
    if (id) {
      map[id] = true;
    }
  }
  return map;
}

function matchesAiKeywords_(title, description) {
  var hay = (String(title) + ' ' + String(description)).toLowerCase();
  for (var k = 0; k < IA_KEYWORDS.length; k++) {
    if (hay.indexOf(IA_KEYWORDS[k].toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

function normalizeSummary_(text) {
  var t = stripHtml_(String(text || '')).replace(/\s+/g, ' ').trim();
  return t;
}

/** First 200 chars of plain description, word boundary, no HTML. */
function excerptFromPlainDescription_(plain) {
  var s = normalizeSummary_(plain);
  return truncatePlain_(s, IA_EXCERPT_MAX);
}

function sourceDisplayName_(item) {
  var s = String(item.source || '').toLowerCase();
  if (s.indexOf('techcrunch') !== -1) {
    return 'TechCrunch';
  }
  if (s.indexOf('venturebeat') !== -1) {
    return 'VentureBeat';
  }
  if (s.indexOf('theverge') !== -1) {
    return 'The Verge';
  }
  if (s === 'hackernews') {
    return 'HackerNews';
  }
  if (s === 'newsapi') {
    return 'NewsAPI';
  }
  return 'Web';
}

function itemPublishedDisplay_(item, fallbackYmd) {
  if (item.publishedAt) {
    var pa = String(item.publishedAt);
    var m = pa.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) {
      return m[1];
    }
  }
  if (item.pubDate) {
    var d = new Date(item.pubDate);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  }
  if (item.hnTime != null && item.hnTime !== '') {
    return Utilities.formatDate(new Date(Number(item.hnTime) * 1000), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return fallbackYmd;
}

function escapeHtmlAttr_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextLen_(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function buildRichArticleBodyHtml_(item, sheetDateYmd) {
  var plain = String(item.cleanSummary || '').trim();
  var title = String(item.title || '').trim();
  var url = String(item.url || '').trim();
  var srcLabel = sourceDisplayName_(item);
  var pub = itemPublishedDisplay_(item, sheetDateYmd);

  var opening = plain || title;
  var whatKnow = plain;
  if (plain.length < 120) {
    whatKnow =
      title +
      ' ' +
      plain +
      ' Understanding this story helps you follow how AI tools, platforms, and investments are evolving.';
  } else {
    whatKnow =
      plain +
      ' Readers should consider how this update fits into wider AI adoption, product strategy, and competitive dynamics.';
  }

  var whyMatters;
  if (item.apiContent && String(item.apiContent).trim()) {
    whyMatters = String(item.apiContent).trim();
  } else {
    whyMatters =
      plain +
      ' This development is part of the broader AI trend reshaping the industry.';
  }

  var html =
    '<p>' +
    escapeHtml_(opening) +
    '</p>\n\n' +
    '<h2>What you need to know</h2>\n' +
    '<p>' +
    escapeHtml_(whatKnow) +
    '</p>\n\n' +
    '<h2>Key details</h2>\n' +
    '<ul>\n' +
    '  <li>Source: ' +
    escapeHtml_(srcLabel) +
    '</li>\n' +
    '  <li>Published: ' +
    escapeHtml_(pub) +
    '</li>\n' +
    '  <li>Read full article: <a href="' +
    escapeHtmlAttr_(url) +
    '">' +
    escapeHtml_(url) +
    '</a></li>\n' +
    '</ul>\n\n' +
    '<h2>Why it matters</h2>\n' +
    '<p>' +
    escapeHtml_(whyMatters) +
    '</p>';

  var filler =
    ' This development is part of the broader AI trend reshaping the industry. For more context: ' +
    title +
    ' — source ' +
    srcLabel +
    ', ' +
    pub +
    '. ';
  var guard = 0;
  while (plainTextLen_(html) < 300 && guard < 20) {
    guard++;
    html +=
      '\n<p>' +
      escapeHtml_(plain + filler + (url ? ' Link: ' + url : '')) +
      '</p>';
  }
  return html;
}

function truncatePlain_(text, maxLen) {
  var s = String(text || '');
  if (s.length <= maxLen) {
    return s;
  }
  return s.substring(0, maxLen - 1).replace(/\s+\S*$/, '').trim() || s.substring(0, maxLen);
}

function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugifyForId_(title, maxLen) {
  var s = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > maxLen) {
    s = s.substring(0, maxLen).replace(/-+$/g, '');
  }
  return s || '';
}

function appendArticleRow_(sheet, ci, numCols, data) {
  var lastRow = sheet.getLastRow();
  var newRow = lastRow + 1;
  var row = [];
  for (var c = 0; c < numCols; c++) {
    row.push('');
  }
  row[ci.id] = data.id;
  row[ci.title] = data.title;
  row[ci.date] = data.date;
  row[ci.tag] = data.tag;
  row[ci.excerpt] = data.excerpt;
  row[ci.body] = data.body;
  if (ci.published !== undefined) {
    row[ci.published] = data.published;
  }
  // getRange(row, column, numRows, numColumns) — not (row1,col1,row2,col2)
  sheet.getRange(newRow, 1, 1, numCols).setValues([row]);
}

function fetchAllRss_() {
  var out = [];
  for (var f = 0; f < IA_RSS_FEEDS.length; f++) {
    var url = IA_RSS_FEEDS[f];
    Logger.log('fetchAllRss_: GET ' + url);
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    var code = res.getResponseCode();
    if (code !== 200) {
      Logger.log('fetchAllRss_: HTTP ' + code + ' for ' + url);
      continue;
    }
    var text = res.getContentText();
    try {
      var parsed = parseRssOrAtom_(text, url);
      Logger.log('fetchAllRss_: parsed ' + parsed.length + ' entries from ' + url);
      out = out.concat(parsed);
    } catch (e) {
      Logger.log('fetchAllRss_: parse error for ' + url + ' — ' + e);
    }
  }
  return out;
}

function parseRssOrAtom_(xmlText, sourceUrl) {
  var items = [];
  Logger.log('parseRssOrAtom_: XmlService.parse for ' + sourceUrl);
  var doc = XmlService.parse(xmlText);
  var root = doc.getRootElement();
  var rootName = root.getName().toLowerCase();

  if (rootName === 'rss') {
    var channel = root.getChild('channel');
    if (!channel) {
      Logger.log('parseRssOrAtom_: no channel in RSS');
      return items;
    }
    var rssItems = channel.getChildren('item');
    for (var i = 0; i < rssItems.length; i++) {
      var el = rssItems[i];
      var title = getChildTextLocal_(el, 'title');
      var link = getChildTextLocal_(el, 'link');
      var desc =
        getChildTextLocal_(el, 'description') || getRssContentEncoded_(el) || getChildTextLocal_(el, 'content:encoded');
      var pubDate = getChildTextLocal_(el, 'pubDate');
      items.push({ title: title, url: link, summary: stripHtml_(desc), source: sourceUrl, pubDate: pubDate });
    }
    return items;
  }

  if (rootName === 'feed') {
    var atom = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    var entries = root.getChildren('entry', atom);
    if (!entries.length) {
      entries = root.getChildren('entry');
    }
    for (var j = 0; j < entries.length; j++) {
      var en = entries[j];
      var t = atom ? textFromAtomChild_(en, atom, 'title') : getChildTextLocal_(en, 'title');
      var href = atomLinkHref_(en, atom);
      var summ = atom ? textFromAtomChild_(en, atom, 'summary') || textFromAtomChild_(en, atom, 'content') : '';
      if (!summ) {
        summ = getChildTextLocal_(en, 'summary') || getChildTextLocal_(en, 'content');
      }
      var pubDateAtom = atom
        ? textFromAtomChild_(en, atom, 'updated') || textFromAtomChild_(en, atom, 'published')
        : getChildTextLocal_(en, 'updated') || getChildTextLocal_(en, 'published');
      items.push({ title: t, url: href, summary: stripHtml_(summ), source: sourceUrl, pubDate: pubDateAtom });
    }
  }
  return items;
}

function getChildTextLocal_(parent, localName) {
  var kids = parent.getChildren();
  for (var i = 0; i < kids.length; i++) {
    if (kids[i].getName() === localName) {
      return kids[i].getText();
    }
  }
  var el = parent.getChild(localName);
  return el ? el.getText() : '';
}

function getRssContentEncoded_(item) {
  var nsContent = XmlService.getNamespace('http://purl.org/rss/1.0/modules/content/');
  var el = item.getChild('encoded', nsContent);
  if (el) {
    return el.getText();
  }
  var kids = item.getChildren();
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k.getName() === 'encoded' && k.getNamespace() && k.getNamespace().getURI().indexOf('purl.org/rss') !== -1) {
      return k.getText();
    }
  }
  return '';
}

function textFromAtomChild_(entry, atom, name) {
  var el = entry.getChild(name, atom);
  return el ? el.getText() : '';
}

function atomLinkHref_(entry, atom) {
  var links = entry.getChildren('link', atom);
  if (!links.length) {
    links = entry.getChildren('link');
  }
  var first = '';
  for (var i = 0; i < links.length; i++) {
    var hAttr = links[i].getAttribute('href');
    var h = hAttr ? hAttr.getValue() : '';
    if (!h) {
      continue;
    }
    var relAttr = links[i].getAttribute('rel');
    var rel = relAttr ? relAttr.getValue() : '';
    if (rel === 'alternate') {
      return h;
    }
    if (!first) {
      first = h;
    }
  }
  return first;
}

function stripHtml_(html) {
  if (!html) {
    return '';
  }
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fetchHackerNewsTop_() {
  var out = [];
  var listUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
  Logger.log('fetchHackerNewsTop_: GET ' + listUrl);
  var res = UrlFetchApp.fetch(listUrl, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) {
    Logger.log('fetchHackerNewsTop_: list HTTP ' + res.getResponseCode());
    return out;
  }
  var ids;
  try {
    ids = JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log('fetchHackerNewsTop_: JSON parse error ' + e);
    return out;
  }
  if (!ids || !ids.length) {
    Logger.log('fetchHackerNewsTop_: empty id list');
    return out;
  }

  var max = Math.min(ids.length, IA_HN_MAX_ITEMS);
  Logger.log('fetchHackerNewsTop_: will fetch up to ' + max + ' items (sleep 500ms between)');

  for (var i = 0; i < max; i++) {
    if (i > 0) {
      Utilities.sleep(500);
    }
    var id = ids[i];
    var itemUrl = 'https://hacker-news.firebaseio.com/v0/item/' + id + '.json';
    Logger.log('fetchHackerNewsTop_: item ' + (i + 1) + '/' + max + ' GET ' + itemUrl);
    var ir = UrlFetchApp.fetch(itemUrl, { muteHttpExceptions: true, followRedirects: true });
    if (ir.getResponseCode() !== 200) {
      Logger.log('fetchHackerNewsTop_: item ' + id + ' HTTP ' + ir.getResponseCode());
      continue;
    }
    var item;
    try {
      item = JSON.parse(ir.getContentText());
    } catch (e2) {
      Logger.log('fetchHackerNewsTop_: item ' + id + ' JSON error');
      continue;
    }
    if (!item || item.type !== 'story' || !item.title) {
      continue;
    }
    var url = item.url || 'https://news.ycombinator.com/item?id=' + id;
    var textPart = item.text ? stripHtml_(item.text) : '';
    var summ = (item.title + (textPart ? ' ' + textPart : '')).replace(/\s+/g, ' ').trim();
    out.push({ title: item.title, url: url, summary: summ, source: 'hackernews', hnTime: item.time });
  }
  Logger.log('fetchHackerNewsTop_: story items collected = ' + out.length);
  return out;
}

function fetchNewsApi_() {
  var out = [];
  var apiKey = PropertiesService.getScriptProperties().getProperty('NEWS_API_KEY');
  if (!apiKey || String(apiKey).trim() === '') {
    Logger.log('fetchNewsApi_: skipped (no NEWS_API_KEY)');
    return out;
  }
  var q = encodeURIComponent('artificial intelligence OR ChatGPT OR OpenAI');
  var url =
    'https://newsapi.org/v2/everything?q=' +
    q +
    '&language=en&sortBy=publishedAt&pageSize=30&apiKey=' +
    encodeURIComponent(apiKey.trim());
  Logger.log('fetchNewsApi_: GET everything endpoint');
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) {
    Logger.log(
      'fetchNewsApi_: HTTP ' + res.getResponseCode() + ' body snippet ' + res.getContentText().substring(0, 200)
    );
    return out;
  }
  var data;
  try {
    data = JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log('fetchNewsApi_: JSON error ' + e);
    return out;
  }
  if (!data.articles || !data.articles.length) {
    Logger.log('fetchNewsApi_: no articles in response');
    return out;
  }
  for (var i = 0; i < data.articles.length; i++) {
    var a = data.articles[i];
    if (!a.title) {
      continue;
    }
    var sum = [a.description, a.content].filter(Boolean).join(' ');
    out.push({
      title: a.title,
      url: a.url || '',
      summary: sum,
      source: 'newsapi',
      publishedAt: a.publishedAt || '',
      apiContent: stripHtml_(a.content || ''),
    });
  }
  Logger.log('fetchNewsApi_: articles = ' + out.length);
  return out;
}
