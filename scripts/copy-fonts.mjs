/**
 * After npm install: copies @fontsource woff2 files into fonts/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'fonts');

const files = [
  'syne/files/syne-latin-400-normal.woff2',
  'syne/files/syne-latin-600-normal.woff2',
  'syne/files/syne-latin-700-normal.woff2',
  'syne/files/syne-latin-800-normal.woff2',
  'syne/files/syne-latin-ext-400-normal.woff2',
  'syne/files/syne-latin-ext-600-normal.woff2',
  'syne/files/syne-latin-ext-700-normal.woff2',
  'syne/files/syne-latin-ext-800-normal.woff2',
  'dm-sans/files/dm-sans-latin-300-normal.woff2',
  'dm-sans/files/dm-sans-latin-300-italic.woff2',
  'dm-sans/files/dm-sans-latin-400-normal.woff2',
  'dm-sans/files/dm-sans-latin-500-normal.woff2',
  'dm-sans/files/dm-sans-latin-ext-300-normal.woff2',
  'dm-sans/files/dm-sans-latin-ext-300-italic.woff2',
  'dm-sans/files/dm-sans-latin-ext-400-normal.woff2',
  'dm-sans/files/dm-sans-latin-ext-500-normal.woff2',
];

fs.mkdirSync(outDir, { recursive: true });
for (const rel of files) {
  const src = path.join(root, 'node_modules', '@fontsource', rel);
  const dest = path.join(outDir, path.basename(rel));
  fs.copyFileSync(src, dest);
}
console.log('fonts:copy →', outDir, '(' + files.length + ' files)');
