import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function shortHash(filePath) {
  if (!existsSync(filePath)) {
    console.warn('cache-bust: missing', filePath);
    return '0';
  }
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 10);
}

const vCss = shortHash(join(root, 'styles.min.css'));
const vJs = shortHash(join(root, 'main.min.js'));

function applyAssetVersions(html) {
  return html
    .replace(/href="\/styles\.min\.css(\?v=[^"]*)?"/g, () => `href="/styles.min.css?v=${vCss}"`)
    .replace(/href="styles\.min\.css(\?v=[^"]*)?"/g, () => `href="styles.min.css?v=${vCss}"`)
    .replace(/src="\/main\.min\.js(\?v=[^"]*)?"/g, () => `src="/main.min.js?v=${vJs}"`)
    .replace(/src="main\.min\.js(\?v=[^"]*)?"/g, () => `src="main.min.js?v=${vJs}"`);
}

function bustHtmlFile(filePath) {
  if (!existsSync(filePath)) return;
  const html = applyAssetVersions(readFileSync(filePath, 'utf8'));
  writeFileSync(filePath, html, 'utf8');
}

bustHtmlFile(join(root, 'index.html'));

const blogDir = join(root, 'blog');
if (existsSync(blogDir)) {
  for (const name of readdirSync(blogDir)) {
    if (name.endsWith('.html')) bustHtmlFile(join(blogDir, name));
  }
}

console.log('cache-bust:', { 'styles.min.css': vCss, 'main.min.js': vJs });
