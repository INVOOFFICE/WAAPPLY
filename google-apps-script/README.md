# WAAPPLY — Google Apps Script Lead Form Backend

This Google Apps Script receives lead form submissions from the WAAPPLY website and saves them into a Google Sheet.

## Setup Steps

### 1. Create a Google Sheet

- Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
- Give it a name like **WAAPPLY Leads**.
- You can leave it empty — the script will create the header row automatically on the first submission.

### 2. Copy the Spreadsheet ID

From the URL of your new sheet:

```
https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
```

Copy the part between `/d/` and `/edit`. This is your **Spreadsheet ID**.

### 3. Open Apps Script

- In your Google Sheet, go to **Extensions → Apps Script**.
- Delete any default code in the editor.

### 4. Paste Code.gs

- Copy the entire contents of `Code.gs` (from this folder) into the Apps Script editor.
- Click **Save** (disk icon).

### 5. Set the Spreadsheet ID

In the editor, find this line near the top:

```js
SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',
```

Replace `YOUR_SPREADSHEET_ID` with the ID you copied in step 2. For example:

```js
SPREADSHEET_ID: '1AbCdEfGhIjKlMnOpQrStUvWxYz123456789',
```

### 6. Deploy as Web App

- Click **Deploy → New deployment**.
- Select type: **Web app**.
- Description: `WAAPPLY Lead Form`.
- Execute as: **Me**.
- Who has access: **Anyone** (required for the website to send POST requests).
- Click **Deploy**.
- Authorize the script when prompted (it needs access to your Google Sheets).
- Copy the **Web App URL** provided after deployment.

### 7. Update the Frontend

Open `js/contact-modal.js` in the WAAPPLY project and find this line:

```js
var CONTACT_API_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';
```

Replace `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL` with the URL you copied in step 6. For example:

```js
var CONTACT_API_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
```

### 8. Test the Form

1. Open the WAAPPLY website.
2. Click any CTA button to open the contact modal.
3. Fill in a name, phone number, and select a package.
4. Click **أكد الطلب**.
5. You should see the success message.
6. Check your Google Sheet — a new row should appear.

### 9. Verify the Lead

The Google Sheet should have these columns:

| Date | Nom | WhatsApp | Pack | Prix | Secteur | Source | Page | Statut |
|------|-----|----------|------|------|---------|--------|------|--------|

Each form submission adds one row with:
- **Date** — timestamp (Paris timezone)
- **Nom** — user's name
- **WhatsApp** — formatted phone number with country code
- **Pack** — `info`, `3months`, or `6months`
- **Prix** — price text or empty for info requests
- **Secteur** — the sector the user picked on « خدماتنا حسب القطاع » (empty for generic CTAs)
- **Source** — always `waapply.com`
- **Page** — the page path and hash where the form was submitted
- **Statut** — always `Nouveau` (new lead)

## Configuration Values to Replace

| Placeholder | Where | What |
|-------------|-------|------|
| `YOUR_SPREADSHEET_ID` | `Code.gs` line 7 | Your Google Sheet ID |
| `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL` | `js/contact-modal.js` line 6 | The deployed Web App URL |

## Security Notes

- The Google Sheet ID is **not** exposed to the frontend — it stays in the Apps Script.
- No API keys or passwords are sent from the website.
- The Apps Script validates and sanitizes all input before writing.
- Values starting with `=`, `+`, `-`, or `@` are prefixed with an apostrophe to prevent formula injection.
- Phone numbers are not logged beyond the spreadsheet row.

## Updating the Deployment

If you change the code in Apps Script:
1. Click **Deploy → Manage deployments**.
2. Click the edit (pencil) icon.
3. Select **New version**.
4. Click **Deploy**.

The Web App URL stays the same.
