// ============================================================
// PIPELINE TEST — Vérifie les sorties du build blog
// Node.js natif, sans framework.
// Usage : node tests/pipeline.test.mjs
// Exit 0 = succès, 1 = échec
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const BLOG_DIR   = path.join(ROOT, 'blog');
const SITE_URL   = 'https://waapply.com';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ── Helper : lire et parser un JSON —───────────────────────
function readJSON(relPath) {
  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ── Helper : lire et parser grossièrement le sitemap XML ───
function parseSitemapUrls(xml) {
  const urls = [];
  const re   = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

// ═══════════════════════════════════════════════════════════
console.log('\n🔍 Test 1 — blogs-latest.json');
console.log('─'.repeat(50));

const latest = readJSON('blogs-latest.json');
assert(latest !== null,                      'blogs-latest.json existe');
if (latest) {
  assert(Array.isArray(latest),              'est un tableau');
  assert(latest.length <= 10,                `≤ 10 articles (${latest.length})`);

  for (const [i, a] of latest.entries()) {
    const prefix = `article[${i}]`;
    assert(typeof a.slug === 'string' && a.slug.length > 0,  `${prefix}.slug présent`);
    assert(typeof a.title === 'string' && a.title.length > 0, `${prefix}.title présent`);
    assert(a.status === 'published',                          `${prefix}.status === 'published'`);
  }
}

// ═══════════════════════════════════════════════════════════
console.log('\n🔍 Test 2 — Pages blog/<slug>/index.html générées');
console.log('─'.repeat(50));

// Lire blogs.json (référence complète pour tous les slugs)
const all = readJSON('blogs.json') || latest;
const items = (Array.isArray(all) ? all : (all.all || [])).filter(
  a => a.status === 'published' && a.slug
);

const missing = [];
for (const a of items) {
  const pagePath = path.join(BLOG_DIR, a.slug, 'index.html');
  if (!fs.existsSync(pagePath)) {
    missing.push(a.slug);
  }
}

assert(missing.length === 0, `tous les slugs ont blog/<slug>/index.html (${items.length} articles)`);
if (missing.length > 0) {
  console.log(`       Manquants : ${missing.join(', ')}`);
}

// ═══════════════════════════════════════════════════════════
console.log('\n🔍 Test 3 — sitemap.xml contient toutes les URLs des slugs');
console.log('─'.repeat(50));

const sitemapPath = path.join(ROOT, 'sitemap.xml');
assert(fs.existsSync(sitemapPath),          'sitemap.xml existe');

if (fs.existsSync(sitemapPath)) {
  const xml     = fs.readFileSync(sitemapPath, 'utf8');
  const urls    = parseSitemapUrls(xml);
  const missingUrls = [];

  for (const a of items) {
    const expected = `${SITE_URL}/blog/${a.slug}/`;
    if (!urls.includes(expected)) {
      missingUrls.push(expected);
    }
  }

  assert(missingUrls.length === 0, `toutes les URLs des slugs sont dans le sitemap (${items.length} slugs)`);
  if (missingUrls.length > 0) {
    console.log(`       Manquantes :\n${missingUrls.map(u => `         ${u}`).join('\n')}`);
  }
}

// ═══════════════════════════════════════════════════════════
// BILAN
// ═══════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
if (failed === 0) {
  console.log(`\n🎉 ${passed}/${passed + failed} tests réussis`);
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} échec(s) — ${passed}/${passed + failed} tests réussis`);
  process.exit(1);
}
