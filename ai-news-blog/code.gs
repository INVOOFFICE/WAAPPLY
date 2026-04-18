/**
 * ============================================================================
 * AI NEWS BLOG — Free News APIs → Google Sheets → GitHub Pages export
 * ============================================================================
 *
 * Pipeline (hourly):
 *   fetch news (3 providers) → normalize → deduplicate → write sheet →
 *   generate SEO fields → export ai-news/news.json + ai-news/sitemap.xml →
 *   push to GitHub
 *
 * IMPORTANT:
 * - This system avoids duplicate-content penalties by generating an ORIGINAL
 *   editorial synthesis (intro + summary + key points + why it matters) rather
 *   than copying full article text. It always links to the original source URL.
 *
 * Setup:
 * - Create a Google Sheet → Extensions → Apps Script → paste this file.
 * - Script properties: NEWS_API_KEY, SHEET_ID, GROQ_API_KEY, GITHUB_TOKEN, GITHUB_REPO, WEBHOOK_URL (optional).
 */

const AI_NEWS_CONFIG = {
  SHEET_ID: '', // keep empty for bound scripts
  SHEET_NAME: 'AiNews',
  TIMEZONE: '', // optional, else Session timezone

  // Export targets inside this repo
  GITHUB_BRANCH: 'main',
  GITHUB_NEWS_JSON_PATH: 'ai-news/news.json',
  GITHUB_SITEMAP_PATH: 'ai-news/sitemap.xml',
  GITHUB_FEED_PATH: 'ai-news/feed.xml',

  // Canonical origin used in sitemap + JSON
  SITE_ORIGIN_FALLBACK: '',

  // Fetch behavior
  FETCH_LOOKBACK_HOURS: 24,
  MAX_ITEMS_PER_PROVIDER: 25,
  MAX_ITEMS_PER_RUN: 60,

  // Dedupe + freshness
  DEDUPE_BY: 'url', // url|title

  // SEO constraints
  SEO_TITLE_MAX: 70,
  META_DESC_MAX: 160,
  SUMMARY_WORDS_MAX: 150,
  BULLETS_MAX: 6,
  MIN_SUMMARY_CHARS: 220,
  MIN_QUALITY_SCORE: 6,

  // Categories (used when provider doesn't supply)
  CATEGORIES: ['AI', 'ML', 'Tools', 'ChatGPT', 'Generative AI', 'Research', 'Business'],
};

const AI_NEWS_COLS = [
  'ID',
  'Title',
  'Source',
  'Category',
  'Image URL',
  'URL',
  'Published At',
  'Description',
  'Summary',
  'SEO Title',
  'Meta Description',
  'Keywords',
  'Slug',
  'Status',
  'Added At',
];

const AI_NEWS_COL = AI_NEWS_COLS.reduce((acc, name, i) => {
  acc[name] = i + 1;
  return acc;
}, {});

const AI_NEWS_STATUS_PUBLISHED = 'PUBLISHED';

function aiNews_safeUi_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    return null;
  }
}

function aiNews_notify_(message) {
  const ui = aiNews_safeUi_();
  if (ui) {
    ui.alert(message);
  } else {
    Logger.log(message);
  }
}

function aiNews_onOpen() {
  const ui = aiNews_safeUi_();
  if (!ui) return;
  ui
    .createMenu('🧠 waapply Control Center')
    .addItem('Setup Sheet', 'appSetup_setupSheet')
    .addItem('Fetch Articles (App Setup)', 'appSetup_fetchArticles')
    .addItem('Clear Sheet', 'appSetup_clearSheet')
    .addSeparator()
    .addItem('Test fetch (no write)', 'aiNews_testFetch')
    .addItem('Fetch + upsert rows', 'aiNews_fetchAndUpsert')
    .addItem('Run full pipeline now', 'aiNews_runPipeline')
    .addItem('Export + push to GitHub', 'aiNews_exportAndPushToGitHub')
    .addItem('Re-enrich with Groq (unpublished only)', 'aiNews_reEnrichUnpublished_')
    .addSeparator()
    .addItem('Install triggers (hourly)', 'aiNews_installTriggers')
    .addItem('Install full automation', 'aiNews_installAutomationSuite')
    .addItem('Automation status', 'aiNews_automationStatus')
    .addItem('Remove triggers', 'aiNews_removeTriggers')
    .addToUi();
}

function aiNews_getSpreadsheet_() {
  const id = aiNews_getProp_('SHEET_ID') || (AI_NEWS_CONFIG.SHEET_ID || '').trim();
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function aiNews_getSheet_() {
  const ss = aiNews_getSpreadsheet_();
  let sh = ss.getSheetByName(AI_NEWS_CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(AI_NEWS_CONFIG.SHEET_NAME);
  aiNews_ensureHeader_(sh);
  return sh;
}

function aiNews_ensureHeader_(sh) {
  const range = sh.getRange(1, 1, 1, AI_NEWS_COLS.length);
  const row = range.getValues()[0];
  const ok = AI_NEWS_COLS.every((h, i) => String(row[i] || '').trim() === h);
  if (!ok) {
    range.setValues([AI_NEWS_COLS]);
    sh.setFrozenRows(1);
  }
}

function aiNews_getProp_(key) {
  return String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
}

function aiNews_nowIso_() {
  return new Date().toISOString();
}

function aiNews_hoursAgoIso_(h) {
  const ms = Date.now() - h * 3600 * 1000;
  return new Date(ms).toISOString();
}

function aiNews_safeDateIso_(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toISOString();
  } catch (e) {
    return '';
  }
}

function aiNews_slugify_(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'article';
}

function aiNews_clampChars_(raw, max) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  const cut = s.slice(0, Math.max(0, max - 1));
  return cut.replace(/\s+\S*$/, '') + '…';
}

