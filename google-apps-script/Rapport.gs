/**
 * WaApply — Feuille « Rapport » : journal des actions (saisie IA, sync GitHub, publications planifiées).
 *
 * Crée l’onglet s’il n’existe pas. Ne dépend pas des autres .gs (sauf Apps Script standard).
 * Appelé depuis BlogSyncToGitHub.gs et IATrendsFetcher.gs.
 */

var RAPPORT_SHEET_NAME = 'Rapport';

/** En-têtes ligne 1 (filtres / tableau croisé possibles sur « Jour » et « Type »). */
var RAPPORT_HEADERS = ['Horodatage', 'Jour', 'Type', 'Résumé', 'IDs', 'Détail'];

/** Types stables pour filtres (colonne Type). */
var RAPPORT_TYPE = {
  SAISIE_IA: 'SAISIE_IA_TRENDS',
  PUBLICATION_BATCH: 'PUBLICATION_PLANIFIEE',
  SYNC_MANUEL: 'SYNC_GITHUB_MANUEL',
  ERREUR_IA: 'ERREUR_IA_TRENDS',
  ERREUR_PUBLICATION: 'ERREUR_PUBLICATION',
  ERREUR_SYNC: 'ERREUR_SYNC_GITHUB',
};

/**
 * Retourne la feuille Rapport (création + en-têtes si besoin).
 */
function getRapportSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RAPPORT_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(RAPPORT_SHEET_NAME);
  }
  ensureRapportHeaders_(sh);
  return sh;
}

function ensureRapportHeaders_(sheet) {
  var width = RAPPORT_HEADERS.length;
  var first = sheet.getRange(1, 1, 1, width).getValues()[0];
  var allEmpty = true;
  for (var i = 0; i < first.length; i++) {
    if (String(first[i] || '').trim() !== '') {
      allEmpty = false;
      break;
    }
  }
  if (allEmpty) {
    sheet.getRange(1, 1, 1, width).setValues([RAPPORT_HEADERS]);
    sheet.setFrozenRows(1);
  }
}

/**
 * Ajoute une ligne de journal. Ne lève pas d’exception vers l’appelant (log uniquement).
 *
 * @param {string} type - ex. RAPPORT_TYPE.PUBLICATION_BATCH
 * @param {string} resume - texte court lisible
 * @param {string|string[]} ids - liste d’ids séparés par virgule ou tableau
 * @param {string} detail - URL commit, message d’erreur, etc. (tronqué si très long)
 */
function appendRapportLog_(type, resume, ids, detail) {
  try {
    var sh = getRapportSheet_();
    var tz = Session.getScriptTimeZone();
    var now = new Date();
    var ts = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
    var jour = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    var idsStr = '';
    if (ids == null || ids === undefined) {
      idsStr = '';
    } else if (Object.prototype.toString.call(ids) === '[object Array]') {
      idsStr = ids.join(', ');
    } else {
      idsStr = String(ids);
    }
    if (idsStr.length > 8000) {
      idsStr = idsStr.substring(0, 7997) + '…';
    }
    var det = detail == null || detail === undefined ? '' : String(detail);
    if (det.length > 5000) {
      det = det.substring(0, 4997) + '…';
    }
    sh.appendRow([ts, jour, type, String(resume || ''), idsStr, det]);
  } catch (e) {
    Logger.log('appendRapportLog_ ERROR: ' + e);
  }
}

/** Menu / test : active l’onglet Rapport. */
function openRapportSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getRapportSheet_();
  ss.setActiveSheet(sh);
  try {
    ss.toast('Feuille « ' + RAPPORT_SHEET_NAME + ' » ouverte.', 'Rapport', 3);
  } catch (e) {
    Logger.log('openRapportSheet toast: ' + e);
  }
}
