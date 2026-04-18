# Apps Script — AI News Blog (`code.gs`)

This folder contains a **Google Apps Script** system to automate an AI news blog:

**Fetch (hourly) → deduplicate → write to Google Sheets → SEO enrich → export `ai-news/news.json` + `ai-news/sitemap.xml` → push to GitHub Pages**

Free news APIs supported:
- NewsAPI (`https://newsapi.org/`)
- NewsData (`https://newsdata.io/`)
- Currents API (`https://currentsapi.services/`)

---

## Installation (Google Sheets)

1. Create (or open) a Google Sheet.
2. Extensions → Apps Script.
3. Create a new file named `code.gs`, paste the content of `google-apps-script/ai-news-blog/code.gs`.
4. Save.
5. Run `aiNews_testFetch()` once → accept permissions.
6. In the sheet, refresh (F5) → menu **🧠 AI News** appears.

---

## Script Properties (API keys)

In Apps Script: Project Settings → Script properties

| Key | Description |
|---|---|
| `AI_NEWS_NEWSAPI_KEY` | NewsAPI key |
| `AI_NEWS_NEWSDATA_KEY` | NewsData key |
| `AI_NEWS_CURRENTS_KEY` | Currents API key |
| `GITHUB_TOKEN` | GitHub PAT (Contents read/write) |
| `GITHUB_REPO` | `owner/repo` |

Optional:
| Key | Description |
|---|---|
| `AI_NEWS_SITE_ORIGIN` | Canonical origin, e.g. `https://akkous.com` |

---

## Sheet schema

The script auto-creates a sheet named `AiNews` with these columns:

`ID`, `Title`, `Source`, `Category`, `Image URL`, `URL`, `Published At`, `Description`, `Summary`, `SEO Title`, `Meta Description`, `Keywords`, `Slug`, `Status`, `Added At`

`Status` is `PUBLISHED` (news items are instantly publishable).

---

## Automation

Menu → **Install triggers** creates:
- Hourly trigger to run the pipeline (fetch → export → push)

---

## Exported files

| Path | Purpose |
|---|---|
| `ai-news/news.json` | Frontend data source |
| `ai-news/sitemap.xml` | AI blog sitemap |

GitHub Actions then generates:
- `ai-news/articles/<slug>/index.html`

