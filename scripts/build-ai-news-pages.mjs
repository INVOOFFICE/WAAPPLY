/**
 * Generates static SEO pages for AI news articles:
 * - ai-news/articles/<slug>/index.html
 * - ai-news/sitemap.xml
 *
 * Usage: node scripts/build-ai-news-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const NEWS_JSON = path.join(ROOT, "news.json");
const ARTICLE_TEMPLATE = path.join(ROOT, "article.html");
const OUT_DIR = path.join(ROOT, "articles");
const SITEMAP_OUT = path.join(ROOT, "sitemap.xml");
const FEED_OUT = path.join(ROOT, "feed.xml");

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(s) {
  return String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function clampChars(s, max) {
  const t = stripHtml(s);
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, "") + "…";
}

function slugify(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "article";
}

function safeDateIso(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function prettyDate(d) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function canonicalBase(site) {
  const c = (site?.canonicalOrigin || "").trim();
  return c ? c.replace(/\/+$/, "") : "";
}

function articlePagePath(slug) {
  return `ai-news/articles/${encodeURIComponent(slug)}/`;
}

function articleCanonicalUrl(site, slug) {
  const base = canonicalBase(site);
  if (!base) return "";
  return `${base}/${articlePagePath(slug)}`;
}

function buildKeywords(article) {
  const kw = [];
  if (article.category) kw.push(article.category);
  const k = String(article.keywords || "").split(",").map((s) => s.trim()).filter(Boolean);
  k.forEach((t) => kw.push(t));
  const dedup = Array.from(new Set(kw.map((x) => x.toLowerCase()))).slice(0, 12);
  return dedup.map((x) => x).join(", ");
}

function relatedArticles(all, article) {
  const seed = (String(article.keywords || "") + "," + String(article.category || "")).toLowerCase();
  const tokens = seed
    .split(/[, ]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 10);
  const scored = all
    .filter((a) => a && a.slug && a.slug !== article.slug)
    .map((a) => {
      const hay = (String(a.title || "") + " " + String(a.keywords || "") + " " + String(a.summary || "")).toLowerCase();
      let score = 0;
      tokens.forEach((t) => {
        if (hay.includes(t)) score += 1;
      });
      const t = new Date(a.publishedAt || 0).getTime() || 0;
      return { a, score, t };
    })
    .sort((x, y) => (y.score !== x.score ? y.score - x.score : y.t - x.t))
    .filter((x) => x.score > 0)
    .slice(0, 3)
    .map((x) => x.a);
  return scored;
}

function buildJsonLd(site, article, canonicalUrl, ogImage) {
  const base = canonicalBase(site);
  const siteName = site?.name || "AI News";
  const orgId = base ? `${base}/#organization` : "#organization";
  const webId = base ? `${base}/ai-news/#website` : "#website";
  const pubIso = (article.publishedAt && String(article.publishedAt)) || "";
  const pubDate = pubIso ? String(pubIso).slice(0, 10) : "2026-01-01";
  const desc = clampChars(article.metaDescription || article.description || article.summary || "", 160);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: siteName,
        url: base ? `${base}/ai-news/` : undefined,
      },
      {
        "@type": "WebSite",
        "@id": webId,
        url: base ? `${base}/ai-news/` : undefined,
        name: siteName,
        inLanguage: "en",
        publisher: { "@id": orgId },
      },
      {
        "@type": "BreadcrumbList",
        "@id": canonicalUrl + "#breadcrumb",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "AI News", item: base ? `${base}/ai-news/` : "" },
          { "@type": "ListItem", position: 2, name: article.title || "Article", item: canonicalUrl },
        ],
      },
      {
        "@type": "NewsArticle",
        "@id": canonicalUrl + "#article",
        mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
        headline: article.title || "",
        description: desc,
        image: ogImage ? [ogImage] : undefined,
        datePublished: pubDate,
        dateModified: pubDate,
        inLanguage: "en",
        author: {
          "@type": "Organization",
          name: siteName,
          "@id": orgId,
        },
        publisher: { "@id": orgId },
        keywords: buildKeywords(article) || undefined,
        isAccessibleForFree: true,
        articleSection: article.category || "AI",
      },
    ],
  };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function deleteStaleFolders(outDir, keepSlugs) {
  let removed = 0;
  if (!fs.existsSync(outDir)) return;
  const entries = fs.readdirSync(outDir, { withFileTypes: true });
  entries.forEach((e) => {
    if (!e.isDirectory()) return;
    const slug = e.name;
    if (keepSlugs.has(slug)) return;
    fs.rmSync(path.join(outDir, slug), { recursive: true, force: true });
    removed += 1;
  });
  return removed;
}

function buildBullets(article) {
  const bullets = (article.bullets || []).map((b) => String(b || "").trim()).filter(Boolean).slice(0, 6);
  if (!bullets.length) {
    const sum = String(article.summary || article.description || "").split(/[.?!]\s+/).map((s) => s.trim()).filter(Boolean);
    sum.slice(0, 4).forEach((s) => bullets.push(clampChars(s, 120)));
  }
  return bullets.slice(0, 6);
}

function buildRelatedHtml(site, rel) {
  const base = canonicalBase(site);
  const defaultOg = site.defaultOgImage || "";
  return rel
    .map((a) => {
      const url = base ? articleCanonicalUrl(site, a.slug) : `../${encodeURIComponent(a.slug)}/`;
      const title = a.title || "";
      const thumb = (a.image && String(a.image).trim()) || defaultOg;
      const date = prettyDate(a.publishedAt);
      return (
        '<a class="related__item" role="listitem" href="' +
        escapeHtml(url) +
        '">' +
        '<img class="related__thumb" src="' +
        escapeHtml(thumb) +
        '" alt="' +
        escapeHtml(title) +
        '" loading="lazy" />' +
        '<div class="related__info">' +
        '<strong class="related__title">' +
        escapeHtml(title) +
        "</strong>" +
        '<span class="related__date">' +
        escapeHtml(date) +
        "</span>" +
        "</div></a>"
      );
    })
    .join("");
}

function buildRssFeed(site, articles) {
  const base = canonicalBase(site);
  const title = site.name || "waapply";
  const description = "Latest Artificial Intelligence news and editorial summaries.";
  const channelLink = base ? `${base}/ai-news/` : "";
  const items = (articles || [])
    .map((a) => {
      const link = base ? articleCanonicalUrl(site, a.slug) : "";
      const desc = clampChars(a.metaDescription || a.summary || a.description || "", 400);
      const pubDate = new Date(a.publishedAt || Date.now()).toUTCString();
      const enclosure = a.image
        ? `<enclosure url="${escapeHtml(String(a.image))}" type="image/jpeg" length="0" />`
        : "";
      return `<item>
  <title>${escapeHtml(a.seoTitle || a.title || "")}</title>
  <link>${escapeHtml(link)}</link>
  <description>${escapeHtml(desc)}</description>
  <pubDate>${escapeHtml(pubDate)}</pubDate>
  <category>${escapeHtml(a.category || "AI")}</category>
  <guid isPermaLink="true">${escapeHtml(link)}</guid>
  ${enclosure}
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${escapeHtml(title)}</title>
  <link>${escapeHtml(channelLink)}</link>
  <description>${escapeHtml(description)}</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${escapeHtml(base ? `${base}/ai-news/feed.xml` : "feed.xml")}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`;
}

function buildSitemap(site, articles) {
  const base = canonicalBase(site);
  if (!base) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
  }

  const urls = [];
  urls.push({ loc: `${base}/ai-news/`, lastmod: new Date().toISOString().slice(0, 10) });
  articles.forEach((a) => {
    if (!a.slug) return;
    const loc = articleCanonicalUrl(site, a.slug);
    const lastmod = (a.publishedAt && String(a.publishedAt).slice(0, 10)) || new Date().toISOString().slice(0, 10);
    urls.push({ loc, lastmod });
  });

  const body = urls
    .map((u) => {
      return `  <url>\n    <loc>${escapeHtml(u.loc)}</loc>\n    <lastmod>${escapeHtml(u.lastmod)}</lastmod>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function main() {
  if (!fs.existsSync(NEWS_JSON)) {
    throw new Error("Missing news.json");
  }
  const data = readJson(NEWS_JSON);
  const site = data.site || {};
  const articles = Array.isArray(data.articles) ? data.articles : [];
  const template = fs.readFileSync(ARTICLE_TEMPLATE, "utf8");

  const normalized = articles
    .map((a) => {
      const title = String(a.title || "").trim();
      const slug = String(a.slug || "").trim() || slugify(title);
      return {
        ...a,
        title,
        slug,
        category: (a.category && String(a.category).trim()) || "AI",
      };
    })
    .filter((a) => a.title && a.slug);

  normalized.sort((a, b) => {
    const ta = new Date(a.publishedAt || 0).getTime() || 0;
    const tb = new Date(b.publishedAt || 0).getTime() || 0;
    if (tb !== ta) return tb - ta;
    return String(a.title).localeCompare(String(b.title));
  });

  if (process.argv.includes("--dry-run")) {
    console.log(`DRY RUN: would generate ${normalized.length} pages`);
    process.exit(0);
  }

  ensureDir(OUT_DIR);
  const keep = new Set(normalized.map((a) => a.slug));
  const cleanedCount = deleteStaleFolders(OUT_DIR, keep) || 0;

  const base = canonicalBase(site);
  const siteName = site.name || "AI News";
  const defaultOg = site.defaultOgImage || "";

  normalized.forEach((a) => {
    const canon = articleCanonicalUrl(site, a.slug);
    const ogImage = (a.image && String(a.image).trim()) || defaultOg;
    const desc = clampChars(a.metaDescription || a.description || a.summary || "", 160);
    const dek = clampChars(a.dek || a.summary || a.description || desc, 180);
    const intro = clampChars(a.intro || a.summary || a.description || "", 180);
    const summary = clampChars(a.summary || a.description || "", 220);
    const why = clampChars(a.whyItMatters || a.impact || a.summary || "", 260);
    const keywords = buildKeywords(a);
    const imageAlt = clampChars(a.imageAlt || a.title || "AI news image", 120);

    const bullets = buildBullets(a)
      .map((b) => "<li>" + escapeHtml(clampChars(b, 140)) + "</li>")
      .join("");

    const rel = relatedArticles(normalized, a);
    const relHtml = buildRelatedHtml(site, rel);

    const jsonLd = buildJsonLd(site, a, canon, ogImage);
    const out = template
      .replaceAll("{{SITE_NAME}}", escapeHtml(siteName))
      .replaceAll("{{TITLE}}", escapeHtml(a.seoTitle || a.title))
      .replaceAll("{{META_DESCRIPTION}}", escapeHtml(desc))
      .replaceAll("{{CANONICAL_URL}}", escapeHtml(canon || ""))
      .replaceAll("{{OG_IMAGE}}", escapeHtml(ogImage))
      .replaceAll("{{CATEGORY}}", escapeHtml(a.category))
      .replaceAll("{{SOURCE}}", escapeHtml((a.source && a.source.name) || a.source || ""))
      .replaceAll("{{PUBLISHED_ISO}}", escapeHtml(safeDateIso(a.publishedAt) || ""))
      .replaceAll("{{PUBLISHED_PRETTY}}", escapeHtml(prettyDate(a.publishedAt) || ""))
      .replaceAll("{{DEK}}", escapeHtml(dek))
      .replaceAll("{{IMAGE_URL}}", escapeHtml(ogImage))
      .replaceAll("{{IMAGE_ALT}}", escapeHtml(imageAlt))
      .replaceAll("{{INTRO}}", escapeHtml(intro))
      .replaceAll("{{SUMMARY}}", escapeHtml(summary))
      .replaceAll("{{BULLETS}}", bullets)
      .replaceAll("{{WHY_IT_MATTERS}}", escapeHtml(why))
      .replaceAll("{{SOURCE_URL}}", escapeHtml(String(a.url || a.sourceUrl || "").trim()))
      .replaceAll("{{KEYWORDS}}", escapeHtml(keywords))
      .replaceAll("{{RELATED}}", relHtml)
      .replace("{{JSON_LD}}", JSON.stringify(jsonLd));

    const outPath = path.join(OUT_DIR, a.slug, "index.html");
    writeFile(outPath, out);
  });

  const sitemap = buildSitemap(site, normalized);
  writeFile(SITEMAP_OUT, sitemap);
  const feed = buildRssFeed(site, normalized);
  writeFile(FEED_OUT, feed);

  // Ensure robots.txt sitemap points to sitemap.xml (relative is fine).
  const robotsPath = path.join(ROOT, "robots.txt");
  if (!fs.existsSync(robotsPath)) {
    writeFile(robotsPath, "User-agent: *\nAllow: /\n\nSitemap: sitemap.xml\n");
  }

  // Optional: keep a clean exported dataset (normalized slugs).
  if (base) {
    const outJson = {
      site: { ...site, canonicalOrigin: base },
      articles: normalized.map((a) => ({ ...a, slug: a.slug })),
    };
    writeFile(NEWS_JSON, JSON.stringify(outJson, null, 2) + "\n");
  }

  console.log(`✓ Built: ${normalized.length} article pages`);
  console.log(`✓ Sitemap: ${normalized.length + (base ? 1 : 0)} URLs`);
  console.log(`✓ RSS feed: ${normalized.length} items`);
  console.log(`✓ Cleaned: ${cleanedCount} stale folders`);
}

main();