function appSetup_setupSheet() {
  const sh = aiNews_getSheet_();
  const cols = AI_NEWS_COLS;
  sh.clearContents();
  sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  sh.setFrozenRows(1);
  aiNews_notify_('App Setup: sheet ready.');
}

function appSetup_fetchArticles() {
  const key = aiNews_getProp_('NEWS_API_KEY') || aiNews_getProp_('AI_NEWS_NEWSAPI_KEY');
  if (!key) {
    aiNews_notify_('Missing Script Property: NEWS_API_KEY');
    return;
  }
  const apiUrl =
    'https://newsapi.org/v2/everything?q=' +
    encodeURIComponent('artificial intelligence OR machine learning OR ChatGPT') +
    '&language=en&sortBy=publishedAt&pageSize=20&apiKey=' +
    encodeURIComponent(key);
  const res = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
  const json = JSON.parse(res.getContentText() || '{}');
  const raw = Array.isArray(json.articles) ? json.articles : [];
  Logger.log('App Setup fetched articles: ' + raw.length);

  // Keep schema compatibility with the main pipeline.
  const normalized = aiNews_dedupe_(raw.map(aiNews_normalizeArticle_).filter(Boolean)).slice(0, 50);
  Logger.log('App Setup normalized AI articles: ' + normalized.length);

  appSetup_setupSheet();
  if (!normalized.length) return;

  const rows = normalized.map((a) => {
    const row = new Array(AI_NEWS_COLS.length).fill('');
    row[AI_NEWS_COL['ID'] - 1] = a.id;
    row[AI_NEWS_COL['Title'] - 1] = a.title;
    row[AI_NEWS_COL['Source'] - 1] = a.source;
    row[AI_NEWS_COL['Category'] - 1] = a.category;
    row[AI_NEWS_COL['Image URL'] - 1] = a.image;
    row[AI_NEWS_COL['URL'] - 1] = a.url;
    row[AI_NEWS_COL['Published At'] - 1] = a.publishedAt;
    row[AI_NEWS_COL['Description'] - 1] = a.description;
    row[AI_NEWS_COL['Summary'] - 1] = a.summary;
    row[AI_NEWS_COL['SEO Title'] - 1] = a.seoTitle;
    row[AI_NEWS_COL['Meta Description'] - 1] = a.metaDescription;
    row[AI_NEWS_COL['Keywords'] - 1] = a.keywords;
    row[AI_NEWS_COL['Slug'] - 1] = a.slug;
    row[AI_NEWS_COL['Status'] - 1] = a.status;
    row[AI_NEWS_COL['Added At'] - 1] = a.addedAt;
    return row;
  });
  const sh = aiNews_getSheet_();
  sh.getRange(2, 1, rows.length, AI_NEWS_COLS.length).setValues(rows);
}

function appSetup_clearSheet() {
  const sh = aiNews_getSheet_();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(1, sh.getLastColumn())).clearContent();
  aiNews_notify_('App Setup: sheet cleared.');
}

function aiNews_splitSentences_(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  return s
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function aiNews_keywordsFromTitle_(title) {
  const stop = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'to',
    'of',
    'in',
    'on',
    'for',
    'with',
    'as',
    'at',
    'from',
    'by',
    'is',
    'are',
    'was',
    'were',
    'be',
    'this',
    'that',
    'it',
    'its',
    'into',
    'new',
    'latest',
  ]);
  const tokens = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 3 && !stop.has(t));

  const freq = {};
  tokens.forEach((t) => (freq[t] = (freq[t] || 0) + 1));
  const top = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 8);

  const add = ['artificial intelligence', 'machine learning'];
  const out = top.concat(add);
  const dedup = [];
  const seen = {};
  out.forEach((k) => {
    const key = k.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    dedup.push(k);
  });
  return dedup.slice(0, 10).join(', ');
}

function aiNews_inferCategory_(title, description) {
  const s = (String(title || '') + ' ' + String(description || '')).toLowerCase();
  if (s.includes('chatgpt') || s.includes('openai')) return 'ChatGPT';
  if (s.includes('tool') || s.includes('plugin') || s.includes('startup') || s.includes('product')) return 'Tools';
  if (s.includes('generative') || s.includes('diffusion') || s.includes('text-to-image') || s.includes('image model'))
    return 'Generative AI';
  if (s.includes('research') || s.includes('paper') || s.includes('benchmark')) return 'Research';
  if (s.includes('llm') || s.includes('transformer') || s.includes('model')) return 'ML';
  if (s.includes('funding') || s.includes('market') || s.includes('revenue') || s.includes('enterprise')) return 'Business';
  return 'AI';
}

