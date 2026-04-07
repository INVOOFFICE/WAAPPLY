/**
 * WaApply — Google Sheets → GitHub sync (data/blog-posts.json)
 *
 * SETUP:
 * 1. Add this file + Setup.html to the same Apps Script project (bound to your sheet).
 * 2. Articles sheet: tab "Articles" if it exists, otherwise the active sheet.
 *    If row 1 is empty, headers id | title | date | tag | excerpt | body | published are created.
 *    Column "date" is a fallback. The blog JSON `date` (shown on the site) uses the "published" column when set:
 *    stamp "Published MM/dd/yyyy HH:mm" from this script → that calendar day; if "published" is still empty at push time,
 *    the run date (same moment as the stamp) is used. Otherwise the sheet "date" column is used.
 *    Optional per-post field in JSON: short_description — when set, used for meta/og:twitter descriptions (else excerpt).
 * 3. Menu "WaApply → GitHub" → "Map columns…" to map each field to a column.
 *    Optional script property BLOG_SHEET_NAME = exact tab name to use.
 * 4. GitHub PAT — Script properties: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, SITE_NAME (optional).
 *    Site URL is fixed in this file: https://waapply.com (written into blog-posts.json).
 * 5. Sync pushes data/blog-posts.json; GitHub Actions runs npm run build and publishes Pages.
 *
 * SECURITY: never commit your GitHub token in this file (public repo = leak).
 * Only the GITHUB_TOKEN property name is used; defaults below for owner/repo/branch.
 *
 * "published" column: leave empty for new rows; after a successful push, timestamp "Published …".
 *
 * Scheduled batch publish (default: up to 5 posts / day):
 * — Menu "Install daily publish trigger" installs a DAILY run at the configured hour (default 7pm)
 *   in the Apps Script project timezone. Set project timezone to America/New_York for US evening traffic.
 * — Optional script properties: BLOG_PUBLISH_BATCH_SIZE (1–20, default 5), BLOG_PUBLISH_HOUR (0–23, default 19).
 * — Each run: up to N rows with empty "published" (skips draft rows), one GitHub commit.
 *   Selection tries to include up to 2 rows tagged "AI News" (when available), then fills remaining
 *   slots in sheet order (top to bottom). Final batch is sorted by row number for consistent JSON order.
 * — Merges into data/blog-posts.json on GitHub (does not delete existing posts).
 * — "Test publish batch (now)" runs the same logic immediately (with dialogs).
 *
 * Rapport.gs (optional but recommended): feuille « Rapport » — journal des syncs, publications et saisies IA.
 * FacebookPublisher.gs (optional): publication vers une Page Facebook — menu WaApply → Facebook.
 *
 * Google Indexing API (optional — after each successful batch publish):
 * — Cloud Console: enable "Indexing API", create a Service Account, download JSON key.
 * — Search Console → property waapply.com → Settings → Users → add the service account
 *   email as Owner (full owner).
 * — Script properties: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY (full private_key from JSON,
 *   newlines as \n when pasted on one line).
 * — URLs submitted match crawlable article pages: https://waapply.com/blog/post-id.html
 *   Optional property INDEXING_URL_MODE = page | fragment | home | both
 *   (default page). Use "fragment" for legacy hash URLs (/#id). "both" = home + each /blog/*.html.
 * — Quota: ~200 URLs/day; failures are logged only (do not block publish).
 * — Menu: Test Google Indexing API; daily batch (default 10 unpublished-to-API rows/day) via
 *   WAAPPLY_INDEXING_SENT_IDS. Optional INDEXING_DAILY_BATCH_MAX (1–200).
 */

/** WaApply defaults (override via script properties: GITHUB_OWNER, GITHUB_REPO, SITE_NAME). */
var DEFAULT_GITHUB_OWNER = 'YOUR_GITHUB_USERNAME';
var DEFAULT_GITHUB_REPO = 'waapply';
var DEFAULT_GITHUB_BRANCH = 'main';
/** Production site — always used in JSON (not overridable by script properties). */
var WAAPPLY_SITE_BASE_URL = 'https://waapply.com';
var DEFAULT_SITE_NAME = 'WaApply';
/** Preserved from GitHub JSON on sync/publish; used by site build for SEO meta. */
var DEFAULT_SITE_DESCRIPTION =
  'Practical guides to make money online with AI tools, freelance prompts, and side-income ideas—written for beginners who want honest, actionable advice.';

var ARTICLE_SHEET_NAME = 'Articles';
/** Default headers written to row 1 if the sheet is empty */
var DEFAULT_HEADER_ROW = ['id', 'title', 'date', 'tag', 'excerpt', 'body', 'published'];
var JSON_PATH = 'data/blog-posts.json';
var PROP_SITEMAP_PING_LAST = 'WAAPPLY_SITEMAP_PING_LAST';
/** JSON array of post ids already sent to Google Indexing API (avoids duplicate daily requests). */
var PROP_INDEXING_SENT_IDS = 'WAAPPLY_INDEXING_SENT_IDS';
/** Optional: max URLs per daily indexing run (default 10, max 200). */
var PROP_INDEXING_DAILY_MAX = 'INDEXING_DAILY_BATCH_MAX';
/** Property: JSON of 1-based column indices { "id": 1, "title": 2, …, "published"?: 7 } */
var PROP_COLUMN_MAP = 'BLOG_COLUMN_MAP';

/** Default posts per trigger run; override with script property BLOG_PUBLISH_BATCH_SIZE (1–20). */
var DEFAULT_PUBLISH_BATCH_SIZE = 5;
/** Default hour (0–23) in project timezone; override with BLOG_PUBLISH_HOUR. Use 19 = 7pm for “home” US evening if TZ is America/New_York. */
var DEFAULT_PUBLISH_HOUR = 19;
/** Editorial focus: disabled AI News boost to keep niche identity strict. */
var PUBLISH_BATCH_AI_NEWS_TARGET = 0;
var PUBLISH_BATCH_AI_NEWS_TAG = 'AI News';
/** Strict taxonomy allowlist + legacy alias normalization. */
var EDITORIAL_TAG_MAP = {
  'make money online': 'Make Money Online',
  'ai tools reviews': 'AI Tools Reviews',
  'freelancing guides': 'Freelancing Guides',
  'side hustle ideas': 'Side Hustle Ideas',
  'money & income': 'Side Hustle Ideas',
  'ai & income': 'Side Hustle Ideas',
  'personal finance': 'Make Money Online',
  investing: 'Make Money Online',
  'business & income': 'Make Money Online',
  'business & marketing': 'Make Money Online',
  'career & jobs': 'Freelancing Guides',
  'career & job': 'Freelancing Guides',
  'work & income': 'Freelancing Guides',
  'ai freelance and side hustle': 'Freelancing Guides',
  'ai freelance': 'Freelancing Guides',
  'ai tools': 'AI Tools Reviews',
  'ai tools comparison': 'AI Tools Reviews',
  'ai coding tools': 'AI Tools Reviews',
  'ai image generators': 'AI Tools Reviews',
  'ai automation tools': 'AI Tools Reviews',
  'chatgpt use cases': 'AI Tools Reviews',
  'gemini ai': 'AI Tools Reviews',
  'ai news': null,
};

var SETUP_FIELDS = [
  { key: 'id', label: 'ID (URL slug)', required: true },
  { key: 'title', label: 'Title', required: true },
  { key: 'date', label: 'Date (YYYY-MM-DD or Sheets date)', required: true },
  { key: 'tag', label: 'Tag / category', required: true },
  { key: 'excerpt', label: 'Excerpt (card preview)', required: true },
  { key: 'body', label: 'Body (plain text or HTML starting with <p)', required: true },
  { key: 'published', label: 'Published (TRUE/yes/1 — optional)', required: false },
];

/**
 * Token: only via GITHUB_TOKEN script property (never hard-coded).
 * Owner / repo / branch / siteName: WaApply defaults above, overridable via script properties. Site URL is WAAPPLY_SITE_BASE_URL.
 */
function getProps_() {
  var p = PropertiesService.getScriptProperties();
  var token = String(p.getProperty('GITHUB_TOKEN') || '').trim();
  var owner = String(p.getProperty('GITHUB_OWNER') || DEFAULT_GITHUB_OWNER).trim();
  var repo = String(p.getProperty('GITHUB_REPO') || DEFAULT_GITHUB_REPO).trim();
  var branch = String(p.getProperty('GITHUB_BRANCH') || DEFAULT_GITHUB_BRANCH).trim();
  var siteBase = String(WAAPPLY_SITE_BASE_URL).replace(/\/+$/, '');
  var siteName = String(p.getProperty('SITE_NAME') || DEFAULT_SITE_NAME).trim();
  if (!token) {
    throw new Error(
      'Missing property: GITHUB_TOKEN. Project settings → Script properties → add key GITHUB_TOKEN with your PAT (github_pat_…). Only the name GITHUB_TOKEN is used — never paste the token in code.'
    );
  }
  validateGitHubConfigProps_(owner, repo, branch);
  return {
    token: token,
    owner: owner,
    repo: repo,
    branch: branch,
    siteBase: siteBase,
    siteName: siteName,
  };
}

