/**
 * Reads data/blog-posts.json and injects grid + articles + JSON-LD into index.html (single-page blog).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data', 'blog-posts.json');
const indexPath = join(root, 'index.html');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
        <a href="#${escapeHtml(post.id)}" class="blog-card-link">Read article <span aria-hidden="true">→</span></a>
      </article>`;
    })
    .join('\n\n');
}

function buildBlogArticlesHtml(posts) {
  return posts
    .map((post, i) => {
      const delay = i === 0 ? '' : ` style="transition-delay:${(i * 0.06).toFixed(2)}s"`;
      const display = post.dateDisplay || formatDateDisplay(post.date);
      const body = buildArticleBody(post);
      return `  <article id="${escapeHtml(post.id)}" class="blog-article reveal"${delay} itemscope itemtype="https://schema.org/BlogPosting">
    <div class="blog-article-meta">
      <time datetime="${escapeHtml(post.date)}" itemprop="datePublished">${escapeHtml(display)}</time>
      <span class="blog-card-tag">${escapeHtml(post.tag)}</span>
    </div>
    <h2 class="blog-article-title" itemprop="headline">${escapeHtml(post.title)}</h2>
    <div class="blog-article-body" itemprop="articleBody">
      ${body}
    </div>
  </article>`;
    })
    .join('\n\n');
}

function buildJsonLd(siteName, siteBaseUrl, posts) {
  const base = siteBaseUrl.replace(/\/$/, '');
  const pageUrl = `${base}/`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: siteName,
        url: pageUrl,
        description: 'AI tools and guides for beginners building income online.',
      },
      {
        '@type': 'Blog',
        '@id': `${pageUrl}#blog`,
        name: siteName,
        url: pageUrl,
        description: 'Artificial intelligence tools for beginners who want to make money online.',
        publisher: { '@id': `${base}/#organization` },
        blogPost: posts.map((p) => ({
          '@type': 'BlogPosting',
          headline: p.title,
          datePublished: p.date,
          url: `${pageUrl}#${p.id}`,
        })),
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: pageUrl,
        name: siteName,
        publisher: { '@id': `${base}/#organization` },
        inLanguage: 'en',
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
  return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`;
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
const siteBaseUrl = data.siteBaseUrl || 'https://example.github.io/waapply';
const siteName = data.siteName || 'WaApply';
const posts = sortPosts(data.posts || []);

let html = readFileSync(indexPath, 'utf8');
html = replaceRegion(
  html,
  '<!-- BLOG_JSONLD_AUTO_START -->',
  '<!-- BLOG_JSONLD_AUTO_END -->',
  buildJsonLd(siteName, siteBaseUrl, posts)
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
  buildBlogArticlesHtml(posts)
);

writeFileSync(indexPath, html, 'utf8');
console.log('generate-blog:', posts.length, 'post(s),', siteName, siteBaseUrl);
