/**
 * Reads data/blog-posts.json and injects grid, articles, JSON-LD, SEO meta, and sitemap.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data', 'blog-posts.json');
const indexPath = join(root, 'index.html');
const sitemapPath = join(root, 'sitemap.xml');

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

function buildArticleBody(post) {
  if (post.bodyHtml && String(post.bodyHtml).trim()) {
    return post.bodyHtml.trim();
  }
  const paras = Array.isArray(post.paragraphs) ? post.paragraphs : [];
  return paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n      ');
}

function buildBlogGridHtml(posts) {
  return posts
    .map((post, i) => {
      const delay = i === 0 ? '' : ` style="transition-delay:${(i * 0.06).toFixed(2)}s"`;
      const display = post.dateDisplay || formatDateDisplay(post.date);
      return `      <article class="blog-card reveal"${delay} itemscope itemtype="https://schema.org/BlogPosting">
        <div class="blog-card-meta">
          <time class="blog-card-date" datetime="${escapeHtml(post.date)}" itemprop="datePublished">${escapeHtml(display)}</time>
          <span class="blog-card-tag">${escapeHtml(post.tag)}</span>
        </div>
        <h3 class="blog-card-title" itemprop="headline">${escapeHtml(post.title)}</h3>
        <p class="blog-card-excerpt" itemprop="description">${escapeHtml(post.excerpt)}</p>
        <a href="#${escapeHtml(post.id)}" class="blog-card-link" itemprop="url" hreflang="en" title="Read: ${escapeHtmlAttr(post.title)}">Read guide <span aria-hidden="true">→</span></a>
      </article>`;
    })
    .join('\n\n');
}

function buildBlogArticlesHtml(posts, pageUrl) {
  const baseNoSlash = pageUrl.replace(/\/$/, '');
  return posts
    .map((post, i) => {
      const delay = i === 0 ? '' : ` style="transition-delay:${(i * 0.06).toFixed(2)}s"`;
      const display = post.dateDisplay || formatDateDisplay(post.date);
      const body = buildArticleBody(post);
      const postUrl = `${baseNoSlash}/#${post.id}`;
      const modified = post.dateModified || post.date;
      return `  <article id="${escapeHtml(post.id)}" class="blog-article reveal"${delay} itemscope itemtype="https://schema.org/BlogPosting">
    <div class="blog-article-meta">
      <time datetime="${escapeHtml(post.date)}" itemprop="datePublished">${escapeHtml(display)}</time>
      <span class="blog-card-tag">${escapeHtml(post.tag)}</span>
    </div>
    <h2 class="blog-article-title" itemprop="headline">${escapeHtml(post.title)}</h2>
    <p class="blog-article-dek" itemprop="description">${escapeHtml(post.excerpt)}</p>
    <meta itemprop="dateModified" content="${escapeHtmlAttr(modified)}">
    <meta itemprop="url" content="${escapeHtmlAttr(postUrl)}">
    <div class="blog-article-body" itemprop="articleBody">
      ${body}
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
    const url = `${pageUrl}#${p.id}`;
    const modified = p.dateModified || p.date;
    return {
      '@type': 'BlogPosting',
      '@id': `${url}`,
      headline: p.title,
      description: p.excerpt,
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
          url: `${base}/favicon.svg`,
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
    `<meta property="og:image" content="${escapeHtmlAttr(`${base}/favicon.svg`)}">`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(siteName + ' logo')}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(metaDesc)}">`,
  ];
  return lines.join('\n');
}

function writeSitemap(pageUrl, lastmodYmd) {
  const loc = pageUrl.replace(/\/$/, '') + '/';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmodYmd}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
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
  buildBlogGridHtml(posts)
);
html = replaceRegion(
  html,
  '<!-- BLOG_ARTICLES_AUTO_START -->',
  '<!-- BLOG_ARTICLES_AUTO_END -->',
  buildBlogArticlesHtml(posts, pageUrl)
);

writeFileSync(indexPath, html, 'utf8');

const lastmod = latestPostDate(posts) || new Date().toISOString().slice(0, 10);
writeSitemap(pageUrl, lastmod);

console.log('generate-blog:', posts.length, 'post(s),', siteName, siteBaseUrl, '| sitemap lastmod', lastmod);