function normalizeEditorialTag_(rawTag) {
  var key = String(rawTag || '').trim().toLowerCase();
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(EDITORIAL_TAG_MAP, key)) {
    return EDITORIAL_TAG_MAP[key];
  }
  return null;
}

/** Validates owner/repo/branch values before any API call. */
function validateGitHubConfigProps_(owner, repo, branch) {
  if (!owner || owner === 'YOUR_GITHUB_USERNAME') {
    throw new Error(
      'Invalid GITHUB_OWNER script property. Set your exact GitHub user/org (example: INVOOFFICE), not "YOUR_GITHUB_USERNAME".'
    );
  }
  if (!repo || repo === 'YOUR_REPO_NAME') {
    throw new Error(
      'Invalid GITHUB_REPO script property. Set your exact repository name (example: WAAPPLY).'
    );
  }
  if (!branch) {
    throw new Error('Invalid GITHUB_BRANCH script property. Set a real branch name (example: main).');
  }
}

/**
 * Fast preflight: checks token visibility to repo and branch existence.
 * Returns lightweight info used in UI/debug logs.
 */
function verifyGitHubAccess_(props) {
  var headers = {
    Authorization: 'Bearer ' + props.token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  var repoUrl =
    'https://api.github.com/repos/' +
    encodeURIComponent(props.owner) +
    '/' +
    encodeURIComponent(props.repo);
  var repoResp = UrlFetchApp.fetch(repoUrl, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true,
  });
  if (repoResp.getResponseCode() !== 200) {
    throw new Error(
      'GitHub repo access failed (' +
        repoResp.getResponseCode() +
        '). Check GITHUB_OWNER/GITHUB_REPO/token access. Target: https://github.com/' +
        props.owner +
        '/' +
        props.repo
    );
  }

  var branchUrl = repoUrl + '/branches/' + encodeURIComponent(props.branch);
  var branchResp = UrlFetchApp.fetch(branchUrl, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true,
  });
  if (branchResp.getResponseCode() !== 200) {
    throw new Error(
      'GitHub branch access failed (' +
        branchResp.getResponseCode() +
        '). Check GITHUB_BRANCH. Target branch: ' +
        props.branch
    );
  }

  var info = JSON.parse(repoResp.getContentText());
  return {
    fullName: info.full_name || props.owner + '/' + props.repo,
    privateRepo: !!info.private,
    defaultBranch: info.default_branch || '',
  };
}

/** Posts per scheduled run; script property BLOG_PUBLISH_BATCH_SIZE overrides (1–20). */
function getScheduledBatchSize_() {
  var raw = PropertiesService.getScriptProperties().getProperty('BLOG_PUBLISH_BATCH_SIZE');
  if (raw) {
    var n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 20) return n;
  }
  return DEFAULT_PUBLISH_BATCH_SIZE;
}

/** Hour 0–23 in project timezone; script property BLOG_PUBLISH_HOUR overrides. */
function getScheduledPublishHour_() {
  var raw = PropertiesService.getScriptProperties().getProperty('BLOG_PUBLISH_HOUR');
  if (raw) {
    var h = parseInt(raw, 10);
    if (!isNaN(h) && h >= 0 && h <= 23) return h;
  }
  return DEFAULT_PUBLISH_HOUR;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WaApply → GitHub')
    .addItem('Map columns…', 'setupBlogColumns')
    .addItem('Reset column mapping', 'resetBlogColumnMap')
    .addItem('Validate GitHub config', 'validateGitHubConfig')
    .addItem('Health check (global)', 'runSystemHealthCheck')
    .addItem('Open dashboard', 'openOpsDashboard')
    .addSeparator()
    .addItem('Sync to GitHub', 'syncBlogPostsToGitHub')
    .addSeparator()
    .addItem('Install daily publish trigger (batch, ~7pm)', 'installDailyPublishTrigger')
    .addItem('Remove daily publish trigger', 'removeDailyPublishTrigger')
    .addItem('Test publish batch (now)', 'testPublishNextArticleWeekly')
    .addSeparator()
    .addItem('Test Google Indexing API (home + 1 article)', 'testGoogleIndexingApi')
    .addItem('Run indexing batch now (up to 10/day)', 'testIndexingDailyBatchNow')
    .addItem('Install daily indexing trigger (10 URLs/day)', 'installDailyIndexingTrigger')
    .addItem('Remove daily indexing trigger', 'removeDailyIndexingTrigger')
    .addSeparator()
    .addItem('Ouvrir la feuille Rapport (journal)', 'openRapportSheet')
    .addToUi();
  addIAMenuItems();
  if (typeof addFacebookMenuItems === 'function') {
    addFacebookMenuItems();
  }
}

/** Manual diagnostics from menu — safe, no write operation. */
function validateGitHubConfig() {
  var props = getProps_();
  var check = verifyGitHubAccess_(props);
  var msg =
    'GitHub config OK.\n\nRepo: ' +
    check.fullName +
    (check.privateRepo ? ' (private)' : ' (public)') +
    '\nBranch: ' +
    props.branch +
    '\nDefault branch: ' +
    (check.defaultBranch || '(unknown)');
  SpreadsheetApp.getUi().alert(msg);
}

/** Global, read-only diagnostics: GitHub access, sheet mapping, and trigger status. */
function runSystemHealthCheck() {
  var report = getSystemHealthCheckReport_();
  SpreadsheetApp.getUi().alert(report.title + '\n\n' + report.lines.join('\n'));
}

/** Shared health-check logic for menu alerts and dashboard UI. */
function getSystemHealthCheckReport_() {
  var lines = [];
  var failures = [];

  function ok(label, value) {
    lines.push('OK - ' + label + ': ' + value);
  }
  function fail(label, detail) {
    lines.push('FAIL - ' + label + ': ' + detail);
    failures.push(label);
  }

  var props;
  try {
    props = getProps_();
    ok('GitHub properties', props.owner + '/' + props.repo + ' @ ' + props.branch);
  } catch (eProps) {
    fail('GitHub properties', String(eProps.message || eProps));
  }

  if (props) {
    try {
      var gh = verifyGitHubAccess_(props);
      ok('GitHub API access', gh.fullName + (gh.privateRepo ? ' (private)' : ' (public)'));
      ok('GitHub default branch', gh.defaultBranch || '(unknown)');
    } catch (eGh) {
      fail('GitHub API access', String(eGh.message || eGh));
    }
  }

  try {
    var sheet = getArticleSheet_();
    ensureHeaderRow_(sheet);
    var values = sheet.getDataRange().getValues();
    if (!values || values.length < 1) {
      fail('Articles sheet', 'header not readable');
    } else {
      ok('Articles sheet', sheet.getName() + ' (' + values.length + ' row(s))');
      try {
        var ci = getColumnIndices_(values);
        var mapped = ['id', 'title', 'date', 'tag', 'excerpt', 'body']
          .map(function (k) {
            return k + '=' + (ci[k] + 1);
          })
          .join(', ');
        ok('Column mapping', mapped + (ci.published !== undefined ? ', published=' + (ci.published + 1) : ', published=(not mapped)'));
      } catch (eMap) {
        fail('Column mapping', String(eMap.message || eMap));
      }
    }
  } catch (eSheet) {
    fail('Articles sheet', String(eSheet.message || eSheet));
  }

  try {
    var hour = getScheduledPublishHour_();
    var batch = getScheduledBatchSize_();
    ok('Publish settings', 'hour=' + hour + ', batch=' + batch);
  } catch (eSettings) {
    fail('Publish settings', String(eSettings.message || eSettings));
  }

  try {
    var tz = Session.getScriptTimeZone();
    ok('Project timezone', tz || '(unknown)');
  } catch (eTz) {
    fail('Project timezone', String(eTz.message || eTz));
  }

  try {
    var triggers = ScriptApp.getProjectTriggers();
    var counts = {
      publishNextArticleWeekly: 0,
      fetchIATrendsToSheet: 0,
      publishFacebookQueue: 0,
    };
    for (var t = 0; t < triggers.length; t++) {
      var h = triggers[t].getHandlerFunction();
      if (counts[h] !== undefined) counts[h]++;
    }
    ok(
      'Triggers',
      'GitHub=' +
        counts.publishNextArticleWeekly +
        ', IA=' +
        counts.fetchIATrendsToSheet +
        ', Facebook=' +
        counts.publishFacebookQueue
    );
  } catch (eTrig) {
    fail('Triggers', String(eTrig.message || eTrig));
  }

  var title =
    failures.length === 0
      ? 'Health check OK'
      : 'Health check: ' + failures.length + ' issue(s)';
  return {
    title: title,
    failures: failures,
    lines: lines,
  };
}

/** Opens a modern dashboard sidebar (read-only monitoring). */
function openOpsDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('WaApply Ops Dashboard');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Web entry point for Apps Script Web App deployment (URL /exec). */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('WaApply Ops Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Sidebar data source: global snapshot used by Dashboard.html. */
function getDashboardSnapshot() {
  var cacheKey = 'waapply_dashboard_snapshot_v2';
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      var fromCache = JSON.parse(cached);
      fromCache.meta = fromCache.meta || {};
      fromCache.meta.cached = true;
      fromCache.meta.cachedAtIso = fromCache.meta.generatedAtIso || fromCache.nowIso || new Date().toISOString();
      fromCache.meta.cacheTtlSec = 45;
      return fromCache;
    } catch (e) {
      // Ignore broken cache and rebuild.
    }
  }

  var fresh = collectDashboardSnapshot_();
  try {
    cache.put(cacheKey, JSON.stringify(fresh), 45);
  } catch (ePut) {
    // Non-blocking.
  }
  return fresh;
}

