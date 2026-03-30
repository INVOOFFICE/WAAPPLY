/**
 * Reads data/blog-posts.json and injects grid, articles, JSON-LD, SEO meta, and sitemap.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data', 'blog-posts.json');
const indexPath = join(root, 'index.html');
const sitemapPath = join(root, 'sitemap.xml');
const blogDir = join(root, 'blog');

/** Google AdSense publisher ID (script + ads.txt). */
const ADSENSE_CLIENT = 'ca-pub-2269008589730162';

const CSP_HEAD =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google; frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; worker-src 'self'; manifest-src 'self'; base-uri 'self'; object-src 'none'\">";

const ADSENSE_SCRIPT_SNIPPET = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;

/** Primary brand mark (PNG) — used in nav, OG image, JSON-LD, favicon on article pages. */
const SITE_LOGO_PATH = 'icon512x512.png';

const DEFAULT_SITE_DESCRIPTION =
  'Learn to make money online with AI tools, freelance prompts, and side-income guides—clear, beginner-friendly advice on freelancing and honest online work.';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function truncateMeta(s, max = 158) {
  const t = String(s).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Prefer short_description (Sheets/JSON), then excerpt, for meta + schema summaries. */
function postSummarySource(post) {
  const s = (k) => (post[k] != null && String(post[k]).trim()) || '';
  return s('short_description') || s('shortDescription') || s('excerpt') || '';
}

function metaDescriptionForPost(post, siteDescription) {
  const src = postSummarySource(post);
  if (src) return truncateMeta(src);
  return truncateMeta(siteDescription);
}

function schemaDescriptionForPost(post, siteDescription) {
  const src = postSummarySource(post);
  if (src) return truncateMeta(src, 320);
  return truncateMeta(siteDescription, 320);
}

function formatDateDisplay(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function sortPosts(posts) {
  return [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function latestPostDate(posts) {
  if (!posts.length) return null;
  return posts.reduce((best, p) => {
    const d = String(p.date || '');
    return d > best ? d : best;
  }, String(posts[0].date || ''));
}

/** Safe filename segment; ids in JSON are already slug-safe. */
function blogFileBase(post) {
  const raw = String(post.id || '').trim();
  const s = raw.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s || 'article';
}

/** Root-relative path, e.g. /blog/my-slug.html */
function articlePathRoot(post) {
  return `/blog/${blogFileBase(post)}.html`;
}

function articleUrlAbsolute(siteBaseUrl, post) {
  const base = siteBaseUrl.replace(/\/$/, '');
  return `${base}${articlePathRoot(post)}`;
}

function shortenHeading(text, max = 58) {
  const h = String(text).trim().replace(/[.:;!?]+$/, '');
  if (h.length <= max) return h;
  const cut = h.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > 28 ? cut.slice(0, sp) : cut) + '…';
}

function splitIntoSentences(text) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+(?=[A-Z\u201C\u2018("'\u2014-])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function partitionSentences(sentences, numGroups) {
  const n = sentences.length;
  const g = Math.min(numGroups, n);
  if (g < 1) return [];
  const base = Math.floor(n / g);
  const extra = n % g;
  const out = [];
  let idx = 0;
  for (let i = 0; i < g; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(sentences.slice(idx, idx + size));
    idx += size;
  }
  return out;
}

function deriveSectionHeading(sentenceGroup, index, postTitle) {
  const first = sentenceGroup[0] || '';
  const colonIdx = first.indexOf(':');
  if (colonIdx >= 14 && colonIdx <= 78) {
    const cand = first.slice(0, colonIdx).trim();
    const words = cand.split(/\s+/).length;
    if (words >= 2 && cand.length >= 12) return shortenHeading(cand, 72);
  }
  let h = first.replace(/[.!?]+$/, '').trim();
  h = shortenHeading(h, 58);
  const pt = String(postTitle || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 50);
  const ht = h.toLowerCase();
  if (pt.length > 15 && ht.startsWith(pt.slice(0, 18))) {
    return index === 0 ? 'Overview' : `Key points (${index + 1})`;
  }
  return h || `Section ${index + 1}`;
}

function tryStructureStepArticle(text) {
  const pieces = text
    .split(/\b(?=Step \d+:\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (pieces.length < 3) return null;

  const out = [];
  const intro = pieces[0];
  if (intro) out.push(`<p>${escapeHtml(intro)}</p>`);
  out.push(`<h2 class="blog-body-heading">Step-by-step roadmap</h2>`);
  for (let i = 1; i < pieces.length; i++) {
    const piece = pieces[i];
    const m = /^(Step \d+):/i.exec(piece);
    if (m) {
      const after = piece.slice(m[0].length).trim();
      const firstSent =
        after.split(/(?<=[.!?])\s+(?=[A-Z\u201C\u2018("'])/)[0]?.trim() || after;
      const h3Line = shortenHeading(`${m[1]}: ${firstSent}`, 96);
      out.push(
        `<h3 class="blog-body-subheading">${escapeHtml(h3Line)}</h3>\n      <p>${escapeHtml(after)}</p>`
      );
    } else {
      out.push(`<p>${escapeHtml(piece)}</p>`);
    }
  }
  return out.join('\n      ');
}

function tryStructureToForSegments(text) {
  const parts = text.split(
    /(?:\.\s+|\?\s+|\!\s+|'\s+)(?=(?:To|For)\s+[^.]{3,95}:\s)/i
  );
  if (parts.length < 5) return null;

  const intro = parts[0].trim();
  const rest = parts.slice(1).map((p) => p.trim()).filter(Boolean);
  if (rest.length < 4) return null;

  let forN = 0;
  let toN = 0;
  for (const seg of rest) {
    if (/^For\s/i.test(seg)) forN += 1;
    else if (/^To\s/i.test(seg)) toN += 1;
  }
  const h2Title =
    forN > 0 && toN === 0 ? 'By role or specialty' : 'Prompts and examples by use case';

  const out = [];
  if (intro) out.push(`<p>${escapeHtml(intro)}</p>`);
  out.push(`<h2 class="blog-body-heading">${escapeHtml(h2Title)}</h2>`);
  for (const seg of rest) {
    const m = /^((?:To|For)\s+[^:]+):\s*(.*)$/is.exec(seg);
    if (m) {
      const h = shortenHeading(m[1].trim(), 78);
      const body = m[2].trim();
      out.push(
        `<h3 class="blog-body-subheading">${escapeHtml(h)}</h3>\n      <p>${escapeHtml(body)}</p>`
      );
    } else {
      out.push(`<p>${escapeHtml(seg)}</p>`);
    }
  }
  return out.join('\n      ');
}

function tryStructureColonSegments(text) {
  const parts = text.split(/\.\s+(?=[A-Z][^.\n]{4,100}:\s)/);
  if (parts.length < 4) return null;

  const intro = parts[0].trim();
  const rest = parts.slice(1).map((p) => p.trim()).filter(Boolean);
  if (rest.length < 3) return null;

  const maxH2 = Math.min(6, Math.max(4, rest.length));
  const use = rest.slice(0, maxH2);
  const overflow = rest.slice(maxH2);

  const sections = [];
  if (intro) sections.push({ type: 'p', html: escapeHtml(intro) });

  for (let i = 0; i < use.length; i++) {
    let seg = use[i];
    const colon = seg.indexOf(':');
    if (colon === -1) {
      const h = shortenHeading(seg.replace(/\.+$/, '').trim(), 58);
      sections.push({
        type: 'h2p',
        h: escapeHtml(h),
        p: escapeHtml(seg),
        rawBodyLen: seg.length,
      });
      continue;
    }
    const title = seg.slice(0, colon).trim();
    let body = seg.slice(colon + 1).trim();
    if (body.endsWith('.')) body = body.slice(0, -1).trim();
    sections.push({
      type: 'h2p',
      h: escapeHtml(shortenHeading(title, 72)),
      p: escapeHtml(body),
      rawBodyLen: body.length,
    });
  }

  if (overflow.length) {
    const merged = overflow
      .map((s) => {
        const c = s.indexOf(':');
        const chunk = (c === -1 ? s : s.slice(c + 1).trim() || s).trim();
        if (!chunk) return '';
        return /[.!?…'"»]$/.test(chunk) ? chunk : `${chunk}.`;
      })
      .filter(Boolean)
      .join(' ');
    const last = sections.filter((s) => s.type === 'h2p').pop();
    if (last) {
      last.p = `${last.p} ${escapeHtml(merged)}`.trim();
      last.rawBodyLen = (last.rawBodyLen || 0) + merged.length;
    } else {
      sections.push({
        type: 'h2p',
        h: 'More takeaways',
        p: escapeHtml(merged),
        rawBodyLen: merged.length,
      });
    }
  }

  const h2blocks = sections.filter((s) => s.type === 'h2p');
  const bad = h2blocks.some((s, i) => {
    const len = s.rawBodyLen || 0;
    const cap = i === h2blocks.length - 1 ? 2200 : 950;
    return len > cap;
  });
  if (bad) return null;

  return sections
    .map((s) =>
      s.type === 'p'
        ? `<p>${s.html}</p>`
        : `<h2 class="blog-body-heading">${s.h}</h2>\n      <p>${s.p}</p>`
    )
    .join('\n      ');
}

function structureBySentenceSections(normalized, postTitle) {
  const sentences = splitIntoSentences(normalized);
  if (sentences.length < 4) {
    return `<p>${escapeHtml(normalized)}</p>`;
  }

  let h2Count =
    sentences.length > 42
      ? Math.round(sentences.length / 4.5)
      : Math.round(sentences.length / 6);
  h2Count = Math.min(6, Math.max(4, h2Count));
  if (h2Count > sentences.length) h2Count = sentences.length;

  const groups = partitionSentences(sentences, h2Count);
  const parts = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (!g.length) continue;
    const heading = i === 0 ? 'Overview' : deriveSectionHeading(g, i, postTitle);
    const body = g.join(' ');
    parts.push(
      `<h2 class="blog-body-heading">${escapeHtml(heading)}</h2>\n      <p>${escapeHtml(body)}</p>`
    );
  }
  return parts.join('\n      ');
}

function structurePlainArticleBody(text, postTitle) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  if (/\bStep \d+:\s/i.test(normalized)) {
    const stepHtml = tryStructureStepArticle(normalized);
    if (stepHtml) return stepHtml;
  }

  if (/\b(?:To|For)\s+[^.]{3,80}:\s/i.test(normalized)) {
    const tfHtml = tryStructureToForSegments(normalized);
    if (tfHtml) return tfHtml;
  }

  const colonHtml = tryStructureColonSegments(normalized);
  if (colonHtml) return colonHtml;

  return structureBySentenceSections(normalized, postTitle);
}

function buildArticleBody(post) {
  if (post.bodyHtml && String(post.bodyHtml).trim()) {
    return post.bodyHtml.trim();
  }
  const paras = Array.isArray(post.paragraphs) ? post.paragraphs : [];
  const raw = paras.map((p) => String(p).trim()).filter(Boolean).join('\n\n');
  if (!raw) return '';
  return structurePlainArticleBody(raw, post.title);
}

function buildBlogGridHtml(posts, siteName, siteBaseUrl, siteDescription) {
  return posts
    .map((post, i) => {
      const display = post.dateDisplay || formatDateDisplay(post.date);
      const metaDesc = metaDescriptionForPost(post, siteDescription);
      const absUrl = escapeHtmlAttr(articleUrlAbsolute(siteBaseUrl, post));
      const docTitle = escapeHtmlAttr(`${post.title} | ${siteName}`);
      return `      <article class="blog-card reveal" itemscope itemtype="https://schema.org/BlogPosting" data-wa-meta-desc="${escapeHtmlAttr(metaDesc)}" data-wa-meta-title="${escapeHtmlAttr(post.title)}" data-wa-doc-title="${docTitle}" data-wa-article-url="${absUrl}" data-wa-article-id="${escapeHtmlAttr(post.id)}">
        <div class="blog-card-meta">
          <time class="blog-card-date" datetime="${escapeHtml(post.date)}" itemprop="datePublished">${escapeHtml(display)}</time>
          <span class="blog-card-tag">${escapeHtml(post.tag)}</span>
        </div>
        <h3 class="blog-card-title" itemprop="headline">${escapeHtml(post.title)}</h3>
        <p class="blog-card-excerpt" itemprop="description">${escapeHtml(post.excerpt)}</p>
        <a href="${escapeHtmlAttr(articlePathRoot(post))}" class="blog-card-link" itemprop="url" hreflang="en" title="Read: ${escapeHtmlAttr(post.title)}">Read guide <span aria-hidden="true">→</span></a>
      </article>`;
    })
    .join('\n\n');
}

function buildBlogArticlesHtml(posts, siteName, siteBaseUrl, siteDescription) {
  return posts
    .map((post, i) => {
      const display = post.dateDisplay || formatDateDisplay(post.date);
      const body = buildArticleBody(post);
      const postUrl = articleUrlAbsolute(siteBaseUrl, post);
      const modified = post.dateModified || post.date;
      const bodyId = 'article-body-' + escapeHtml(post.id);
      const pageHref = escapeHtmlAttr(articlePathRoot(post));
      const metaDesc = metaDescriptionForPost(post, siteDescription);
      const docTitle = escapeHtmlAttr(`${post.title} | ${siteName}`);
      return `  <article id="${escapeHtml(post.id)}" class="blog-article blog-article--expandable reveal" itemscope itemtype="https://schema.org/BlogPosting" data-wa-meta-desc="${escapeHtmlAttr(metaDesc)}" data-wa-meta-title="${escapeHtmlAttr(post.title)}" data-wa-doc-title="${docTitle}" data-wa-article-url="${escapeHtmlAttr(postUrl)}" data-wa-article-id="${escapeHtmlAttr(post.id)}">
    <div class="blog-article-meta">
      <time datetime="${escapeHtml(post.date)}" itemprop="datePublished">${escapeHtml(display)}</time>
      <span class="blog-card-tag">${escapeHtml(post.tag)}</span>
    </div>
    <h2 class="blog-article-title" itemprop="headline">${escapeHtml(post.title)}</h2>
    <p class="blog-article-dek" itemprop="description">${escapeHtml(post.excerpt)}</p>
    <p class="blog-article-permalink"><a href="${pageHref}" hreflang="en" class="blog-article-permalink-link">Dedicated page</a> <span class="blog-article-permalink-hint" aria-hidden="true">(shareable URL)</span></p>
    <meta itemprop="dateModified" content="${escapeHtmlAttr(modified)}">
    <meta itemprop="url" content="${escapeHtmlAttr(postUrl)}">
    <div class="blog-article-actions">
      <button type="button" class="blog-article-toggle" aria-expanded="false" aria-controls="${bodyId}">
        <span class="blog-article-toggle-label">Read full guide</span>
        <span class="blog-article-toggle-chevron" aria-hidden="true"></span>
      </button>
    </div>
    <div class="blog-article-body-wrap">
      <div id="${bodyId}" class="blog-article-body" itemprop="articleBody">
      ${body}
      </div>
    </div>
  </article>`;
    })
    .join('\n\n');
}

function buildJsonLd(siteName, siteBaseUrl, siteDescription, posts) {
  const base = siteBaseUrl.replace(/\/$/, '');
  const pageUrl = `${base}/`;
  const orgId = `${base}/#organization`;
  const blogId = `${pageUrl}#blog`;

  const blogPosting = posts.map((p) => {
    const url = articleUrlAbsolute(siteBaseUrl, p);
    const modified = p.dateModified || p.date;
    return {
      '@type': 'BlogPosting',
      '@id': url,
      headline: p.title,
      description: schemaDescriptionForPost(p, siteDescription),
      datePublished: p.date,
      dateModified: modified,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: { '@type': 'Organization', name: siteName, url: pageUrl },
      publisher: { '@id': orgId },
      isPartOf: { '@id': blogId },
      inLanguage: 'en-US',
      keywords: `${p.tag}, AI tools, freelancing, online income, beginners`,
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: siteName,
        url: pageUrl,
        description: siteDescription,
        logo: {
          '@type': 'ImageObject',
          url: `${base}/${SITE_LOGO_PATH}`,
        },
      },
      {
        '@type': 'Blog',
        '@id': blogId,
        name: `${siteName} — AI, freelancing & online income`,
        url: pageUrl,
        description: siteDescription,
        inLanguage: 'en-US',
        publisher: { '@id': orgId },
        blogPost: blogPosting.map((b) => ({ '@id': b['@id'] })),
      },
      ...blogPosting,
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: pageUrl,
        name: siteName,
        description: siteDescription,
        publisher: { '@id': orgId },
        inLanguage: 'en-US',
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function buildSeoHeadTags(siteName, siteBaseUrl, siteDescription, posts) {
  const base = siteBaseUrl.replace(/\/$/, '');
  const pageUrl = `${base}/`;
  const metaDesc = truncateMeta(siteDescription);
  const title = `${siteName} | AI tools, prompts & freelancing for beginners`;
  const lines = [
    `<meta name="description" content="${escapeHtmlAttr(metaDesc)}">`,
    `<meta name="author" content="${escapeHtmlAttr(siteName)}">`,
    `<link rel="alternate" hreflang="en" href="${escapeHtmlAttr(pageUrl)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtmlAttr(pageUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(siteName)}">`,
    `<meta property="og:title" content="${escapeHtmlAttr(title)}">`,
    `<meta property="og:description" content="${escapeHtmlAttr(metaDesc)}">`,
    `<meta property="og:url" content="${escapeHtmlAttr(pageUrl)}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:image" content="${escapeHtmlAttr(`${base}/${SITE_LOGO_PATH}`)}">`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(siteName + ' logo')}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(metaDesc)}">`,
  ];
  return lines.join('\n');
}

function buildArticlePageJsonLd(siteName, siteBaseUrl, siteDescription, post) {
  const base = siteBaseUrl.replace(/\/$/, '');
  const pageUrl = `${base}/`;
  const orgId = `${base}/#organization`;
  const blogId = `${pageUrl}#blog`;
  const articleUrl = articleUrlAbsolute(siteBaseUrl, post);
  const modified = post.dateModified || post.date;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: siteName,
        url: pageUrl,
      },
      {
        '@type': 'BlogPosting',
        '@id': articleUrl,
        headline: post.title,
        description: schemaDescriptionForPost(post, siteDescription),
        datePublished: post.date,
        dateModified: modified,
        url: articleUrl,
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        author: { '@type': 'Organization', name: siteName, url: pageUrl },
        publisher: { '@id': orgId },
        isPartOf: { '@id': blogId },
        inLanguage: 'en-US',
        keywords: `${post.tag}, AI tools, freelancing, online income, beginners`,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${articleUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: pageUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: post.title,
            item: articleUrl,
          },
        ],
      },
    ],
  };
}

function buildArticlePageHtml(siteName, siteBaseUrl, siteDescription, post) {
  const base = siteBaseUrl.replace(/\/$/, '');
  const pageUrl = `${base}/`;
  const articleUrl = articleUrlAbsolute(siteBaseUrl, post);
  const display = post.dateDisplay || formatDateDisplay(post.date);
  const body = buildArticleBody(post);
  const modified = post.dateModified || post.date;
  const metaDesc = metaDescriptionForPost(post, siteDescription);
  const title = `${post.title} | ${siteName}`;
  const jsonLd = JSON.stringify(buildArticlePageJsonLd(siteName, siteBaseUrl, siteDescription, post), null, 2);
  const homeHashHref = escapeHtmlAttr(`/#${String(post.id).trim()}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${CSP_HEAD}
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z267FMR5HC"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-Z267FMR5HC');
</script>
${ADSENSE_SCRIPT_SNIPPET}
<meta name="theme-color" content="#0a0e14">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)}</title>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${escapeHtmlAttr(articleUrl)}">
<meta name="description" content="${escapeHtmlAttr(metaDesc)}">
<meta name="author" content="${escapeHtmlAttr(siteName)}">
<link rel="alternate" hreflang="en" href="${escapeHtmlAttr(articleUrl)}">
<link rel="alternate" hreflang="x-default" href="${escapeHtmlAttr(articleUrl)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeHtmlAttr(siteName)}">
<meta property="og:title" content="${escapeHtmlAttr(post.title)}">
<meta property="og:description" content="${escapeHtmlAttr(metaDesc)}">
<meta property="og:url" content="${escapeHtmlAttr(articleUrl)}">
<meta property="og:locale" content="en_US">
<meta property="article:published_time" content="${escapeHtmlAttr(post.date)}">
<meta property="article:modified_time" content="${escapeHtmlAttr(modified)}">
<meta property="og:image" content="${escapeHtmlAttr(`${base}/${SITE_LOGO_PATH}`)}">
<meta property="og:image:alt" content="${escapeHtmlAttr(siteName + ' logo')}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtmlAttr(post.title)}">
<meta name="twitter:description" content="${escapeHtmlAttr(metaDesc)}">
<link rel="icon" href="/${SITE_LOGO_PATH}" type="image/png" sizes="512x512">
<link rel="manifest" href="/manifest.json">
<script type="application/ld+json">
${jsonLd}
</script>
<link rel="preload" href="/fonts/syne-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.min.css">
</head>
<body>

<a href="#main-content" class="skip-link">Skip to main content</a>

<nav class="site-nav" aria-label="Main navigation">
  <a href="/" class="nav-logo" aria-label="${escapeHtmlAttr(siteName)} — home">
    <img class="nav-logo-icon" src="/${SITE_LOGO_PATH}" alt="" width="40" height="40" decoding="async" fetchpriority="high" aria-hidden="true">
    <span class="nav-logo-name">${escapeHtml(siteName)}</span>
    <span class="nav-badge">AI · freelance · income</span>
  </a>
  <div class="nav-links">
    <a href="/#posts">Post grid</a>
    <a href="/#articles">Full guides</a>
  </div>
  <div class="nav-cta">
    <a href="/#posts" class="btn-wa btn-wa--accent">
      <span class="btn-wa-label--full">Browse posts</span>
      <span class="btn-wa-label--short">Posts</span>
    </a>
  </div>
</nav>

<main id="main-content" class="site-main blog-post-page-main" tabindex="-1">
  <div class="container blog-post-page-inner">
    <nav class="blog-breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span class="blog-breadcrumb-sep" aria-hidden="true">/</span>
      <a href="/#articles">Guides</a>
      <span class="blog-breadcrumb-sep" aria-hidden="true">/</span>
      <span class="blog-breadcrumb-current">${escapeHtml(post.title)}</span>
    </nav>

    <article class="blog-article blog-article--standalone reveal" itemscope itemtype="https://schema.org/BlogPosting">
      <div class="blog-article-meta">
        <time datetime="${escapeHtml(post.date)}" itemprop="datePublished">${escapeHtml(display)}</time>
        <span class="blog-card-tag">${escapeHtml(post.tag)}</span>
      </div>
      <h1 class="blog-article-title" itemprop="headline">${escapeHtml(post.title)}</h1>
      <p class="blog-article-dek" itemprop="description">${escapeHtml(post.excerpt)}</p>
      <meta itemprop="dateModified" content="${escapeHtmlAttr(modified)}">
      <meta itemprop="url" content="${escapeHtmlAttr(articleUrl)}">
      <p class="blog-post-home-link"><a href="${homeHashHref}">Open this guide on the homepage</a> <span aria-hidden="true">(expandable with other guides)</span></p>
      <div class="blog-article-body blog-article-body--standalone" itemprop="articleBody">
${body}
      </div>
    </article>

    <p class="blog-post-back"><a href="/#articles" class="blog-post-back-link">← All guides</a></p>
  </div>
</main>

<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <p class="footer-left"><strong>${escapeHtml(siteName)}</strong> — AI tools, freelancing prompts &amp; online income for beginners.</p>
    </div>
    <nav class="footer-nav" aria-label="Footer">
      <a href="/#posts">Post grid</a>
      <a href="/#articles">Guides</a>
      <a href="/">Home</a>
    </nav>
  </div>
</footer>

<script src="/main.min.js" defer></script>
</body>
</html>
`;
}

function syncBlogArticleFiles(siteName, siteBaseUrl, siteDescription, posts) {
  mkdirSync(blogDir, { recursive: true });
  const wanted = new Set(posts.map((p) => `${blogFileBase(p)}.html`));
  if (existsSync(blogDir)) {
    for (const name of readdirSync(blogDir)) {
      if (!name.endsWith('.html')) continue;
      if (!wanted.has(name)) {
        unlinkSync(join(blogDir, name));
      }
    }
  }
  for (const post of posts) {
    const name = `${blogFileBase(post)}.html`;
    const html = buildArticlePageHtml(siteName, siteBaseUrl, siteDescription, post);
    writeFileSync(join(blogDir, name), html, 'utf8');
  }
}

function escapeXmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function postLastmodYmd(post) {
  const d = post.dateModified || post.date;
  if (!d) return '';
  const str = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
}

function writeSitemap(pageUrl, posts) {
  const base = pageUrl.replace(/\/$/, '');
  const homeLoc = `${base}/`;
  const homeLastmod = latestPostDate(posts) || new Date().toISOString().slice(0, 10);

  const homeBlock = `  <url>
    <loc>${escapeXmlText(homeLoc)}</loc>
    <lastmod>${escapeXmlText(homeLastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`;

  const articleBlocks = posts.map((post) => {
    const loc = `${base}${articlePathRoot(post)}`;
    const lastmod = postLastmodYmd(post) || homeLastmod;
    return `  <url>
    <loc>${escapeXmlText(loc)}</loc>
    <lastmod>${escapeXmlText(lastmod)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${homeBlock}
${articleBlocks.join('\n')}
</urlset>
`;
  writeFileSync(sitemapPath, xml, 'utf8');
}

function replaceRegion(html, startMarker, endMarker, newInner) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`generate-blog: markers missing or invalid: ${startMarker}`);
  }
  return html.slice(0, start + startMarker.length) + '\n' + newInner + '\n' + html.slice(end);
}

let raw;
try {
  raw = readFileSync(dataPath, 'utf8');
} catch {
  console.warn('generate-blog: no blog-posts.json, skip');
  process.exit(0);
}

const data = JSON.parse(raw);
const siteBaseUrl = data.siteBaseUrl || 'https://waapply.com';
const siteName = data.siteName || 'WaApply';
const siteDescription = (data.siteDescription && String(data.siteDescription).trim()) || DEFAULT_SITE_DESCRIPTION;
const posts = sortPosts(data.posts || []);
const pageUrl = `${siteBaseUrl.replace(/\/$/, '')}/`;

const canonicalHref = pageUrl;

let html = readFileSync(indexPath, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(`${siteName} | AI tools, prompts & freelancing for beginners`)}</title>`);
html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonicalHref}">`);
html = replaceRegion(
  html,
  '<!-- SEO_AUTO_START -->',
  '<!-- SEO_AUTO_END -->',
  buildSeoHeadTags(siteName, siteBaseUrl, siteDescription, posts)
);
html = replaceRegion(
  html,
  '<!-- BLOG_JSONLD_AUTO_START -->',
  '<!-- BLOG_JSONLD_AUTO_END -->',
  `<script type="application/ld+json">\n${JSON.stringify(buildJsonLd(siteName, siteBaseUrl, siteDescription, posts), null, 2)}\n</script>`
);
html = replaceRegion(
  html,
  '<!-- BLOG_GRID_AUTO_START -->',
  '<!-- BLOG_GRID_AUTO_END -->',
  buildBlogGridHtml(posts, siteName, siteBaseUrl, siteDescription)
);
html = replaceRegion(
  html,
  '<!-- BLOG_ARTICLES_AUTO_START -->',
  '<!-- BLOG_ARTICLES_AUTO_END -->',
  buildBlogArticlesHtml(posts, siteName, siteBaseUrl, siteDescription)
);

writeFileSync(indexPath, html, 'utf8');

syncBlogArticleFiles(siteName, siteBaseUrl, siteDescription, posts);

writeSitemap(pageUrl, posts);

const lastmod = latestPostDate(posts) || new Date().toISOString().slice(0, 10);
console.log('generate-blog:', posts.length, 'post(s),', siteName, siteBaseUrl, '| sitemap', posts.length + 1, 'URL(s), home lastmod', lastmod);
