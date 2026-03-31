import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = join(root, 'blog');

const files = [join(root, 'index.html')];
if (existsSync(blogDir)) {
  for (const name of readdirSync(blogDir)) {
    if (name.endsWith('.html')) files.push(join(blogDir, name));
  }
}

const violations = [];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  if (/<meta\s+name="twitter:card"\s+content="summary"\s*>/i.test(html)) {
    violations.push(`${file} -> twitter:card is summary`);
  }
  if (/<meta\s+property="og:image"\s+content="https:\/\/waapply\.com\/icon512x512\.png"\s*>/i.test(html)) {
    violations.push(`${file} -> og:image points to icon512x512.png`);
  }
  if (!/<meta\s+name="twitter:card"\s+content="summary_large_image"\s*>/i.test(html)) {
    violations.push(`${file} -> missing summary_large_image`);
  }
}

if (violations.length) {
  console.error('validate-social-meta: FAILED');
  for (const v of violations) console.error(' - ' + v);
  process.exit(1);
}

console.log(`validate-social-meta: OK (${files.length} file(s))`);