/** Builds a fresh dashboard snapshot (used by cache wrapper). */
function collectDashboardSnapshot_() {
  var out = {
    ok: true,
    nowIso: new Date().toISOString(),
    projectTimezone: safeScriptTimezone_(),
    github: {
      ok: false,
      owner: '',
      repo: '',
      branch: '',
      fullName: '',
      privateRepo: false,
      defaultBranch: '',
      error: '',
    },
    articles: {
      ok: false,
      sheetName: '',
      totalRows: 0,
      pendingRows: 0,
      mappedColumns: '',
      error: '',
    },
    publishSettings: {
      hour: null,
      batch: null,
    },
    triggers: {
      github: 0,
      ia: 0,
      facebook: 0,
      total: 0,
    },
    rapport: {
      hasSheet: false,
      recent: [],
    },
    kpi: {
      todayPublished: 0,
      todayIaCaptured: 0,
      errors24h: 0,
      syncs24h: 0,
      published7d: 0,
      errors7d: 0,
      daily7d: [],
    },
    sitemapPing: {
      hasData: false,
      tsIso: '',
      sitemapUrl: '',
      googleCode: '',
      bingCode: '',
      ok: false,
      error: '',
    },
    alerts: [],
    healthScore: 100,
    meta: {
      cached: false,
      generatedAtIso: new Date().toISOString(),
      cacheTtlSec: 45,
    },
  };

  try {
    var props = getProps_();
    out.github.owner = props.owner;
    out.github.repo = props.repo;
    out.github.branch = props.branch;
    try {
      var gh = verifyGitHubAccess_(props);
      out.github.ok = true;
      out.github.fullName = gh.fullName;
      out.github.privateRepo = gh.privateRepo;
      out.github.defaultBranch = gh.defaultBranch;
    } catch (eGh) {
      out.github.error = String(eGh.message || eGh);
      out.ok = false;
    }
  } catch (eProps) {
    out.github.error = String(eProps.message || eProps);
    out.ok = false;
  }

  try {
    var sheet = getArticleSheet_();
    ensureHeaderRow_(sheet);
    var values = sheet.getDataRange().getValues();
    out.articles.ok = true;
    out.articles.sheetName = sheet.getName();
    out.articles.totalRows = Math.max(0, values.length - 1);

    var ci = getColumnIndices_(values);
    out.articles.pendingRows = countPendingPublishRows_(values, ci);
    out.articles.mappedColumns =
      'id=' +
      (ci.id + 1) +
      ', title=' +
      (ci.title + 1) +
      ', date=' +
      (ci.date + 1) +
      ', tag=' +
      (ci.tag + 1) +
      ', excerpt=' +
      (ci.excerpt + 1) +
      ', body=' +
      (ci.body + 1) +
      (ci.published !== undefined ? ', published=' + (ci.published + 1) : ', published=(not mapped)');
  } catch (eSheet) {
    out.articles.ok = false;
    out.articles.error = String(eSheet.message || eSheet);
    out.ok = false;
  }

  try {
    out.publishSettings.hour = getScheduledPublishHour_();
    out.publishSettings.batch = getScheduledBatchSize_();
  } catch (eSettings) {
    out.ok = false;
  }

  try {
    out.triggers = getTriggerCounts_();
  } catch (eTrig) {
    out.ok = false;
  }

  try {
    out.rapport = getRapportSnapshot_(12);
  } catch (eRapport) {
    out.rapport = {
      hasSheet: false,
      recent: [],
      error: String(eRapport.message || eRapport),
    };
  }

  try {
    out.kpi = getRapportKpis_(7);
  } catch (eKpi) {
    out.kpi = out.kpi || {};
  }

  try {
    out.sitemapPing = getLastSitemapPingStatus_();
  } catch (eSp) {
    out.sitemapPing = {
      hasData: false,
      tsIso: '',
      sitemapUrl: '',
      googleCode: '',
      bingCode: '',
      ok: false,
      error: String(eSp.message || eSp),
    };
  }

  var assessment = assessDashboardHealth_(out);
  out.alerts = assessment.alerts;
  out.healthScore = assessment.score;
  if (assessment.alerts.length > 0) {
    out.ok = false;
  }

  return out;
}

/** Simple rule-based health model for dashboard severity and score. */
function assessDashboardHealth_(snapshot) {
  var alerts = [];
  var score = 100;

  function add(level, key, message, penalty) {
    alerts.push({ level: level, key: key, message: message });
    score = Math.max(0, score - penalty);
  }

  if (!snapshot.github || !snapshot.github.ok) {
    add('critical', 'github_access', 'GitHub access is failing.', 45);
  }
  if (!snapshot.articles || !snapshot.articles.ok) {
    add('critical', 'articles_sheet', 'Articles sheet/mapping has an issue.', 30);
  }
  if (!snapshot.triggers || snapshot.triggers.github < 1) {
    add('critical', 'trigger_github', 'No GitHub publish trigger is installed.', 30);
  } else if (snapshot.triggers.github > 1) {
    add('warning', 'trigger_github_dup', 'Multiple GitHub publish triggers detected.', 10);
  }
  if (snapshot.triggers && snapshot.triggers.ia > 1) {
    add('warning', 'trigger_ia_dup', 'Multiple IA fetch triggers detected.', 8);
  }
  if (snapshot.kpi && snapshot.kpi.errors24h > 0) {
    add('warning', 'errors_24h', 'There are errors in the last 24h: ' + snapshot.kpi.errors24h, 15);
  }
  if (snapshot.articles && snapshot.articles.pendingRows > 20) {
    add('warning', 'pending_high', 'Pending queue is high (' + snapshot.articles.pendingRows + ').', 10);
  }
  if (snapshot.articles && snapshot.articles.pendingRows === 0) {
    add('info', 'pending_empty', 'Pending queue is empty.', 5);
  }
  return { score: score, alerts: alerts };
}

/** Dashboard action: validate GitHub connectivity and return text status. */
function dashboardValidateGitHubConfig() {
  var props = getProps_();
  var check = verifyGitHubAccess_(props);
  return (
    'GitHub config OK\n' +
    'Repo: ' +
    check.fullName +
    (check.privateRepo ? ' (private)' : ' (public)') +
    '\nBranch: ' +
    props.branch +
    '\nDefault branch: ' +
    (check.defaultBranch || '(unknown)')
  );
}

/** Dashboard action: run full health check and return report text. */
function dashboardRunHealthCheck() {
  var report = getSystemHealthCheckReport_();
  return report.title + '\n\n' + report.lines.join('\n');
}

/** Dashboard action: focus the Rapport sheet and return a confirmation message. */
function dashboardOpenRapportSheet() {
  openRapportSheet();
  return 'Rapport sheet opened.';
}

function safeScriptTimezone_() {
  try {
    return Session.getScriptTimeZone() || '';
  } catch (e) {
    return '';
  }
}

function getTriggerCounts_() {
  var counts = {
    github: 0,
    ia: 0,
    facebook: 0,
    total: 0,
  };
  var triggers = ScriptApp.getProjectTriggers();
  counts.total = triggers.length;
  for (var i = 0; i < triggers.length; i++) {
    var h = triggers[i].getHandlerFunction();
    if (h === 'publishNextArticleWeekly') counts.github++;
    if (h === 'fetchIATrendsToSheet') counts.ia++;
    if (h === 'publishFacebookQueue') counts.facebook++;
  }
  return counts;
}

/** Pending queue = rows with non-empty id and empty "published" cell (if mapped). */
function countPendingPublishRows_(values, ci) {
  var count = 0;
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = String(row[ci.id] || '').trim();
    if (!id) continue;
    if (ci.published === undefined) {
      count++;
      continue;
    }
    var pubRaw = String(row[ci.published] === null || row[ci.published] === undefined ? '' : row[ci.published]).trim();
    if (pubRaw === '') count++;
  }
  return count;
}

function getRapportSnapshot_(limitRows) {
  var result = {
    hasSheet: false,
    recent: [],
  };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Rapport');
  if (!sh) return result;
  result.hasSheet = true;

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return result;

  var lastCol = Math.max(6, sh.getLastColumn());
  var count = Math.min(limitRows || 10, lastRow - 1);
  var start = lastRow - count + 1;
  var rows = sh.getRange(start, 1, count, lastCol).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    result.recent.push({
      ts: String(row[0] || ''),
      day: String(row[1] || ''),
      type: String(row[2] || ''),
      summary: String(row[3] || ''),
      ids: String(row[4] || ''),
      detail: String(row[5] || ''),
    });
  }
  return result;
}

