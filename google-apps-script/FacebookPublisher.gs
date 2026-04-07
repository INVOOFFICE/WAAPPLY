/**
 * WaApply — Publication automatique vers une Page Facebook (API Graph).
 *
 * IMPORTANT (Meta / Facebook) :
 * - Fonctionne avec une PAGE Facebook (brand / business), pas avec un profil personnel.
 * - Colle FACEBOOK_PAGE_ACCESS_TOKEN (jeton Page) dans Propriétés du script.
 *   FACEBOOK_PAGE_ID est optionnel : la publication utilise /me/feed (la Page = celle du jeton).
 *
 * Dépend de BlogSyncToGitHub.gs : getArticleSheet_(), getColumnIndices_(), ensureHeaderRow_().
 *
 * File d’attente : lignes où « published » est rempli (article en ligne) ET « fb_posted » vide.
 * Sans colonne fb_* : suivi via propriété FACEBOOK_POSTED_IDS (JSON array d’ids).
 *
 * Propriétés : FACEBOOK_PAGE_ACCESS_TOKEN (obligatoire), FACEBOOK_PAGE_ID (optionnel, débogage),
 * FACEBOOK_GRAPH_VERSION (défaut v21.0),
 * FACEBOOK_MAX_POSTS_PER_RUN (défaut 3), FACEBOOK_PUBLISH_HOUR (défaut 10), SITE_BASE_URL_FOR_FB.
 */

var FB_TRIGGER_HANDLER = 'publishFacebookQueue';
var FB_DEFAULT_MAX = 3;
var FB_DEFAULT_HOUR = 10;

function addFacebookMenuItems() {
  SpreadsheetApp.getUi()
    .createMenu('WaApply → Facebook')
    .addItem('Tester : publier la file (max 3)', 'publishFacebookQueueTest')
    .addItem('Vérifier le token Facebook', 'validateFacebookToken')
    .addSeparator()
    .addItem('Déclencheur quotidien (1×/jour, max 3 articles)', 'installFacebookPublishTrigger')
    .addItem('Supprimer déclencheur Facebook', 'removeFacebookPublishTrigger')
    .addToUi();
}

function publishFacebookQueueTest() {
  publishFacebookQueueCore_(true);
}

function publishFacebookQueue() {
  publishFacebookQueueCore_(false);
}

