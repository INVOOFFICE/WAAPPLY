import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swPath = join(root, 'sw.js');
const jsonPath = join(root, 'data', 'blog-posts.json');

let suffix = 'local';
if (existsSync(jsonPath)) {
  suffix = createHash('sha256').update(readFileSync(jsonPath)).digest('hex').slice(0, 10);
}

let sw = readFileSync(swPath, 'utf8');
const re = /const CACHE = 'waapply-blog-[^']*';/;
if (!re.test(sw)) {
  console.warn('bump-sw-cache: CACHE line not found in sw.js');
  process.exit(0);
}
sw = sw.replace(re, `const CACHE = 'waapply-blog-${suffix}';`);
writeFileSync(swPath, sw, 'utf8');
console.log('bump-sw-cache: waapply-blog-' + suffix);
