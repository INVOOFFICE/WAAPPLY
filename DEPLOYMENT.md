# Deployment guide — waapply (Artificial Intelligence News)

## 1) Add API keys (Apps Script properties)

In Apps Script: **Project Settings → Script properties**

- `AI_NEWS_NEWSAPI_KEY`
- `AI_NEWS_NEWSDATA_KEY`
- `AI_NEWS_CURRENTS_KEY`

GitHub export:
- `GITHUB_TOKEN` (PAT with Contents read/write)
- `GITHUB_REPO` (format `owner/repo`)

Canonical:
- `AI_NEWS_SITE_ORIGIN` (example: `https://akkous.com`)

## 2) Install Apps Script

- Open your Google Sheet → Extensions → Apps Script
- Paste `ai-news/ai-news-blog/code.gs`
- Save
- Run `aiNews_testFetch()` once to grant permissions

## 3) Run the pipeline

From the spreadsheet menu **🧠 waapply**:
- **④ Run full pipeline now**

This will:
- fetch news from providers
- upsert into `AiNews` sheet
- export `ai-news/news.json` and `ai-news/sitemap.xml` to GitHub

## 4) Enable automation (hourly)

Menu **🧠 waapply**:
- **⑤ Install triggers (hourly)**

## 5) Static SEO pages

On GitHub, workflow `.github/workflows/build-static-ai-news.yml` will auto-run when `ai-news/news.json` changes:
- generates `ai-news/articles/<slug>/index.html`
- updates `ai-news/sitemap.xml`

Local build (optional):

```bash
node ai-news/scripts/build-ai-news-pages.mjs
```

## 6) Where to put AdSense / affiliate blocks

- Global AdSense loader is already included in `ai-news/index.html` and `ai-news/article.html`.
- The article page includes an ad placeholder: search `<!-- Ad slot placeholder -->` in `ai-news/article.html`.
- Affiliate blocks: add a new section in `ai-news/article.html` near “Why it matters” or “Original source”.

