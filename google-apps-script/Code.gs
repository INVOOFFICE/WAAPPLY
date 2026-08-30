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

/* The 31 target countries: ISO code -> full Arabic display name.
   The frontend always transmits the ISO code (`country: "DE"`); the backend
   validates it and writes the full name under 'Pays' so the sheet stays readable. */
var COUNTRY_NAMES = {
  DE:'ألمانيا', FR:'فرنسا', NL:'هولندا', BE:'بلجيكا', SE:'السويد',
  AT:'النمسا', CH:'سويسرا', CZ:'التشيك', ES:'إسبانيا', PL:'بولندا',
  FI:'فنلندا', NO:'النرويج', BG:'بلغاريا', SK:'سلوفاكيا', EE:'إستونيا',
  HR:'كرواتيا', IT:'إيطاليا', IE:'أيرلندا', IS:'آيسلندا', HU:'المجر',
  EL:'اليونان', CY:'قبرص', DK:'الدنمارك', LV:'لاتفيا', MT:'مالطا',
  LI:'ليختنشتاين', LT:'ليتوانيا', LU:'لوكسمبورغ', SI:'سلوفينيا',
  RO:'رومانيا', PT:'البرتغال'
};
var ALLOWED_COUNTRIES = Object.keys(COUNTRY_NAMES);

/**
 * Handle POST requests from the WAAPPLY website.
 * Expected JSON body:
 * {
 *   "name": "...",
 *   "whatsapp": "...",
 *   "package": "info|3months|6months",
 *   "packagePrice": "...",
 *   "country": "DE|FR|NL|...",  (ISO code sent by the frontend; stored as the full Arabic name)
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

    var price    = sanitize(data.packagePrice || '');
    var countryCode = sanitize(data.country || '');
    var source = sanitize(data.source || 'waapply.com');
    var page   = sanitize(data.page || '');

    // Country is optional, but a provided one must be a known ISO code.
    if (countryCode && ALLOWED_COUNTRIES.indexOf(countryCode) === -1) {
      return jsonResponse(false, 'Invalid country code');
    }

    // Store the full Arabic country name under 'Pays'; the ISO code stays internal.
    var country = countryCode ? COUNTRY_NAMES[countryCode] : '';

    // Get or create spreadsheet
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    }

    // One-time migration: rename a legacy 'Secteur' header (column 6) to 'Pays'
    // so the existing sheet keeps a single sixth column. Historical rows are left untouched.
    if (sheet.getLastRow() > 0) {
      var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (headerRow && headerRow.length >= 6 && headerRow[5] === 'Secteur') {
        sheet.getRange(1, 6).setValue('Pays');
      }
    }

    // Create header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Date', 'Nom', 'WhatsApp', 'Pack', 'Prix', 'Pays', 'Source', 'Page', 'Statut'
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
      country,
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