function aiNews_buildEditorialSynthesis_(title, description) {
  const t = aiNews_clampChars_(title, 110);
  const d = String(description || '').trim();
  const sentences = aiNews_splitSentences_(d);
  const intro = aiNews_clampChars_(
    sentences.length ? sentences[0] : (t ? t + ' is gaining momentum as new AI details emerge.' : d),
    200
  );

  const summaryBase = sentences.length ? sentences.slice(0, 3).join(' ') : d;
  const summary = aiNews_clampChars_(summaryBase, 900);
  const words = summary.split(/\s+/).filter(Boolean).slice(0, AI_NEWS_CONFIG.SUMMARY_WORDS_MAX).join(' ');

  const bullets = [];
  const pool = sentences.length ? sentences : aiNews_splitSentences_(t);
  pool.forEach((s) => {
    if (bullets.length >= AI_NEWS_CONFIG.BULLETS_MAX) return;
    const b = aiNews_clampChars_(s, 140);
    if (b && bullets.indexOf(b) < 0) bullets.push(b);
  });
  if (!bullets.length && t) bullets.push(aiNews_clampChars_(t, 120));

  const why = aiNews_clampChars_(
    'This update matters because it clarifies practical AI adoption trends, where competitive advantage is shifting, and what teams should monitor next for product, compliance, and market timing.',
    380
  );

  return {
    intro,
    summary: words,
    bullets,
    whyItMatters: why,
    seoTitle: aiNews_buildSeoTitle_(title),
    metaDescription: aiNews_buildMetaDescription_(title, words || d),
  };
}

function aiNews_enrichWithGroq_(title, description, url) {
  const fallback = aiNews_buildEditorialSynthesis_(title, description);
  const groqKey = aiNews_getProp_('GROQ_API_KEY');
  if (!groqKey) return fallback;
  const hash = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(url || title || ''))
  );
  const cache = CacheService.getScriptCache();
  const cacheKey = 'GROQ_ENRICH_' + hash;
  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const systemPrompt =
    'You are a professional tech journalist. You write sharp, neutral, SEO-optimized editorial content about AI news. Always respond ONLY with a valid JSON object, no markdown, no explanation.';
  const userPrompt =
    'Write editorial content for this AI news article.\n' +
    'Title: ' +
    String(title || '') +
    '\n' +
    'Description: ' +
    String(description || '') +
    '\n\n' +
    'Respond ONLY with this JSON (no markdown):\n' +
    '{\n' +
    '  "intro": "One compelling sentence (140-200 chars) with a clear hook. No clickbait.",\n' +
    '  "summary": "3-5 sentence factual summary (450-700 chars). Neutral journalistic tone, high readability.",\n' +
    '  "bullets": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"],\n' +
    '  "whyItMatters": "One paragraph (280-450 chars) explaining practical real-world significance.",\n' +
    '  "seoTitle": "SEO-optimized title under 65 chars.",\n' +
    '  "metaDescription": "SEO meta description 120-155 chars with primary keyword."\n' +
    '}';
  try {
    const res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'post',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + groqKey,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        model: 'llama3-8b-8192',
        max_tokens: 500,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) return fallback;
    const raw = JSON.parse(res.getContentText() || '{}');
    const content = raw && raw.choices && raw.choices[0] && raw.choices[0].message ? raw.choices[0].message.content : '';
    if (!content) return fallback;
    const parsed = JSON.parse(content);
    const out = {
      intro: aiNews_clampChars_(parsed.intro || fallback.intro, 200),
      summary: aiNews_clampChars_(parsed.summary || fallback.summary, 700),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map((b) => aiNews_clampChars_(b, 140)).slice(0, 6) : fallback.bullets,
      whyItMatters: aiNews_clampChars_(parsed.whyItMatters || fallback.whyItMatters, 450),
      seoTitle: aiNews_clampChars_(parsed.seoTitle || fallback.seoTitle, 65),
      metaDescription: aiNews_clampChars_(parsed.metaDescription || fallback.metaDescription, 155),
    };
    cache.put(cacheKey, JSON.stringify(out), 21600);
    Utilities.sleep(300);
    return out;
  } catch (e) {
    return fallback;
  }
}

function aiNews_qualityScore_(article) {
  let score = 0;
  if (String(article.title || '').length > 30) score += 3;
  if (String(article.description || '').length > 100) score += 2;
  if (String(article.image || '').trim()) score += 2;
  const publishedMs = new Date(article.publishedAt || 0).getTime();
  if (publishedMs && Date.now() - publishedMs < 48 * 3600 * 1000) score += 2;
  if (String(article.category || '').trim().toLowerCase() !== 'ai') score += 1;
  if (String(article.summary || '').length >= AI_NEWS_CONFIG.MIN_SUMMARY_CHARS) score += 2;
  if (Array.isArray(article.bullets) && article.bullets.length >= 3) score += 1;
  if (String(article.whyItMatters || '').length >= 160) score += 1;
  return score;
}