/** KPI block from Rapport logs (today / 24h / rolling N days). */
function getRapportKpis_(rollingDays) {
  var kpi = {
    todayPublished: 0,
    todayIaCaptured: 0,
    errors24h: 0,
    syncs24h: 0,
    published7d: 0,
    errors7d: 0,
    daily7d: [],
  };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Rapport');
  if (!sh || sh.getLastRow() < 2) return kpi;

  var tz = safeScriptTimezone_() || 'Etc/GMT';
  var now = new Date();
  var nowMs = now.getTime();
  var todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var windowDays = Math.max(1, rollingDays || 7);

  var lastRow = sh.getLastRow();
  var values = sh.getRange(2, 1, lastRow - 1, Math.max(6, sh.getLastColumn())).getValues();

  var dayMap = {};
  for (var i = 0; i < windowDays; i++) {
    var dt = new Date(nowMs - i * 24 * 60 * 60 * 1000);
    var d = Utilities.formatDate(dt, tz, 'yyyy-MM-dd');
    dayMap[d] = { day: d, published: 0, errors: 0 };
  }

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var tsRaw = row[0];
    var day = String(row[1] || '').trim();
    var type = String(row[2] || '').trim();

    if (!day && tsRaw) {
      try {
        var dt2 = tsRaw instanceof Date ? tsRaw : new Date(String(tsRaw));
        if (!isNaN(dt2.getTime())) day = Utilities.formatDate(dt2, tz, 'yyyy-MM-dd');
      } catch (e) {
        day = '';
      }
    }

    var tsMs = null;
    if (tsRaw instanceof Date) {
      tsMs = tsRaw.getTime();
    } else if (tsRaw) {
      var parsed = new Date(String(tsRaw)).getTime();
      if (!isNaN(parsed)) tsMs = parsed;
    }

    var isError = type.indexOf('ERREUR') === 0;
    var isPublish = type === 'PUBLICATION_PLANIFIEE';
    var isSync = type === 'SYNC_GITHUB_MANUEL';
    var isIa = type === 'SAISIE_IA_TRENDS';

    if (day === todayStr) {
      if (isPublish) kpi.todayPublished++;
      if (isIa) kpi.todayIaCaptured++;
    }

    if (tsMs !== null && nowMs - tsMs <= 24 * 60 * 60 * 1000) {
      if (isError) kpi.errors24h++;
      if (isSync) kpi.syncs24h++;
    }

    if (dayMap[day]) {
      if (isPublish) {
        dayMap[day].published++;
        kpi.published7d++;
      }
      if (isError) {
        dayMap[day].errors++;
        kpi.errors7d++;
      }
    }
  }

  var ordered = [];
  for (var j = windowDays - 1; j >= 0; j--) {
    var dt3 = new Date(nowMs - j * 24 * 60 * 60 * 1000);
    var d2 = Utilities.formatDate(dt3, tz, 'yyyy-MM-dd');
    ordered.push(dayMap[d2] || { day: d2, published: 0, errors: 0 });
  }
  kpi.daily7d = ordered;
  return kpi;
}

/**
 * Opens the dialog: pick a column per field (from row 1 headers).
 */
function setupBlogColumns() {
  var data = getSetupData_();
  var t = HtmlService.createTemplateFromFile('Setup');
  t.headers = data.headers;
  t.labels = data.labels;
  t.current = data.current;
  t.fields = SETUP_FIELDS;
  t.sheetName = data.sheetName;
  var html = t.evaluate().setWidth(520).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, 'Map columns — WaApply');
}

/**
 * Target sheet: BLOG_SHEET_NAME script property, else "Articles", else active sheet.
 */
function getArticleSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var p = PropertiesService.getScriptProperties();
  var forced = p.getProperty('BLOG_SHEET_NAME');
  if (forced) {
    var byProp = ss.getSheetByName(forced);
    if (byProp) return byProp;
    throw new Error('Sheet not found: "' + forced + '" (script property BLOG_SHEET_NAME).');
  }
  var byDefaultName = ss.getSheetByName(ARTICLE_SHEET_NAME);
  if (byDefaultName) return byDefaultName;
  return ss.getActiveSheet();
}

/**
 * If row 1 is empty, writes default headers and freezes row 1.
 */
function ensureHeaderRow_(sheet) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var writeDefaults = false;

  if (lastCol < 1 || lastRow < 1) {
    writeDefaults = true;
  } else {
    var width = Math.max(lastCol, DEFAULT_HEADER_ROW.length);
    var r1 = sheet.getRange(1, 1, 1, width).getValues()[0];
    var allEmpty = true;
    for (var i = 0; i < r1.length; i++) {
      if (String(r1[i]).trim() !== '') {
        allEmpty = false;
        break;
      }
    }
    if (allEmpty) writeDefaults = true;
  }

  if (writeDefaults) {
    sheet.getRange(1, 1, 1, DEFAULT_HEADER_ROW.length).setValues([DEFAULT_HEADER_ROW]);
    sheet.setFrozenRows(1);
  }
}

function getSetupData_() {
  var sheet = getArticleSheet_();
  ensureHeaderRow_(sheet);

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    throw new Error('Could not read columns after initialization. Try again.');
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var labels = [];
  for (var c = 1; c <= lastCol; c++) {
    labels.push(columnToLetter_(c));
  }
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_COLUMN_MAP);
  var current = null;
  if (raw) {
    try {
      current = JSON.parse(raw);
    } catch (e) {
      current = null;
    }
  }
  return { headers: headers, labels: labels, current: current, sheetName: sheet.getName() };
}

/**
 * Called from Setup.html — saves mapping (1-based column index; 1 = column A).
 */
function saveBlogColumnMap(map) {
  if (!map || typeof map !== 'object') {
    throw new Error('Invalid data.');
  }
  var cleaned = {};
  var required = ['id', 'title', 'date', 'tag', 'excerpt', 'body'];
  for (var i = 0; i < required.length; i++) {
    var k = required[i];
    var v = map[k];
    var n = v === '' || v === null || v === undefined ? NaN : parseInt(v, 10);
    if (isNaN(n) || n < 1) {
      throw new Error('Select a column for: "' + k + '".');
    }
    cleaned[k] = n;
  }
  if (map.published !== '' && map.published !== null && map.published !== undefined) {
    var p = parseInt(map.published, 10);
    if (!isNaN(p) && p >= 1) {
      cleaned.published = p;
    }
  }
  PropertiesService.getScriptProperties().setProperty(PROP_COLUMN_MAP, JSON.stringify(cleaned));
}

function resetBlogColumnMap() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert(
    'Reset column mapping',
    'Columns will be detected again from row 1 headers (id, title, date, …). Continue?',
    ui.ButtonSet.YES_NO
  );
  if (r !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty(PROP_COLUMN_MAP);
  ui.alert('Mapping cleared. Use default headers or open "Map columns…" again.');
}

/**
 * Returns 0-based indices per field: { id, title, …, published? }
 */
function getColumnIndices_(values) {
  var numCols = values[0].length;
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_COLUMN_MAP);
  if (raw) {
    var colMap;
    try {
      colMap = JSON.parse(raw);
    } catch (e) {
      colMap = null;
    }
    if (colMap) {
      function toZeroBased(name) {
        if (colMap[name] === undefined || colMap[name] === null) return undefined;
        var n = parseInt(colMap[name], 10);
        if (isNaN(n) || n < 1) return undefined;
        return n - 1;
      }
      var ci = {
        id: toZeroBased('id'),
        title: toZeroBased('title'),
        date: toZeroBased('date'),
        tag: toZeroBased('tag'),
        excerpt: toZeroBased('excerpt'),
        body: toZeroBased('body'),
      };
      if (colMap.published !== undefined && colMap.published !== null) {
        var p = parseInt(colMap.published, 10);
        if (!isNaN(p) && p >= 1) {
          ci.published = p - 1;
        }
      }
      var req = ['id', 'title', 'date', 'tag', 'excerpt', 'body'];
      for (var i = 0; i < req.length; i++) {
        var k = req[i];
        if (ci[k] === undefined) {
          throw new Error('Incomplete column mapping: "' + k + '". Open "Map columns…".');
        }
        if (ci[k] >= numCols) {
          throw new Error('Column for "' + k + '" is beyond row 1 width.');
        }
      }
      if (ci.published !== undefined && ci.published >= numCols) {
        throw new Error('Column "published" is out of range.');
      }
      return ci;
    }
  }

  var header = values[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var col = {};
  for (var j = 0; j < header.length; j++) {
    col[header[j]] = j;
  }
  function reqHeader(name) {
    if (col[name] === undefined) {
      throw new Error(
        'Column "' + name + '" not found in row 1. Rename headers or use "Map columns…".'
      );
    }
    return col[name];
  }
  var ci2 = {
    id: reqHeader('id'),
    title: reqHeader('title'),
    date: reqHeader('date'),
    tag: reqHeader('tag'),
    excerpt: reqHeader('excerpt'),
    body: reqHeader('body'),
  };
  if (col['published'] !== undefined) {
    ci2.published = col['published'];
  }
  return ci2;
}

function columnToLetter_(column) {
  var s = '';
  var n = column;
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = ((n - m - 1) / 26) | 0;
  }
  return s;
}

/**
 * Reads the sheet, builds JSON, and pushes a commit to GitHub.
 * On success: fills "published" for rows that were empty (timestamp).
 */