function validateFacebookToken() {
  var propsFb = getFacebookProps_();
  var check = checkFacebookToken_(propsFb.token, propsFb.ver);
  if (check.ok) {
    SpreadsheetApp.getUi().alert(
      'Facebook',
      'Token valide.\nPage liée: ' + (check.name || '(inconnue)') + '\nID: ' + (check.id || '(inconnu)'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  var msg = 'Token invalide/expiré.\n\n' + check.error + '\n\n' + getFacebookTokenRenewHint_();
  SpreadsheetApp.getUi().alert('Facebook', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function getFacebookProps_() {
  var p = PropertiesService.getScriptProperties();
  var pageId = String(p.getProperty('FACEBOOK_PAGE_ID') || '').trim();
  var token = String(p.getProperty('FACEBOOK_PAGE_ACCESS_TOKEN') || '').trim();
  var ver = String(p.getProperty('FACEBOOK_GRAPH_VERSION') || 'v21.0').trim();
  if (!token) {
    throw new Error(
      'Propriété manquante : FACEBOOK_PAGE_ACCESS_TOKEN (jeton d’accès Page, Projet → Paramètres → Propriétés du script). FACEBOOK_PAGE_ID est optionnel.'
    );
  }
  var base = String(p.getProperty('SITE_BASE_URL_FOR_FB') || 'https://waapply.com').replace(/\/+$/, '');
  var linkMode = String(p.getProperty('FACEBOOK_ARTICLE_LINK_MODE') || 'query')
    .trim()
    .toLowerCase();
  if (linkMode !== 'legacy' && linkMode !== 'query') {
    linkMode = 'query';
  }
  var maxPosts = FB_DEFAULT_MAX;
  var rawMax = p.getProperty('FACEBOOK_MAX_POSTS_PER_RUN');
  if (rawMax) {
    var n = parseInt(rawMax, 10);
    if (!isNaN(n) && n >= 1 && n <= 10) {
      maxPosts = n;
    }
  }
  return {
    pageId: pageId,
    token: token,
    ver: ver,
    siteBase: base,
    maxPosts: maxPosts,
    linkMode: linkMode,
  };
}

/** Builds public article URL for Facebook shares. */
function buildFacebookArticleUrl_(siteBase, articleId, linkMode) {
  var id = String(articleId || '').trim();
  if (!id) return String(siteBase || '').replace(/\/+$/, '') + '/';
  var base = String(siteBase || '').replace(/\/+$/, '');
  if (linkMode === 'legacy') {
    return base + '/blog/' + encodeURIComponent(id) + '.html';
  }
  return base + '/blog/post.html?id=' + encodeURIComponent(id);
}

function findHeaderColumnIndex_(values, candidates) {
  var headers = values[0].map(function (h) {
    return String(h || '')
      .trim()
      .toLowerCase();
  });
  for (var c = 0; c < candidates.length; c++) {
    var idx = headers.indexOf(candidates[c].toLowerCase());
    if (idx >= 0) {
      return idx;
    }
  }
  return -1;
}

function isPublishedCellFilled_(cell) {
  var s = String(cell === null || cell === undefined ? '' : cell).trim();
  if (!s) {
    return false;
  }
  var low = s.toLowerCase();
  if (low === 'false' || low === 'draft' || low === 'brouillon') {
    return false;
  }
  return true;
}

function getPostedIdsFromProps_() {
  var raw = PropertiesService.getScriptProperties().getProperty('FACEBOOK_POSTED_IDS');
  if (!raw) {
    return {};
  }
  try {
    var arr = JSON.parse(raw);
    var map = {};
    if (Object.prototype.toString.call(arr) === '[object Array]') {
      for (var i = 0; i < arr.length; i++) {
        map[String(arr[i]).toLowerCase()] = true;
      }
    }
    return map;
  } catch (e) {
    return {};
  }
}

function savePostedIdsToProps_(map) {
  var ids = [];
  for (var k in map) {
    if (map.hasOwnProperty(k) && map[k]) {
      ids.push(k);
    }
  }
  PropertiesService.getScriptProperties().setProperty('FACEBOOK_POSTED_IDS', JSON.stringify(ids));
}

/** Compte les lignes utiles pour expliquer pourquoi la file est vide. */
function logFacebookQueueDiagnostics_(values, ci, fbCol, useFbColumn, postedMap) {
  var publishedEmpty = 0;
  var fbBlocked = 0;
  var propsBlocked = 0;
  var noTitle = 0;
  var eligible = 0;
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = String(row[ci.id] || '').trim();
    if (!id) {
      continue;
    }
    if (!isPublishedCellFilled_(row[ci.published])) {
      publishedEmpty++;
      continue;
    }
    var title = String(row[ci.title] || '').trim();
    if (!title) {
      noTitle++;
      continue;
    }
    if (useFbColumn && fbCol >= 0) {
      if (String(row[fbCol] === null || row[fbCol] === undefined ? '' : row[fbCol]).trim() !== '') {
        fbBlocked++;
      } else {
        eligible++;
      }
    } else {
      if (postedMap[id.toLowerCase()]) {
        propsBlocked++;
      } else {
        eligible++;
      }
    }
  }
  Logger.log(
    'Facebook diagnostic: published vide=' +
      publishedEmpty +
      ' | titre vide=' +
      noTitle +
      ' | bloqué par fb_posted déjà rempli=' +
      fbBlocked +
      ' | bloqué par FACEBOOK_POSTED_IDS=' +
      propsBlocked +
      ' | éligibles=' +
      eligible +
      ' | colonne fb_posted=' +
      (useFbColumn ? 'oui' : 'non')
  );
}

function publishFacebookQueueCore_(showUi) {
  Logger.log('publishFacebookQueueCore_: start showUi=' + showUi);
  var propsFb;
  try {
    propsFb = getFacebookProps_();
  } catch (e0) {
    Logger.log('publishFacebookQueueCore_: ' + e0);
    if (showUi) {
      SpreadsheetApp.getUi().alert('Facebook', String(e0.message || e0), SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return;
  }

  var sheet = getArticleSheet_();
  ensureHeaderRow_(sheet);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    if (showUi) {
      SpreadsheetApp.getUi().alert('Facebook', 'Aucune ligne de données.', SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return;
  }

  var ci;
  try {
    ci = getColumnIndices_(values);
  } catch (e1) {
    Logger.log('publishFacebookQueueCore_: colonnes ' + e1);
    if (showUi) {
      SpreadsheetApp.getUi().alert('Facebook', 'Map columns… requis : ' + e1.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return;
  }

  if (ci.published === undefined) {
    var msg = 'Colonne « published » requise pour savoir quels articles sont en ligne.';
    if (showUi) {
      SpreadsheetApp.getUi().alert('Facebook', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return;
  }

  var fbCol = findHeaderColumnIndex_(values, ['fb_posted', 'facebook', 'facebook_posted', 'fb']);
  var useFbColumn = fbCol >= 0;
  var postedMap = useFbColumn ? null : getPostedIdsFromProps_();

  var queue = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!isPublishedCellFilled_(row[ci.published])) {
      continue;
    }
    var id = String(row[ci.id] || '').trim();
    if (!id) {
      continue;
    }

    if (useFbColumn) {
      var fbCell = row[fbCol];
      if (String(fbCell === null || fbCell === undefined ? '' : fbCell).trim() !== '') {
        continue;
      }
    } else {
      if (postedMap[id.toLowerCase()]) {
        continue;
      }
    }

    var title = String(row[ci.title] || '').trim();
    var excerpt = String(row[ci.excerpt] || '').trim();
    if (!title) {
      continue;
    }

    queue.push({
      sheetRow: r + 1,
      id: id,
      title: title,
      excerpt: excerpt,
    });
    if (queue.length >= propsFb.maxPosts) {
      break;
    }
  }

  if (queue.length === 0) {
    logFacebookQueueDiagnostics_(values, ci, fbCol, useFbColumn, postedMap || {});
    Logger.log('publishFacebookQueueCore_: rien à publier');
    var hint =
      'Aucune ligne ne remplit en même temps :\n' +
      '1) colonne « published » remplie (article déjà sur le site — Sync GitHub ou publication planifiée),\n' +
      '2) colonne « title » remplie (obligatoire pour le texte du post),\n' +
      '3) colonne « fb_posted » vide — ou ajoute l’en-tête fb_posted en ligne 1 si la colonne n’existe pas encore.\n' +
      'Sans colonne fb : l’id ne doit pas déjà figurer dans FACEBOOK_POSTED_IDS (propriétés du script).\n\n' +
      'Journal d’exécution → ligne « Facebook diagnostic » (compteurs détaillés).';
    if (showUi) {
      SpreadsheetApp.getUi().alert('Facebook — file vide', hint, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return;
  }

  var colPubFb = useFbColumn ? fbCol + 1 : null;
  var stamp =
    'FB ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var doneIds = [];
  var errors = [];

  for (var q = 0; q < queue.length; q++) {
    var item = queue[q];
    var url = buildFacebookArticleUrl_(propsFb.siteBase, item.id, propsFb.linkMode);
    var msg =
      item.title +
      '\n\n' +
      (item.excerpt ? item.excerpt.substring(0, 500) + (item.excerpt.length > 500 ? '…' : '') : '') +
      '\n\n' +
      url;

    Logger.log('publishFacebookQueueCore_: POST Facebook id=' + item.id);
    var result = postToFacebookGraph_(propsFb.token, propsFb.ver, url, msg);
    if (result.ok) {
      doneIds.push(item.id);
      if (useFbColumn && colPubFb) {
        sheet.getRange(item.sheetRow, colPubFb).setValue(stamp + (result.postId ? ' id:' + result.postId : ''));
      } else {
        postedMap[item.id.toLowerCase()] = true;
      }
      if (typeof appendRapportLog_ === 'function') {
        appendRapportLog_(
          'FACEBOOK_PUBLICATION',
          'Post Facebook : ' + item.title.substring(0, 80),
          item.id,
          result.postId || url
        );
      }
    } else {
      errors.push(item.id + ': ' + result.error);
      Logger.log('publishFacebookQueueCore_: erreur ' + result.error);
      if (result.authExpired) {
        var stopMsg = 'Publication stoppée: token Facebook expiré. Renouvelle FACEBOOK_PAGE_ACCESS_TOKEN.';
        errors.push(stopMsg);
        Logger.log('publishFacebookQueueCore_: ' + stopMsg);
        break;
      }
    }
    if (q < queue.length - 1) {
      Utilities.sleep(2000);
    }
  }

  if (!useFbColumn && doneIds.length) {
    savePostedIdsToProps_(postedMap);
  }

  var summary =
    'Publié(s) : ' + doneIds.length + ' / ' + queue.length + (errors.length ? '. Erreurs : ' + errors.join(' | ') : '');
  if (errors.length) {
    for (var e = 0; e < errors.length; e++) {
      if (String(errors[e]).toLowerCase().indexOf('token') >= 0) {
        summary += '\n\n' + getFacebookTokenRenewHint_();
        break;
      }
    }
  }
  Logger.log('publishFacebookQueueCore_: ' + summary);
  if (showUi) {
    SpreadsheetApp.getUi().alert('Facebook', summary, SpreadsheetApp.getUi().ButtonSet.OK);
  }

  if (errors.length && typeof appendRapportLog_ === 'function') {
    appendRapportLog_('ERREUR_FACEBOOK', 'Échec partiel ou total', '', errors.join('\n'));
  }
}

/**
 * Publie sur le fil de la Page associée au jeton Page (POST …/me/feed).
 * N’utilise pas FACEBOOK_PAGE_ID dans l’URL : un mauvais ID provoquait l’erreur Meta
 * « The global id … is not allowed for this call ».
 */
function postToFacebookGraph_(token, ver, link, message) {
  var apiUrl = 'https://graph.facebook.com/' + ver + '/me/feed';
  Logger.log('postToFacebookGraph_: POST ' + ver + '/me/feed (Page = celle du jeton)');
  var res = UrlFetchApp.fetch(apiUrl, {
    method: 'post',
    payload: {
      link: link,
      message: message,
      access_token: token,
    },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  Logger.log('postToFacebookGraph_: HTTP ' + code + ' ' + text.substring(0, 400));
  if (code !== 200) {
    var authMeta = parseFacebookAuthError_(text);
    return {
      ok: false,
      error: 'HTTP ' + code + ' ' + text,
      authExpired: !!authMeta.authExpired,
    };
  }
  try {
    var json = JSON.parse(text);
    if (json.error) {
      return { ok: false, error: JSON.stringify(json.error) };
    }
    return { ok: true, postId: json.id || '' };
  } catch (e) {
    return { ok: false, error: text };
  }
}

function parseFacebookAuthError_(text) {
  try {
    var json = JSON.parse(text);
    var err = json && json.error ? json.error : null;
    if (!err) return { authExpired: false };
    var code = parseInt(err.code, 10);
    var sub = parseInt(err.error_subcode, 10);
    // Meta token/session expired pattern: code 190, often subcode 463.
    if (code === 190 || sub === 463) {
      return { authExpired: true };
    }
  } catch (e) {
    // Ignore parse failures.
  }
  return { authExpired: false };
}

function checkFacebookToken_(token, ver) {
  var apiUrl = 'https://graph.facebook.com/' + ver + '/me?fields=id,name&access_token=' + encodeURIComponent(token);
  var res = UrlFetchApp.fetch(apiUrl, { method: 'get', muteHttpExceptions: true });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code === 200) {
    try {
      var obj = JSON.parse(text);
      return { ok: true, id: obj.id || '', name: obj.name || '' };
    } catch (e) {
      return { ok: true, id: '', name: '' };
    }
  }
  return { ok: false, error: 'HTTP ' + code + ' ' + text };
}

function getFacebookTokenRenewHint_() {
  return (
    'Action requise: régénère un nouveau Page Access Token (long-lived) puis mets à jour la propriété FACEBOOK_PAGE_ACCESS_TOKEN.\n' +
    'Étapes rapides: Meta Graph API Explorer -> générer User Token (pages_manage_posts, pages_read_engagement) -> échanger en long-lived -> récupérer le Page Token -> coller dans Script Properties.'
  );
}

function getFacebookPublishHour_() {
  var raw = PropertiesService.getScriptProperties().getProperty('FACEBOOK_PUBLISH_HOUR');
  if (raw) {
    var h = parseInt(raw, 10);
    if (!isNaN(h) && h >= 0 && h <= 23) {
      return h;
    }
  }
  return FB_DEFAULT_HOUR;
}

function removeFacebookPublishTriggersCore_() {
  var triggers = ScriptApp.getProjectTriggers();
  var n = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === FB_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
      n++;
    }
  }
  return n;
}

function installFacebookPublishTrigger() {
  removeFacebookPublishTriggersCore_();
  var hour = getFacebookPublishHour_();
  ScriptApp.newTrigger(FB_TRIGGER_HANDLER)
    .timeBased()
    .atHour(hour)
    .everyDays(1)
    .create();
  Logger.log('installFacebookPublishTrigger: hour ' + hour);
  var maxP = FB_DEFAULT_MAX;
  try {
    maxP = getFacebookProps_().maxPosts;
  } catch (e) {
    /* ignore */
  }
  SpreadsheetApp.getUi().alert(
    'Facebook',
    'Chaque jour à ' +
      hour +
      ':00 (fuseau du projet), le script tourne 1 fois et peut publier jusqu’à ' +
      maxP +
      ' article(s) sur la Page (file : published rempli + fb_posted vide). ' +
      'Pour fixer la limite à 3 : FACEBOOK_MAX_POSTS_PER_RUN = 3 (défaut si absent).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function removeFacebookPublishTrigger() {
  var n = removeFacebookPublishTriggersCore_();
  SpreadsheetApp.getUi().alert(
    'Facebook',
    n > 0 ? n + ' déclencheur(s) supprimé(s).' : 'Aucun déclencheur Facebook.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