function aiNews_buildSeoTitle_(title) {
  const s = aiNews_clampChars_(title, AI_NEWS_CONFIG.SEO_TITLE_MAX);
  return s;
}

function aiNews_buildMetaDescription_(title, summary) {
  const base = summary || title || '';
  const s = aiNews_clampChars_(base, AI_NEWS_CONFIG.META_DESC_MAX);
  if (s.length >= 120) return s;
  return aiNews_clampChars_((title ? title + ' — ' : '') + base, AI_NEWS_CONFIG.META_DESC_MAX);
}

function aiNews_normalizeArticle_(raw) {
  const title = String(raw.title || '').trim();
  const url = String(raw.url || raw.link || '').trim();
  if (!title || !url) return null;

  const description = String(raw.description || raw.content || '').replace(/\s+/g, ' ').trim();
  const publishedAt = aiNews_safeDateIso_(raw.publishedAt || raw.pubDate || raw.published_date || raw.published || '');
  const image = String(raw.urlToImage || raw.image_url || raw.image || '').trim();
  const sourceName =
    (raw.source && (raw.source.name || raw.source.id)) ||
    raw.source_id ||
    raw.source_name ||
    raw.source ||
    raw.publisher ||
    '';
  const source = String(sourceName || '').trim() || 'Unknown';

  const category = String(raw.category || raw.category_name || raw.topic || '').trim();
  const cat = category || aiNews_inferCategory_(title, description);

  // Hard filter: keep ONLY AI-related items, even if providers return noise.
  const aiText = (title + ' ' + description + ' ' + String(raw.category || raw.topic || '')).toLowerCase();
  const aiSignals = [
    'artificial intelligence',
    'machine learning',
    'ml',
    'llm',
    'large language model',
    'chatgpt',
    'openai',
    'anthropic',
    'deepmind',
    'gemini',
    'claude',
    'mistral',
    'llama',
    'transformer',
    'generative',
    'diffusion',
    'rag',
    'retrieval augmented',
    'ai agent',
    'agentic',
  ];
  const isAi =
    AI_NEWS_CONFIG.CATEGORIES.map((c) => String(c).toLowerCase()).indexOf(String(cat).toLowerCase()) >= 0 ||
    aiSignals.some((k) => aiText.indexOf(k) >= 0);
  if (!isAi) return null;

  const synth = aiNews_enrichWithGroq_(title, description, url);
  const seoTitle = aiNews_buildSeoTitle_(synth.seoTitle || title);
  const metaDesc = aiNews_buildMetaDescription_(seoTitle, synth.metaDescription || synth.summary || description);
  const enrichedSummary = String(synth.summary || '').trim();
  const strengthenedSummary =
    enrichedSummary.length >= AI_NEWS_CONFIG.MIN_SUMMARY_CHARS
      ? enrichedSummary
      : aiNews_clampChars_(
          (enrichedSummary ? enrichedSummary + ' ' : '') +
            (description || '') +
            ' This development is important for AI operators, product teams, and decision-makers tracking real-world adoption and competitive shifts.',
          700
        );
  const slug = aiNews_slugify_(seoTitle);
  const keywords = aiNews_keywordsFromTitle_(title);

  const id = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, url)).slice(0, 16);

  const normalized = {
    id,
    title,
    source,
    category: cat,
    image,
    url,
    publishedAt: publishedAt || aiNews_nowIso_(),
    description,
    summary: strengthenedSummary,
    intro: synth.intro,
    bullets: synth.bullets,
    whyItMatters: synth.whyItMatters,
    seoTitle,
    metaDescription: metaDesc,
    keywords,
    slug,
    status: AI_NEWS_STATUS_PUBLISHED,
    addedAt: aiNews_nowIso_(),
  };
  if (aiNews_qualityScore_(normalized) < AI_NEWS_CONFIG.MIN_QUALITY_SCORE) return null;
  return normalized;
}

function aiNews_fetchNewsApi_(q, fromIso, pageSize) {
  const key = aiNews_getProp_('NEWS_API_KEY') || aiNews_getProp_('AI_NEWS_NEWSAPI_KEY');
  if (!key) return [];
  const params = {
    q,
    from: fromIso.slice(0, 10),
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: String(pageSize),
    apiKey: key,
  };
  const url = 'https://newsapi.org/v2/everything?' + Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) return [];
  const json = JSON.parse(res.getContentText() || '{}');
  const items = Array.isArray(json.articles) ? json.articles : [];
  return items.map((a) => ({ ...a, source: a.source || {} }));
}

function aiNews_fetchNewsData_(q, fromIso, pageSize) {
  const key = aiNews_getProp_('AI_NEWS_NEWSDATA_KEY');
  if (!key) return [];
  const params = {
    apikey: key,
    q,
    language: 'en',
    from_date: fromIso.slice(0, 10),
    size: String(pageSize),
  };
  const url = 'https://newsdata.io/api/1/news?' + Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) return [];
  const json = JSON.parse(res.getContentText() || '{}');
  const items = Array.isArray(json.results) ? json.results : [];
  return items.map((a) => ({
    title: a.title,
    description: a.description || a.content || '',
    url: a.link,
    urlToImage: a.image_url,
    publishedAt: a.pubDate || a.published_date,
    source: { name: a.source_id || a.source_name || a.source || 'NewsData' },
    category: (Array.isArray(a.category) && a.category[0]) || a.category,
  }));
}