function syncBlogPostsToGitHub() {
  var props = getProps_();
  var sheet = getArticleSheet_();
  ensureHeaderRow_(sheet);

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('No data rows (header only?)');
  }

  var ci = getColumnIndices_(values);

  var posts = [];
  /** Sheet row numbers (1-based) where published was empty and we stamp after send */
  var sheetRowsToMarkPublished = [];
  var syncRunDateIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var pubCellEmpty = false;
    // "published" column: empty or TRUE/yes/1/Published… = include. FALSE/no/0/draft = skip.
    if (ci.published !== undefined) {
      var pub = row[ci.published];
      var pubStrRaw = String(pub === null || pub === undefined ? '' : pub).trim();
      pubCellEmpty = pubStrRaw === '';
      var pubStr = pubStrRaw.toLowerCase();
      if (
        pubStr === 'false' ||
        pubStr === 'non' ||
        pubStr === 'no' ||
        pubStr === '0' ||
        pubStr === 'brouillon' ||
        pubStr === 'draft'
      ) {
        continue;
      }
    }

    var id = String(row[ci.id] || '').trim();
    if (!id) continue;

    var title = String(row[ci.title] || '').trim();
    var publishingNowIso = ci.published !== undefined && pubCellEmpty ? syncRunDateIso : null;
    var dateStr = resolveArticleDateIso_(row, ci, publishingNowIso);
    var tag = normalizeEditorialTag_(row[ci.tag]);
    if (!tag) continue;
    var excerpt = String(row[ci.excerpt] || '').trim();
    var bodyRaw = String(row[ci.body] || '').trim();

    var post = {
      id: id,
      title: title,
      date: dateStr,
      tag: tag,
      excerpt: excerpt,
    };

    if (bodyRaw.indexOf('<p') === 0 || bodyRaw.indexOf('<P') === 0) {
      post.bodyHtml = bodyRaw;
    } else {
      var parts = bodyRaw.split(/\n\s*\n/).map(function (s) {
        return s.trim();
      }).filter(Boolean);
      post.paragraphs = parts;
    }

    posts.push(post);

    if (ci.published !== undefined && pubCellEmpty) {
      sheetRowsToMarkPublished.push(r + 1);
    }
  }

  posts.sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  var siteDescription = DEFAULT_SITE_DESCRIPTION;
  try {
    var remoteForMeta = getRemoteBlogPostsJson_(props);
    if (remoteForMeta) {
      var metaObj = JSON.parse(remoteForMeta);
      if (metaObj.siteDescription && String(metaObj.siteDescription).trim()) {
        siteDescription = String(metaObj.siteDescription).trim();
      }
    }
  } catch (metaErr) {
    /* keep default */
  }

  var payload = {
    siteName: props.siteName,
    siteBaseUrl: props.siteBase,
    siteDescription: siteDescription,
    posts: posts,
  };

  var jsonString = JSON.stringify(payload, null, 2) + '\n';

  if (posts.length === 0) {
    SpreadsheetApp.getUi().alert(
      'Nothing to send: 0 valid rows (check id, columns, and that the row is not marked as draft). No GitHub commit.'
    );
    return;
  }

  var pushResult = pushJsonToGitHub_(props, jsonString);
  try {
    submitSitemapPing_(props.siteBase);
  } catch (eSitemap) {
    Logger.log('Sitemap ping (sync, non-blocking): ' + eSitemap);
  }

  if (typeof appendRapportLog_ === 'function') {
    try {
      var postIdsSync = posts.map(function (p) {
        return p.id;
      });
      var stampHint =
        sheetRowsToMarkPublished.length > 0
          ? sheetRowsToMarkPublished.length + ' ligne(s) avec tampon Published'
          : 'pas de nouveau tampon';
      appendRapportLog_(
        'SYNC_GITHUB_MANUEL',
        'Sync GitHub : ' + posts.length + ' article(s) dans le JSON. ' + stampHint,
        postIdsSync,
        pushResult && pushResult.commitUrl ? pushResult.commitUrl : ''
      );
    } catch (rapportErr) {
      Logger.log('appendRapportLog_ (sync): ' + rapportErr);
    }
  }

  if (ci.published !== undefined && sheetRowsToMarkPublished.length > 0) {
    var colPub = ci.published + 1;
    var stamp =
      'Published ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm');
    for (var m = 0; m < sheetRowsToMarkPublished.length; m++) {
      sheet.getRange(sheetRowsToMarkPublished[m], colPub).setValue(stamp);
    }
  }

  var msg =
    'OK: commit to ' +
    props.owner +
    '/' +
    props.repo +
    ' (branch "' +
    props.branch +
    '") → ' +
    JSON_PATH +
    '\n\n' +
    posts.length +
    ' post(s) in JSON.';
  if (pushResult && pushResult.commitUrl) {
    msg += '\n\nCommit link:\n' + pushResult.commitUrl;
  } else {
    msg += '\n\n⚠ If there is no link above, check GITHUB_OWNER / GITHUB_REPO / GITHUB_BRANCH in script properties.';
  }
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * Pending rows: empty "published", not draft, non-empty id. Picks up to batchSize rows:
 * first reserves up to PUBLISH_BATCH_AI_NEWS_TARGET rows tagged PUBLISH_BATCH_AI_NEWS_TAG (sheet order),
 * then fills remaining slots in sheet order. Result sorted by sheet row ascending.
 */
function selectRowsForScheduledPublish_(values, ci, batchSize) {
  var eligible = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var pub = row[ci.published];
    var pubStrRaw = String(pub === null || pub === undefined ? '' : pub).trim();
    if (pubStrRaw !== '') continue;

    var pubStr = pubStrRaw.toLowerCase();
    if (
      pubStr === 'false' ||
      pubStr === 'non' ||
      pubStr === 'no' ||
      pubStr === '0' ||
      pubStr === 'brouillon' ||
      pubStr === 'draft'
    ) {
      continue;
    }

    var id = String(row[ci.id] || '').trim();
    if (!id) continue;
    var normalizedTag = normalizeEditorialTag_(row[ci.tag]);
    if (!normalizedTag) continue;

    eligible.push({ sheetRow: r + 1, row: row });
  }

  var wantAi = Math.min(PUBLISH_BATCH_AI_NEWS_TARGET, batchSize);
  var aiNewsQueued = [];
  for (var i = 0; i < eligible.length; i++) {
    var tag = String(eligible[i].row[ci.tag] || '').trim();
    if (tag === PUBLISH_BATCH_AI_NEWS_TAG) {
      aiNewsQueued.push(eligible[i]);
    }
  }

  var picked = [];
  var pickedKey = {};
  function addPick(e) {
    if (picked.length >= batchSize) return;
    if (pickedKey[e.sheetRow]) return;
    picked.push(e);
    pickedKey[e.sheetRow] = true;
  }

  for (var j = 0; j < aiNewsQueued.length && picked.length < wantAi; j++) {
    addPick(aiNewsQueued[j]);
  }

  for (var k = 0; k < eligible.length && picked.length < batchSize; k++) {
    addPick(eligible[k]);
  }

  picked.sort(function (a, b) {
    return a.sheetRow - b.sheetRow;
  });

  var aiInBatch = 0;
  for (var m = 0; m < picked.length; m++) {
    if (String(picked[m].row[ci.tag] || '').trim() === PUBLISH_BATCH_AI_NEWS_TAG) {
      aiInBatch++;
    }
  }
  Logger.log(
    'selectRowsForScheduledPublish_: batchSize=' +
      batchSize +
      ' picked=' +
      picked.length +
      ' aiNewsInBatch=' +
      aiInBatch +
      ' aiNewsQueued=' +
      aiNewsQueued.length
  );

  return picked;
}

/**
 * Time-driven trigger entry point (name kept for existing triggers): publishes up to N posts per run
 * (default 5), with up to 2 "AI News" rows when available, then sheet order. Merges into GitHub JSON.
 */
function publishNextArticleWeekly() {
  publishNextArticleWeeklyCore_(false);
}

/** Same as scheduled run, with UI alerts (manual test from the menu). */
function testPublishNextArticleWeekly() {
  publishNextArticleWeeklyCore_(true);
}

