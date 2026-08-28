/**
 * WAAPPLY Lead Form — Google Apps Script backend.
 * Receives JSON POST from the website, validates, sanitizes,
 * and appends a row to the configured Google Sheet.
 *
 * CONFIG: set SPREADSHEET_ID below before deploying.
 */

var CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',
  SHEET_NAME: 'Leads'
};

/**
 * Handle POST requests from the WAAPPLY website.
 * Expected JSON body:
 * {
 *   "name": "...",
 *   "whatsapp": "...",
 *   "package": "info|3months|6months",
 *   "packagePrice": "...",
 *   "sector": "...",
 *   "source": "waapply.com",
 *   "page": "...",
 *   "timestamp": "..."
 * }
 */
function doPost(e) {
  try {
    var data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse(false, 'No data received');
    }

    // Validate required fields
    var name     = sanitize(data.name || '');
    var whatsapp = sanitize(data.whatsapp || '');
    var pack     = sanitize(data.package || '');

    if (!name)     return jsonResponse(false, 'Name is required');
    if (!whatsapp) return jsonResponse(false, 'WhatsApp is required');
    if (!pack)     return jsonResponse(false, 'Package is required');

    var price  = sanitize(data.packagePrice || '');
    var sector = sanitize(data.sector || '');
    var source = sanitize(data.source || 'waapply.com');
    var page   = sanitize(data.page || '');

    // Get or create spreadsheet
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    }

    // Create header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Date', 'Nom', 'WhatsApp', 'Pack', 'Prix', 'Secteur', 'Source', 'Page', 'Statut'
      ]);
    }

    // Format timestamp in Paris timezone
    var timestamp;
    try {
      timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    } catch (ex) {
      timestamp = new Date().toISOString();
    }

    // Append lead row
    sheet.appendRow([
      timestamp,
      name,
      whatsapp,
      pack,
      price,
      sector,
      source,
      page,
      'Nouveau'
    ]);

    return jsonResponse(true, 'Lead saved');

  } catch (err) {
    return jsonResponse(false, 'Server error: ' + err.message);
  }
}

/**
 * Sanitize a string value:
 * - Trim whitespace
 * - Protect against formula injection (= + - @ prefix)
 */
function sanitize(value) {
  if (typeof value !== 'string') return '';
  value = value.trim();
  if (value.length === 0) return '';

  var firstChar = value.charAt(0);
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
    value = "'" + value;
  }

  // Limit length to prevent abuse
  if (value.length > 500) {
    value = value.substring(0, 500);
  }

  return value;
}

/**
 * Return a JSON response with proper Content-Type header.
 */
function jsonResponse(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: success, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