function aiNews_fetchCurrents_(q, fromIso, pageSize) {
  const key = aiNews_getProp_('AI_NEWS_CURRENTS_KEY');
  if (!key) return [];
  const params = {
    apiKey: key,
    keywords: q,
    language: 'en',
    page_size: String(Math.min(200, pageSize)),
  };
  const url = 'https://api.currentsapi.services/v1/search?' + Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) return [];
  const json = JSON.parse(res.getContentText() || '{}');
  const items = Array.isArray(json.news) ? json.news : [];
  return items.map((a) => ({
    title: a.title,
    description: a.description || '',
    url: a.url,
    urlToImage: a.image,
    publishedAt: a.published,
    source: { name: a.publisher || 'Currents' },
    category: (Array.isArray(a.category) && a.category[0]) || a.category,
  }));
}

function aiNews_keywordsQuery_() {
  const base = [
    'artificial intelligence',
    'machine learning',
    'AI tools',
    'ChatGPT',
    'generative AI',
  ];
  return base;
}

function aiNews_fetchAllProviders_() {
  const fromIso = aiNews_hoursAgoIso_(AI_NEWS_CONFIG.FETCH_LOOKBACK_HOURS);
  const queries = aiNews_keywordsQuery_();
  const per = AI_NEWS_CONFIG.MAX_ITEMS_PER_PROVIDER;

  const raw = [];
  const cache = CacheService.getScriptCache();
  const cacheKey = 'AI_NEWS_RAW_' + fromIso.slice(0, 13);
  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    // ignore cache parse issues
  }

  queries.forEach((q) => {
    raw.push.apply(raw, aiNews_fetchNewsApi_(q, fromIso, per));
    raw.push.apply(raw, aiNews_fetchNewsData_(q, fromIso, per));
    raw.push.apply(raw, aiNews_fetchCurrents_(q, fromIso, per));
    Utilities.sleep(150);
  });

  const out = raw.slice(0, 600);
  try {
    cache.put(cacheKey, JSON.stringify(out), 60 * 30); // 30 minutes
  } catch (e) {
    // ignore cache write issues
  }
  return out;
}

function aiNews_dedupe_(articles) {
  const seen = {};
  const out = [];
  articles.forEach((a) => {
    if (!a) return;
    const key = AI_NEWS_CONFIG.DEDUPE_BY === 'title' ? String(a.title || '').toLowerCase() : String(a.url || '').toLowerCase();
    if (!key) return;
    if (seen[key]) return;
    seen[key] = true;
    out.push(a);
  });
  return out;
}

function aiNews_loadExistingIndex_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return { byUrl: {}, byId: {}, nextRow: 2 };
  const values = sh.getRange(2, 1, last - 1, AI_NEWS_COLS.length).getValues();
  const byUrl = {};
  const byId = {};
  values.forEach((row, i) => {
    const url = String(row[AI_NEWS_COL['URL'] - 1] || '').trim();
    const id = String(row[AI_NEWS_COL['ID'] - 1] || '').trim();
    if (url) byUrl[url] = 2 + i;
    if (id) byId[id] = 2 + i;
  });
  return { byUrl, byId, nextRow: last + 1 };
}

function aiNews_upsertRows_(sh, normalized) {
  const idx = aiNews_loadExistingIndex_(sh);
  const rowsToWrite = [];
  const ranges = [];
  let newCount = 0;

  normalized.forEach((a) => {
    const existingRow = idx.byId[a.id] || idx.byUrl[a.url] || null;
    const row = new Array(AI_NEWS_COLS.length).fill('');
    row[AI_NEWS_COL['ID'] - 1] = a.id;
    row[AI_NEWS_COL['Title'] - 1] = a.title;
    row[AI_NEWS_COL['Source'] - 1] = a.source;
    row[AI_NEWS_COL['Category'] - 1] = a.category;
    row[AI_NEWS_COL['Image URL'] - 1] = a.image;
    row[AI_NEWS_COL['URL'] - 1] = a.url;
    row[AI_NEWS_COL['Published At'] - 1] = a.publishedAt;
    row[AI_NEWS_COL['Description'] - 1] = a.description;
    row[AI_NEWS_COL['Summary'] - 1] = a.summary;
    row[AI_NEWS_COL['SEO Title'] - 1] = a.seoTitle;
    row[AI_NEWS_COL['Meta Description'] - 1] = a.metaDescription;
    row[AI_NEWS_COL['Keywords'] - 1] = a.keywords;
    row[AI_NEWS_COL['Slug'] - 1] = a.slug;
    row[AI_NEWS_COL['Status'] - 1] = a.status;
    row[AI_NEWS_COL['Added At'] - 1] = a.addedAt;

    if (existingRow) {
      rowsToWrite.push(row);
      ranges.push(sh.getRange(existingRow, 1, 1, AI_NEWS_COLS.length));
    } else {
      rowsToWrite.push(row);
      ranges.push(sh.getRange(idx.nextRow, 1, 1, AI_NEWS_COLS.length));
      idx.nextRow += 1;
      newCount += 1;
    }
  });

  ranges.forEach((r, i) => {
    r.setValues([rowsToWrite[i]]);
  });

  return { total: normalized.length, newCount };
}