function publishNextArticleWeeklyCore_(showUi) {
  try {
    var batchSize = getScheduledBatchSize_();
    var props = getProps_();
    var sheet = getArticleSheet_();
    ensureHeaderRow_(sheet);

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      if (showUi) SpreadsheetApp.getUi().alert('No data rows in the sheet.');
      return;
    }

    var ci = getColumnIndices_(values);
    if (ci.published === undefined) {
      var err =
        'The "published" column is required for scheduled publish (use Map columns…).';
      if (showUi) SpreadsheetApp.getUi().alert(err);
      else Logger.log('publishNextArticleWeekly: ' + err);
      return;
    }

    var foundList = selectRowsForScheduledPublish_(values, ci, batchSize);

    if (foundList.length === 0) {
      var msgNone =
        'Scheduled publish: no pending post. Add rows and leave "published" empty for the queue.';
      if (showUi) SpreadsheetApp.getUi().alert(msgNone);
      else Logger.log(msgNone);
      return;
    }

    var remoteText = getRemoteBlogPostsJson_(props);
    var posts = [];
    var siteDescription = DEFAULT_SITE_DESCRIPTION;
    if (remoteText) {
      try {
        var remoteObj = JSON.parse(remoteText);
        posts = remoteObj.posts || [];
        if (remoteObj.siteDescription && String(remoteObj.siteDescription).trim()) {
          siteDescription = String(remoteObj.siteDescription).trim();
        }
      } catch (e) {
        posts = [];
      }
    }

    var publishDateIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var newPosts = [];
    for (var q = 0; q < foundList.length; q++) {
      var builtPost = buildPostFromRow_(foundList[q].row, ci, publishDateIso);
      if (builtPost) newPosts.push(builtPost);
    }
    if (newPosts.length === 0) {
      var msgNoTag =
        'Scheduled publish: no publishable row after editorial category filtering (check tag values).';
      if (showUi) SpreadsheetApp.getUi().alert(msgNoTag);
      else Logger.log(msgNoTag);
      return;
    }

    for (var np = 0; np < newPosts.length; np++) {
      var newPost = newPosts[np];
      var replaced = false;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === newPost.id) {
          posts[i] = newPost;
          replaced = true;
          break;
        }
      }
      if (!replaced) posts.push(newPost);
    }

    posts.sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    var payload = {
      siteName: props.siteName,
      siteBaseUrl: props.siteBase,
      siteDescription: siteDescription,
      posts: posts,
    };
    var jsonString = JSON.stringify(payload, null, 2) + '\n';

    var idList = newPosts
      .map(function (p) {
        return p.id;
      })
      .join(', ');
    var commitMsg = 'chore(blog): scheduled publish (' + idList + ')';
    if (commitMsg.length > 120) {
      commitMsg = 'chore(blog): scheduled publish batch (' + newPosts.length + ' posts)';
    }
    var pushResult = pushJsonToGitHub_(props, jsonString, commitMsg);
    try {
      submitSitemapPing_(props.siteBase);
    } catch (eSitemap2) {
      Logger.log('Sitemap ping (publish, non-blocking): ' + eSitemap2);
    }

    // Google Indexing API (non-blocking; requires GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY)
    try {
      requestIndexingForPublishedPosts_(newPosts, props.siteBase);
    } catch (eIdx) {
      Logger.log('Indexing API (non-blocking): ' + eIdx);
    }

    var colPub = ci.published + 1;
    var stamp =
      'Published ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm');
    for (var m = 0; m < foundList.length; m++) {
      sheet.getRange(foundList[m].sheetRow, colPub).setValue(stamp);
    }

    var okMsg =
      'Published ' +
      newPosts.length +
      ' post(s): ' +
      idList +
      '. Total on site: ' +
      posts.length +
      ' post(s).';
    if (pushResult && pushResult.commitUrl) {
      okMsg += '\n\n' + pushResult.commitUrl;
    }
    if (typeof appendRapportLog_ === 'function') {
      try {
        var pubIds = newPosts.map(function (p) {
          return p.id;
        });
        appendRapportLog_(
          'PUBLICATION_PLANIFIEE',
          'Publication planifiée : ' + newPosts.length + ' article(s) vers GitHub',
          pubIds,
          pushResult && pushResult.commitUrl ? pushResult.commitUrl : ''
        );
      } catch (rapportErr) {
        Logger.log('appendRapportLog_ (publish batch): ' + rapportErr);
      }
    }

    if (showUi) SpreadsheetApp.getUi().alert(okMsg);
    else {
      Logger.log(
        'publishNextArticleWeekly OK: ' +
          newPosts.length +
          ' post(s) — ' +
          (pushResult.commitUrl || '')
      );
    }
  } catch (e) {
    Logger.log('publishNextArticleWeekly error: ' + e);
    if (typeof appendRapportLog_ === 'function') {
      try {
        appendRapportLog_(
          'ERREUR_PUBLICATION',
          'Échec publication planifiée (batch)',
          '',
          String(e.message || e)
        );
      } catch (rapportErr2) {
        Logger.log('appendRapportLog_ (publish error): ' + rapportErr2);
      }
    }
    if (showUi) SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

/**
 * Non-blocking sitemap notification after successful GitHub update.
 * Helps search engines discover newly published URLs faster.
 */
function submitSitemapPing_(siteBase) {
  var base = String(siteBase || WAAPPLY_SITE_BASE_URL || 'https://waapply.com').replace(/\/+$/, '');
  var sitemapUrl = base + '/sitemap.xml';
  var result = {
    hasData: true,
    tsIso: new Date().toISOString(),
    sitemapUrl: sitemapUrl,
    googleCode: '',
    bingCode: '',
    ok: false,
    error: '',
  };
  try {
    var googleUrl = 'https://www.google.com/ping?sitemap=' + encodeURIComponent(sitemapUrl);
    var bingUrl = 'https://www.bing.com/ping?sitemap=' + encodeURIComponent(sitemapUrl);
    var gResp = UrlFetchApp.fetch(googleUrl, { method: 'get', muteHttpExceptions: true });
    var bResp = UrlFetchApp.fetch(bingUrl, { method: 'get', muteHttpExceptions: true });
    result.googleCode = String(gResp.getResponseCode());
    result.bingCode = String(bResp.getResponseCode());
    result.ok = /^2/.test(result.googleCode) && /^2/.test(result.bingCode);
    Logger.log('Sitemap ping Google -> HTTP ' + result.googleCode + ' | Bing -> HTTP ' + result.bingCode);
  } catch (e) {
    result.error = String(e.message || e);
    Logger.log('Sitemap ping error: ' + result.error);
  }
  try {
    PropertiesService.getScriptProperties().setProperty(PROP_SITEMAP_PING_LAST, JSON.stringify(result));
  } catch (eSet) {
    Logger.log('Sitemap ping state save error: ' + eSet);
  }
  return result;
}

function getLastSitemapPingStatus_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_SITEMAP_PING_LAST);
  if (!raw) {
    return {
      hasData: false,
      tsIso: '',
      sitemapUrl: '',
      googleCode: '',
      bingCode: '',
      ok: false,
      error: '',
    };
  }
  try {
    var obj = JSON.parse(raw);
    obj.hasData = true;
    return obj;
  } catch (e) {
    return {
      hasData: false,
      tsIso: '',
      sitemapUrl: '',
      googleCode: '',
      bingCode: '',
      ok: false,
      error: String(e.message || e),
    };
  }
}

/**
 * JSON post date for the site: published stamp if present; else publishingNowIso when this row is being published now
 * (batch: pass today; sync: pass syncRunDateIso only for rows with empty published); else sheet date column.
 */
function resolveArticleDateIso_(row, ci, publishingNowIso) {
  if (ci.published !== undefined) {
    var parsed = parsePublishedStampToIso_(row[ci.published]);
    if (parsed) {
      return parsed;
    }
    var pubStrRaw = String(row[ci.published] === null || row[ci.published] === undefined ? '' : row[ci.published]).trim();
    if (pubStrRaw === '' && publishingNowIso) {
      return publishingNowIso;
    }
  }
  return formatDateIso_(row[ci.date]);
}

/** Parses our "Published MM/dd/yyyy HH:mm" stamp (or a Sheets Date) → YYYY-MM-DD in script timezone. */
function parsePublishedStampToIso_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(value === null || value === undefined ? '' : value).trim();
  if (!s) {
    return null;
  }
  var m = s.match(/^Published\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/i);
  if (!m) {
    return null;
  }
  var month = parseInt(m[1], 10) - 1;
  var day = parseInt(m[2], 10);
  var year = parseInt(m[3], 10);
  var hh = parseInt(m[4], 10);
  var mm = parseInt(m[5], 10);
  var dt = new Date(year, month, day, hh, mm, 0, 0);
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function buildPostFromRow_(row, ci, publishingNowIso) {
  var dateStr = resolveArticleDateIso_(row, ci, publishingNowIso);
  var title = String(row[ci.title] || '').trim();
  var tag = normalizeEditorialTag_(row[ci.tag]);
  if (!tag) return null;
  var excerpt = String(row[ci.excerpt] || '').trim();
  var bodyRaw = String(row[ci.body] || '').trim();

  var post = {
    id: String(row[ci.id] || '').trim(),
    title: title,
    date: dateStr,
    tag: tag,
    excerpt: excerpt,
  };

  if (bodyRaw.indexOf('<p') === 0 || bodyRaw.indexOf('<P') === 0) {
    post.bodyHtml = bodyRaw;
  } else {
    post.paragraphs = bodyRaw
      .split(/\n\s*\n/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }
  return post;
}

/** Raw contents of data/blog-posts.json on the branch, or null. */
function getRemoteBlogPostsJson_(props) {
  var path = JSON_PATH;
  var url =
    'https://api.github.com/repos/' +
    encodeURIComponent(props.owner) +
    '/' +
    encodeURIComponent(props.repo) +
    '/contents/' +
    path.split('/').map(encodeURIComponent).join('/');

  var getResp = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(props.branch), {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + props.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    muteHttpExceptions: true,
  });

  if (getResp.getResponseCode() !== 200) return null;
  var fileMeta = JSON.parse(getResp.getContentText());
  if (!fileMeta.content) return null;
  return Utilities.newBlob(Utilities.base64Decode(fileMeta.content.replace(/\n/g, ''))).getDataAsString();
}

