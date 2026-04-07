/**
 * One-off: removes Git merge conflict markers from a file (keeps HEAD side if differs).
 * Usage: node scripts/strip-merge-conflicts.mjs "WAAPPLY - Articles.tag-clean-v2.csv"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = process.argv[2] || 'WAAPPLY - Articles.tag-clean-v2.csv';
const p = join(root, rel);

let s = readFileSync(p, 'utf8');
const re =
  /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>>[^\r\n]+\r?\n/g;
let n = 0;
s = s.replace(re, (_, a, b) => {
  n++;
  return (a === b ? a : a);
});
writeFileSync(p, s, 'utf8');
console.log('strip-merge-conflicts:', rel, '→', n, 'block(s) resolved');