function aiNews_fetchAndUpsert() {
  const sh = aiNews_getSheet_();
  const raw = aiNews_fetchAllProviders_();
  const normalized = aiNews_dedupe_(raw.map(aiNews_normalizeArticle_).filter(Boolean))
    .slice(0, AI_NEWS_CONFIG.MAX_ITEMS_PER_RUN);
  const result = aiNews_upsertRows_(sh, normalized);
  aiNews_notify_('waapply: upserted ' + result.total + ' article(s).');
}

function aiNews_testFetch() {
  const raw = aiNews_fetchAllProviders_();
  const normalized = aiNews_dedupe_(raw.map(aiNews_normalizeArticle_).filter(Boolean)).slice(0, 10);
  Logger.log(JSON.stringify(normalized, null, 2));
  aiNews_notify_('waapply: fetched ' + normalized.length + ' sample article(s). Check Logs.');
}

function aiNews_buildExportPayload_(rows) {
  const siteOrigin = aiNews_getProp_('AI_NEWS_SITE_ORIGIN') || AI_NEWS_CONFIG.SITE_ORIGIN_FALLBACK || '';
  const origin = String(siteOrigin || '').trim().replace(/\/+$/, '');

  const site = {
    name: 'waapply',
    canonicalOrigin: origin,
    language: 'en',
    defaultOgImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&h=630&fit=crop&q=80',
    topics: AI_NEWS_CONFIG.CATEGORIES,
  };

  const articles = rows
    .map((r) => {
      const url = String(r.url || '').trim();
      if (!url) return null;
      const title = String(r.title || '').trim();
      if (!title) return null;
      const slug = String(r.slug || aiNews_slugify_(r.seoTitle || title)).trim();
      const publishedAt = aiNews_safeDateIso_(r.publishedAt) || aiNews_nowIso_();
      const image = String(r.image || '').trim();
      const category = String(r.category || aiNews_inferCategory_(title, r.description)).trim() || 'AI';
      const sourceName = String(r.source || '').trim();
      const description = String(r.description || '').trim();
      const summary = String(r.summary || '').trim();
      const seoTitle = String(r.seoTitle || title).trim();
      const metaDescription = String(r.metaDescription || '').trim() || aiNews_buildMetaDescription_(seoTitle, summary || description);
      const keywords = String(r.keywords || aiNews_keywordsFromTitle_(title)).trim();

      const synth = aiNews_enrichWithGroq_(title, description, url);

      return {
        id: String(r.id || '').trim() || Utilities.getUuid(),
        title,
        seoTitle,
        metaDescription,
        category,
        image,
        imageAlt: aiNews_clampChars_(title, 120),
        url,
        source: { name: sourceName || 'Unknown' },
        publishedAt,
        description,
        summary: summary || synth.summary,
        intro: synth.intro,
        bullets: synth.bullets,
        whyItMatters: synth.whyItMatters,
        keywords,
        slug,
      };
    })
    .filter(Boolean);

  // newest first
  articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return { site, articles };
}

function aiNews_readPublishedRows_() {
  const sh = aiNews_getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, AI_NEWS_COLS.length).getValues();
  const out = [];
  values.forEach((row) => {
    const status = String(row[AI_NEWS_COL['Status'] - 1] || '').trim();
    if (status && status !== AI_NEWS_STATUS_PUBLISHED) return;
    out.push({
      id: row[AI_NEWS_COL['ID'] - 1],
      title: row[AI_NEWS_COL['Title'] - 1],
      source: row[AI_NEWS_COL['Source'] - 1],
      category: row[AI_NEWS_COL['Category'] - 1],
      image: row[AI_NEWS_COL['Image URL'] - 1],
      url: row[AI_NEWS_COL['URL'] - 1],
      publishedAt: row[AI_NEWS_COL['Published At'] - 1],
      description: row[AI_NEWS_COL['Description'] - 1],
      summary: row[AI_NEWS_COL['Summary'] - 1],
      seoTitle: row[AI_NEWS_COL['SEO Title'] - 1],
      metaDescription: row[AI_NEWS_COL['Meta Description'] - 1],
      keywords: row[AI_NEWS_COL['Keywords'] - 1],
      slug: row[AI_NEWS_COL['Slug'] - 1],
    });
  });
  return out;
}