/** Deletes all triggers for publishNextArticleWeekly (no UI). */
function deleteScheduledPublishTriggersSilent_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = triggers.length - 1; i >= 0; i--) {
    if (triggers[i].getHandlerFunction() === 'publishNextArticleWeekly') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Daily trigger at BLOG_PUBLISH_HOUR / DEFAULT_PUBLISH_HOUR (default 19 = 7pm) in project timezone.
 * Set project timezone to America/New_York (Project settings) so 7pm = US Eastern evening.
 */
function installDailyPublishTrigger() {
  deleteScheduledPublishTriggersSilent_();
  var hour = getScheduledPublishHour_();
  var batch = getScheduledBatchSize_();
  ScriptApp.newTrigger('publishNextArticleWeekly')
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();
  SpreadsheetApp.getUi().alert(
    'Trigger installed: every day at ' +
      hour +
      ':00 (script project timezone), up to ' +
      batch +
      ' post(s) per run (empty "published" queue). Each batch prefers up to ' +
      PUBLISH_BATCH_AI_NEWS_TARGET +
      ' rows tagged "' +
      PUBLISH_BATCH_AI_NEWS_TAG +
      '" when available. Set timezone to America/New_York for US evening audience.'
  );
}

/** Removes time-based triggers tied to publishNextArticleWeekly. */
function removeDailyPublishTrigger() {
  var before = 0;
  var triggers = ScriptApp.getProjectTriggers();
  for (var j = 0; j < triggers.length; j++) {
    if (triggers[j].getHandlerFunction() === 'publishNextArticleWeekly') before++;
  }
  deleteScheduledPublishTriggersSilent_();
  SpreadsheetApp.getUi().alert(
    before > 0 ? before + ' daily publish trigger(s) removed.' : 'No daily publish trigger to remove.'
  );
}

/** @deprecated Renamed to installDailyPublishTrigger — wrapper for old menu/automation. */
function installWeeklyPublishTrigger() {
  installDailyPublishTrigger();
}

/** @deprecated Renamed to removeDailyPublishTrigger */
function removeWeeklyPublishTrigger() {
  removeDailyPublishTrigger();
}

function formatDateIso_(cell) {
  if (cell instanceof Date) {
    var y = cell.getFullYear();
    var m = ('0' + (cell.getMonth() + 1)).slice(-2);
    var d = ('0' + cell.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  var s = String(cell).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var fr = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (fr) {
    var a = parseInt(fr[1], 10);
    var b = parseInt(fr[2], 10);
    var year = parseInt(fr[3], 10);
    var pad = function (n) {
      return ('0' + n).slice(-2);
    };
    // DD/MM/YYYY (EU/MA): first = day, second = month — only if month is 1–12.
    if (b >= 1 && b <= 12 && a >= 1 && a <= 31) {
      return year + '-' + pad(b) + '-' + pad(a);
    }
    // MM/DD/YYYY (US), e.g. 03/28/2026 — when DD/MM is impossible (month > 12) or unused above.
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
      return year + '-' + pad(a) + '-' + pad(b);
    }
  }
  throw new Error(
    'Invalid date (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or Sheets date cell): ' + s
  );
}

/**
 * Updates data/blog-posts.json. Returns { commitUrl, commitSha } to verify on GitHub.
 * @param {string} [optCommitMessage] optional Git commit message.
 */
function pushJsonToGitHub_(props, content, optCommitMessage) {
  // Fail early with clear diagnostics before touching file contents.
  verifyGitHubAccess_(props);

  var path = JSON_PATH;
  var url =
    'https://api.github.com/repos/' +
    encodeURIComponent(props.owner) +
    '/' +
    encodeURIComponent(props.repo) +
    '/contents/' +
    path.split('/').map(encodeURIComponent).join('/');

  var getResp = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(props.branch), {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + props.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    muteHttpExceptions: true,
  });

  var sha = null;
  if (getResp.getResponseCode() === 200) {
    var fileMeta = JSON.parse(getResp.getContentText());
    sha = fileMeta.sha;
  } else if (getResp.getResponseCode() !== 404) {
    throw new Error('GitHub GET ' + getResp.getResponseCode() + ' : ' + getResp.getContentText());
  }

  var blob = Utilities.newBlob(content, 'application/json; charset=utf-8', 'blog-posts.json');
  var base64 = Utilities.base64Encode(blob.getBytes());

  var body = {
    message: optCommitMessage || 'chore(blog): sync from Google Sheets',
    content: base64,
    branch: props.branch,
  };
  if (sha) body.sha = sha;

  var putResp = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + props.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  var code = putResp.getResponseCode();
  var putText = putResp.getContentText();
  if (code !== 200 && code !== 201) {
    var hint = '';
    if (code === 404) {
      hint =
        '\n\n404 = repo or branch not found, or token cannot access this repo.\n' +
        'Check Script properties: GITHUB_OWNER (username or org, exact), GITHUB_REPO (repo name only), ' +
        'GITHUB_BRANCH (must exist, e.g. main).\n' +
        'PAT needs repo scope; private/forbidden repos often return 404 (not 403).\n' +
        'Target: https://github.com/' +
        props.owner +
        '/' +
        props.repo +
        ' (branch: ' +
        props.branch +
        ')';
    }
    throw new Error('GitHub PUT ' + code + ' : ' + putText + hint);
  }

  var commitUrl = '';
  var commitSha = '';
  try {
    var out = JSON.parse(putText);
    if (out.commit) {
      commitUrl = out.commit.html_url || '';
      commitSha = out.commit.sha || '';
    }
  } catch (e) {
    /* ignore */
  }
  if (!commitUrl) {
    throw new Error(
      'Unexpected GitHub response (no commit URL). Target repo: ' +
        props.owner +
        '/' +
        props.repo +
        ' — check script properties. Body: ' +
        putText.slice(0, 500)
    );
  }
  return { commitUrl: commitUrl, commitSha: commitSha };
}

// ═══════════════════════════════════════════════════════════════════════════
// Google Indexing API — notify Google after GitHub push (batch publish)
// Script properties: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY (from service account JSON)
// Optional: INDEXING_URL_MODE = page | fragment | home | both  (default: page = /blog/slug.html)
// Daily backfill: requestIndexingDailyBatch (trigger) — up to INDEXING_DAILY_BATCH_MAX URLs/day
// for sheet rows already "Published" but not yet in WAAPPLY_INDEXING_SENT_IDS.
// ═══════════════════════════════════════════════════════════════════════════

var INDEXING_SENT_IDS_CAP = 800;

/**
 * Shows a dialog when the script runs from the spreadsheet menu.
 * From the Apps Script editor (Run) or time triggers, getUi() throws — we log instead.
 */
function alertOrLog_(message) {
  try {
    SpreadsheetApp.getUi().alert(String(message));
  } catch (e) {
    Logger.log('[WaApply] ' + String(message));
  }
}

function getIndexingDailyBatchMax_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_INDEXING_DAILY_MAX);
  if (raw) {
    var n = parseInt(String(raw).trim(), 10);
    if (!isNaN(n) && n >= 1 && n <= 200) return n;
  }
  return 10;
}

function getIndexingSentIdsArr_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_INDEXING_SENT_IDS);
  if (!raw) return [];
  try {
    var a = JSON.parse(raw);
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

function mergeIndexingSentIds_(idList) {
  if (!idList || !idList.length) return;
  var arr = getIndexingSentIdsArr_();
  var seen = {};
  var i;
  for (i = 0; i < arr.length; i++) seen[arr[i]] = true;
  for (i = 0; i < idList.length; i++) {
    var id = String(idList[i] || '').trim();
    if (!id || seen[id]) continue;
    arr.push(id);
    seen[id] = true;
  }
  while (arr.length > INDEXING_SENT_IDS_CAP) arr.shift();
  PropertiesService.getScriptProperties().setProperty(PROP_INDEXING_SENT_IDS, JSON.stringify(arr));
}

function mergeIndexingSentIdsFromPosts_(posts) {
  if (!posts || !posts.length) return;
  var ids = posts.map(function (p) {
    return String(p.id || '').trim();
  }).filter(Boolean);
  mergeIndexingSentIds_(ids);
}

/** Sheet rows with a valid "Published …" stamp; ids top-to-bottom. */
function listPublishedArticleIdsFromSheet_() {
  var sheet = getArticleSheet_();
  ensureHeaderRow_(sheet);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var ci = getColumnIndices_(values);
  if (ci.id === undefined || ci.published === undefined) return [];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!parsePublishedStampToIso_(row[ci.published])) continue;
    var id = String(row[ci.id] === null || row[ci.id] === undefined ? '' : row[ci.id]).trim();
    if (id) out.push(id);
  }
  return out;
}

