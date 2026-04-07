/**
 * Newsletter API proxy (Google Apps Script -> Beehiiv)
 *
 * Required Script Properties:
 * - BEEHIIV_API_KEY
 * - BEEHIIV_PUBLICATION_ID   (example: pub_xxxxxxxxxxxxxxxxx)
 */

var NEWSLETTER_SOURCE_DEFAULT = 'waapply-site';

function doPost(e) {
  try {
    var payload = parseNewsletterPayload_(e);
    var email = String(payload.email || '').trim().toLowerCase();
    var source = String(payload.source || NEWSLETTER_SOURCE_DEFAULT).trim();

    if (!isValidEmail_(email)) {
      return jsonOut_({
        ok: false,
        error: 'Invalid email format.',
      });
    }

    var result = subscribeEmailToBeehiiv_(email, source);
    return jsonOut_(result);
  } catch (err) {
    return jsonOut_({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

function parseNewsletterPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body.');
  }
  var raw = String(e.postData.contents || '').trim();
  if (!raw) {
    throw new Error('Empty request body.');
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Body must be valid JSON.');
  }
}

function subscribeEmailToBeehiiv_(email, source) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty('BEEHIIV_API_KEY') || '').trim();
  var publicationId = String(props.getProperty('BEEHIIV_PUBLICATION_ID') || '').trim();
  if (!apiKey) throw new Error('Missing Script Property: BEEHIIV_API_KEY');
  if (!publicationId) throw new Error('Missing Script Property: BEEHIIV_PUBLICATION_ID');

  var url = 'https://api.beehiiv.com/v2/publications/' + encodeURIComponent(publicationId) + '/subscriptions';
  var body = {
    email: email,
    reactivate_existing: true,
    send_welcome_email: true,
    utm_source: source,
  };

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer ' + apiKey,
    },
    muteHttpExceptions: true,
  });

  var code = resp.getResponseCode();
  var txt = String(resp.getContentText() || '');
  var data = {};
  try {
    data = txt ? JSON.parse(txt) : {};
  } catch (_) {}

  // 2xx = success, 409-like cases can still be "already subscribed"
  if (code >= 200 && code < 300) {
    return {
      ok: true,
      status: code,
      message: 'Subscription confirmed.',
    };
  }

  // Handle "already exists" gracefully when Beehiiv returns a conflict-style response
  var errText = String((data && data.message) || txt || 'Subscription failed.');
  if (code === 409 || /already/i.test(errText)) {
    return {
      ok: true,
      status: code,
      message: 'Email already subscribed.',
    };
  }

  throw new Error('Beehiiv API error (' + code + '): ' + errText);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Manual test from Apps Script editor.
 * Requires BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID properties.
 */
function testNewsletterSubscribe_() {
  var testEmail = 'test+' + new Date().getTime() + '@example.com';
  var result = subscribeEmailToBeehiiv_(testEmail, 'gas-test');
  Logger.log(result);
}