function aiNews_reEnrichUnpublished_() {
  const sh = aiNews_getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return;
  const values = sh.getRange(2, 1, last - 1, AI_NEWS_COLS.length).getValues();
  values.forEach((row, i) => {
    const summary = String(row[AI_NEWS_COL['Summary'] - 1] || '').trim();
    if (summary && summary.length >= 80) return;
    const title = String(row[AI_NEWS_COL['Title'] - 1] || '').trim();
    const description = String(row[AI_NEWS_COL['Description'] - 1] || '').trim();
    const url = String(row[AI_NEWS_COL['URL'] - 1] || '').trim();
    if (!title || !url) return;
    const enrich = aiNews_enrichWithGroq_(title, description, url);
    const rowNum = i + 2;
    sh.getRange(rowNum, AI_NEWS_COL['Summary']).setValue(enrich.summary || summary);
    sh.getRange(rowNum, AI_NEWS_COL['SEO Title']).setValue(enrich.seoTitle || title);
    sh.getRange(rowNum, AI_NEWS_COL['Meta Description']).setValue(
      enrich.metaDescription || aiNews_buildMetaDescription_(title, description)
    );
  });
  aiNews_notify_('waapply: Groq re-enrichment completed.');
}

function aiNews_buildSitemapXml_(origin, payload) {
  const base = String(origin || '').trim().replace(/\/+$/, '');
  const urls = [];
  if (base) {
    urls.push({ loc: base + '/ai-news/', lastmod: new Date().toISOString().slice(0, 10) });
    (payload.articles || []).forEach((a) => {
      if (!a.slug) return;
      const lastmod = String(a.publishedAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      urls.push({ loc: base + '/ai-news/articles/' + encodeURIComponent(a.slug) + '/', lastmod });
    });
  }

  const body = urls
    .map((u) => {
      return (
        '  <url>\n' +
        '    <loc>' +
        aiNews_clampChars_(u.loc, 2000) +
        '</loc>\n' +
        '    <lastmod>' +
        aiNews_clampChars_(u.lastmod, 30) +
        '</lastmod>\n' +
        '  </url>'
      );
    })
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</urlset>\n'
  );
}

function aiNews_generateRssFeed_(origin, payload) {
  const base = String(origin || '').trim().replace(/\/+$/, '');
  const siteName = (payload.site && payload.site.name) || 'waapply';
  const items = (payload.articles || [])
    .map((a) => {
      const link = base + '/ai-news/articles/' + encodeURIComponent(a.slug) + '/';
      const enclosure = a.image ? '\n    <enclosure url="' + a.image + '" type="image/jpeg" length="0" />' : '';
      return (
        '  <item>\n' +
        '    <title>' + aiNews_clampChars_(a.title || '', 400) + '</title>\n' +
        '    <link>' + link + '</link>\n' +
        '    <description>' + aiNews_clampChars_(a.metaDescription || a.summary || '', 1000) + '</description>\n' +
        '    <pubDate>' + new Date(a.publishedAt || Date.now()).toUTCString() + '</pubDate>\n' +
        '    <category>' + aiNews_clampChars_(a.category || 'AI', 80) + '</category>\n' +
        '    <guid isPermaLink="true">' + link + '</guid>' +
        enclosure +
        '\n  </item>'
      );
    })
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n' +
    '<channel>\n' +
    '  <title>' + siteName + '</title>\n' +
    '  <link>' + (base ? base + '/ai-news/' : '') + '</link>\n' +
    '  <description>Artificial Intelligence news updates from waapply.</description>\n' +
    '  <language>en</language>\n' +
    '  <lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n' +
    items +
    '\n</channel>\n' +
    '</rss>\n'
  );
}

function aiNews_notifyWebhook_(n) {
  const webhook = aiNews_getProp_('WEBHOOK_URL');
  if (!webhook) return;
  const origin = (aiNews_getProp_('AI_NEWS_SITE_ORIGIN') || AI_NEWS_CONFIG.SITE_ORIGIN_FALLBACK || '').replace(/\/+$/, '');
  const text = 'waapply: published ' + n + ' new articles. ' + (origin ? origin + '/ai-news/' : '');
  try {
    UrlFetchApp.fetch(webhook, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      payload: JSON.stringify({ content: text }),
    });
  } catch (e) {
    try {
      UrlFetchApp.fetch(webhook, {
        method: 'post',
        muteHttpExceptions: true,
        contentType: 'application/json',
        payload: JSON.stringify({ text: text }),
      });
    } catch (e2) {}
  }
}

function aiNews_githubRequest_(method, url, token, payload) {
  const opts = {
    method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'token ' + token,
      Accept: 'application/vnd.github+json',
    },
  };
  if (payload != null) {
    opts.contentType = 'application/json';
    opts.payload = JSON.stringify(payload);
  }
  const res = UrlFetchApp.fetch(url, opts);
  const code = res.getResponseCode();
  const text = res.getContentText() || '';
  if (code < 200 || code >= 300) {
    throw new Error('GitHub ' + method + ' failed (' + code + '): ' + text.slice(0, 300));
  }
  return text ? JSON.parse(text) : {};
}

function aiNews_githubGetFileSha_(repo, pathInRepo, branch, token) {
  const url =
    'https://api.github.com/repos/' +
    repo +
    '/contents/' +
    encodeURIComponent(pathInRepo).replace(/%2F/g, '/') +
    '?ref=' +
    encodeURIComponent(branch);
  try {
    const json = aiNews_githubRequest_('get', url, token, null);
    return json && json.sha ? json.sha : '';
  } catch (e) {
    return '';
  }
}