/** Menu: smoke test OAuth + one home URL + first /blog/{id}.html from published rows. */
function testGoogleIndexingApi() {
  var token = getIndexingAccessToken_();
  if (!token) {
    alertOrLog_(
      'Indexing API: no access token.\n\nSet Script properties GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY (service account JSON), enable Indexing API in Google Cloud, and add the service account as Owner in Search Console for waapply.com.\n\nCheck Executions → logs for OAuth errors.'
    );
    return;
  }
  var base = String(WAAPPLY_SITE_BASE_URL).replace(/\/+$/, '');
  var lines = [];
  var homeUrl = base + '/';
  var r0 = indexingPublishSingleUrl_(token, homeUrl);
  lines.push('Homepage: HTTP ' + r0.code + (r0.body ? ' — ' + String(r0.body).slice(0, 120) : ''));

  var pubIds = listPublishedArticleIdsFromSheet_();
  if (pubIds.length > 0) {
    var articleUrl = base + '/blog/' + pubIds[0] + '.html';
    var r1 = indexingPublishSingleUrl_(token, articleUrl);
    lines.push('Article "' + pubIds[0] + '": HTTP ' + r1.code);
  } else {
    lines.push('No row with Published stamp in sheet — only homepage was tested.');
  }
  alertOrLog_('Google Indexing API — test\n\n' + lines.join('\n') + '\n\nSee Executions → Logs for full API responses.');
}

function requestIndexingDailyBatch() {
  runIndexingDailyBatchCore_(false);
}

/** Same as daily trigger but shows result dialog. */
function testIndexingDailyBatchNow() {
  runIndexingDailyBatchCore_(true);
}

function runIndexingDailyBatchCore_(showUi) {
  var maxN = getIndexingDailyBatchMax_();
  var base = String(WAAPPLY_SITE_BASE_URL).replace(/\/+$/, '');
  var token = getIndexingAccessToken_();
  if (!token) {
    var msgSkip = 'Indexing daily batch: skipped (no OAuth token — check GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY).';
    if (showUi) alertOrLog_(msgSkip);
    else Logger.log(msgSkip);
    return;
  }
  var allPub = listPublishedArticleIdsFromSheet_();
  var sentArr = getIndexingSentIdsArr_();
  var sent = {};
  var k;
  for (k = 0; k < sentArr.length; k++) sent[sentArr[k]] = true;
  var pending = [];
  for (k = 0; k < allPub.length; k++) {
    var pid = allPub[k];
    if (!sent[pid]) pending.push(pid);
  }
  var slice = pending.slice(0, maxN);
  if (slice.length === 0) {
    var msgNone =
      'Indexing batch: 0 pending (all published article IDs already notified, or no published rows).';
    if (showUi) alertOrLog_(msgNone);
    else Logger.log(msgNone);
    return;
  }
  var posts = slice.map(function (id) {
    return { id: id };
  });
  try {
    requestIndexingForPublishedPosts_(posts, base);
  } catch (e) {
    Logger.log('Indexing daily batch error: ' + e);
    if (showUi) alertOrLog_('Indexing batch error: ' + String(e.message || e));
    return;
  }
  var msgOk = 'Indexing batch: notified up to ' + slice.length + ' URL(s): ' + slice.join(', ');
  if (showUi) alertOrLog_(msgOk + '\n\nCheck Executions → Logs for HTTP codes per URL.');
  else Logger.log(msgOk);
}

function deleteDailyIndexingTriggersSilent_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = triggers.length - 1; i >= 0; i--) {
    if (triggers[i].getHandlerFunction() === 'requestIndexingDailyBatch') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Daily trigger for indexing backfill (default 10 URLs/day, 1 hour after publish hour to avoid overlap).
 */
function installDailyIndexingTrigger() {
  deleteDailyIndexingTriggersSilent_();
  var hour = getScheduledPublishHour_() + 1;
  if (hour > 23) hour = 23;
  var maxN = getIndexingDailyBatchMax_();
  ScriptApp.newTrigger('requestIndexingDailyBatch')
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();
  alertOrLog_(
    'Indexing trigger installed: every day at ' +
      hour +
      ':00 (project timezone), up to ' +
      maxN +
      ' article URL(s) not yet sent to Indexing API.\n\nSet INDEXING_DAILY_BATCH_MAX in script properties to change limit (1–200).'
  );
}

function removeDailyIndexingTrigger() {
  var before = 0;
  var triggers = ScriptApp.getProjectTriggers();
  for (var j = 0; j < triggers.length; j++) {
    if (triggers[j].getHandlerFunction() === 'requestIndexingDailyBatch') before++;
  }
  deleteDailyIndexingTriggersSilent_();
  alertOrLog_(before > 0 ? before + ' daily indexing trigger(s) removed.' : 'No daily indexing trigger to remove.');
}

/** Base64url without padding (JWT). */
function base64UrlEncodeJwtPart_(str) {
  var bytes = Utilities.newBlob(str).getBytes();
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/** Raw RSA-SHA256 signature bytes → base64url. */
function base64UrlEncodeBytes_(sigBytes) {
  return Utilities.base64EncodeWebSafe(sigBytes).replace(/=+$/, '');
}

/**
 * Builds OAuth access_token for Indexing API using service account JWT.
 */
function getIndexingAccessToken_() {
  var p = PropertiesService.getScriptProperties();
  var clientEmail = p.getProperty('GSC_CLIENT_EMAIL');
  var privateKey = p.getProperty('GSC_PRIVATE_KEY');
  if (!clientEmail || !privateKey) {
    return null;
  }

  var keyPem = String(privateKey)
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();

  var now = Math.floor(Date.now() / 1000);
  var headerJson = JSON.stringify({ alg: 'RS256', typ: 'JWT' });
  var claimJson = JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now - 60,
  });

  var toSign =
    base64UrlEncodeJwtPart_(headerJson) + '.' + base64UrlEncodeJwtPart_(claimJson);
  var sigBytes = Utilities.computeRsaSha256Signature(toSign, keyPem);
  var jwt = toSign + '.' + base64UrlEncodeBytes_(sigBytes);

  var tokenResp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload:
      'grant_type=' +
      encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
      '&assertion=' +
      encodeURIComponent(jwt),
    muteHttpExceptions: true,
  });

  if (tokenResp.getResponseCode() !== 200) {
    Logger.log('Indexing OAuth error: ' + tokenResp.getResponseCode() + ' ' + tokenResp.getContentText());
    return null;
  }
  try {
    return JSON.parse(tokenResp.getContentText()).access_token;
  } catch (e) {
    return null;
  }
}

/**
 * Collects URLs to notify based on INDEXING_URL_MODE (default page = waapply.com/blog/id.html).
 */
function buildIndexingUrls_(newPosts, siteBase) {
  var mode = (
    PropertiesService.getScriptProperties().getProperty('INDEXING_URL_MODE') || 'page'
  )
    .toLowerCase()
    .trim();
  var base = String(siteBase || WAAPPLY_SITE_BASE_URL).replace(/\/+$/, '');
  var homeUrl = base + '/';
  var urls = [];
  var seen = {};

  function add(u) {
    if (!seen[u]) {
      seen[u] = true;
      urls.push(u);
    }
  }

  if (mode === 'home') {
    add(homeUrl);
    return urls;
  }

  if (mode === 'both') {
    add(homeUrl);
  }

  for (var i = 0; i < newPosts.length; i++) {
    var id = String(newPosts[i].id || '').trim();
    if (!id) continue;
    if (mode === 'fragment') {
      add(base + '/#' + id);
    } else if (mode === 'page' || mode === 'both') {
      add(base + '/blog/' + id + '.html');
    }
  }

  if ((mode === 'fragment' || mode === 'page') && urls.length === 0 && newPosts.length > 0) {
    add(homeUrl);
  }

  return urls;
}

/**
 * Single URL_UPDATED request. Returns { code, body } for UI/tests.
 */
function indexingPublishSingleUrl_(token, url) {
  try {
    var resp = UrlFetchApp.fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        url: url,
        type: 'URL_UPDATED',
      }),
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    Logger.log('Indexing API: ' + url + ' → HTTP ' + code);
    if (code !== 200) {
      Logger.log('Indexing API body: ' + String(body).slice(0, 500));
    }
    return { code: code, body: body };
  } catch (err) {
    Logger.log('Indexing API fetch error for ' + url + ': ' + err);
    return { code: 0, body: String(err) };
  }
}

/**
 * Publishes URL_UPDATED notifications for newPosts. No-op if credentials missing.
 * Merges post ids into WAAPPLY_INDEXING_SENT_IDS when their article URL was part of the batch
 * (skips INDEXING_URL_MODE=home-only, which does not notify per-article URLs).
 */
function requestIndexingForPublishedPosts_(newPosts, siteBase) {
  if (!newPosts || newPosts.length === 0) return;

  var token = getIndexingAccessToken_();
  if (!token) {
    Logger.log('Indexing API skipped: set GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY in script properties.');
    return;
  }

  var mode = (
    PropertiesService.getScriptProperties().getProperty('INDEXING_URL_MODE') || 'page'
  )
    .toLowerCase()
    .trim();

  var urls = buildIndexingUrls_(newPosts, siteBase);
  if (urls.length === 0) return;

  for (var u = 0; u < urls.length; u++) {
    indexingPublishSingleUrl_(token, urls[u]);
  }

  if (mode !== 'home') {
    mergeIndexingSentIdsFromPosts_(newPosts);
  }
}