function aiNews_githubPutFile_(repo, pathInRepo, branch, token, contentText, message) {
  const sha = aiNews_githubGetFileSha_(repo, pathInRepo, branch, token);
  const url =
    'https://api.github.com/repos/' +
    repo +
    '/contents/' +
    encodeURIComponent(pathInRepo).replace(/%2F/g, '/');
  const body = {
    message,
    content: Utilities.base64Encode(contentText),
    branch,
  };
  if (sha) body.sha = sha;
  aiNews_githubRequest_('put', url, token, body);
}

function aiNews_exportAndPushToGitHub() {
  const token = aiNews_getProp_('GITHUB_TOKEN');
  const repo = aiNews_getProp_('GITHUB_REPO');
  if (!token || !repo) {
    aiNews_notify_('Missing Script Properties: GITHUB_TOKEN and/or GITHUB_REPO.');
    return;
  }

  const rows = aiNews_readPublishedRows_();
  const payload = aiNews_buildExportPayload_(rows);
  const origin = String(payload.site.canonicalOrigin || '').trim().replace(/\/+$/, '');

  const newsJson = JSON.stringify(payload, null, 2) + '\n';
  const sitemap = aiNews_buildSitemapXml_(origin, payload);
  const feed = aiNews_generateRssFeed_(origin, payload);

  aiNews_githubPutFile_(
    repo,
    AI_NEWS_CONFIG.GITHUB_NEWS_JSON_PATH,
    AI_NEWS_CONFIG.GITHUB_BRANCH,
    token,
    newsJson,
    'chore: update AI news dataset'
  );
  aiNews_githubPutFile_(
    repo,
    AI_NEWS_CONFIG.GITHUB_SITEMAP_PATH,
    AI_NEWS_CONFIG.GITHUB_BRANCH,
    token,
    sitemap,
    'chore: update AI news sitemap'
  );
  aiNews_githubPutFile_(
    repo,
    AI_NEWS_CONFIG.GITHUB_FEED_PATH,
    AI_NEWS_CONFIG.GITHUB_BRANCH,
    token,
    feed,
    'chore: update AI news feed'
  );

  aiNews_notify_('waapply: pushed news.json + sitemap.xml + feed.xml to GitHub.');
}

function aiNews_runPipeline() {
  const sh = aiNews_getSheet_();
  const raw = aiNews_fetchAllProviders_();
  const normalized = aiNews_dedupe_(raw.map(aiNews_normalizeArticle_).filter(Boolean))
    .slice(0, AI_NEWS_CONFIG.MAX_ITEMS_PER_RUN);
  const result = aiNews_upsertRows_(sh, normalized);
  aiNews_exportAndPushToGitHub();
  aiNews_notifyWebhook_(result.newCount);
}

function aiNews_installTriggers() {
  aiNews_removeTriggers();
  ScriptApp.newTrigger('aiNews_runPipeline').timeBased().everyHours(1).create();
  aiNews_notify_('waapply: hourly trigger installed.');
}

function aiNews_createTimeTrigger_(fn, everyHours, nearHour) {
  let builder = ScriptApp.newTrigger(fn).timeBased();
  if (everyHours) {
    builder = builder.everyHours(everyHours);
  }
  if (typeof nearHour === 'number') {
    builder = builder.atHour(nearHour);
  }
  builder.create();
}

function aiNews_installAutomationSuite() {
  aiNews_removeTriggers();
  // Main publishing loop
  aiNews_createTimeTrigger_('aiNews_runPipeline', 1);
  // Secondary enrichment pass to improve weak drafts
  aiNews_createTimeTrigger_('aiNews_reEnrichUnpublished_', 6);
  // Fallback export to keep GitHub in sync
  aiNews_createTimeTrigger_('aiNews_exportAndPushToGitHub', 3);
  // Daily wake-up menu refresh hook equivalent
  aiNews_createTimeTrigger_('aiNews_testFetch', 24);
  aiNews_notify_('waapply: full automation installed (hourly pipeline + re-enrich + backup export).');
}

function aiNews_automationStatus() {
  const all = ScriptApp.getProjectTriggers();
  if (!all.length) {
    aiNews_notify_('waapply: no triggers installed.');
    return;
  }
  const lines = all.map((t) => {
    const fn = t.getHandlerFunction();
    const type = t.getEventType();
    return '- ' + fn + ' [' + type + ']';
  });
  aiNews_notify_('waapply automation triggers:\n' + lines.join('\n'));
}

function aiNews_removeTriggers() {
  const all = ScriptApp.getProjectTriggers();
  all.forEach((t) => {
    const fn = t.getHandlerFunction();
    if (
      fn === 'aiNews_runPipeline' ||
      fn === 'aiNews_reEnrichUnpublished_' ||
      fn === 'aiNews_exportAndPushToGitHub' ||
      fn === 'aiNews_testFetch'
    ) {
      ScriptApp.deleteTrigger(t);
    }
  });
  aiNews_notify_('waapply: automation triggers removed.');
}

