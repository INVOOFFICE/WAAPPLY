/**
 * Assigns publication dates in file order: 2 posts one day, 1 the next, repeating,
 * counting backward from END_DATE. Preserves JSON array order so, after generate-blog's
 * descending date sort, grid order stays the same (first posts in JSON = newest).
 *
 * Usage: node scripts/stagger-post-dates.mjs
 * Optional: END_DATE=2026-03-28 node scripts/stagger-post-dates.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data', 'blog-posts.json');

const endYmd = (process.env.END_DATE || '2026-03-28').trim();

function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`stagger-post-dates: invalid END_DATE ${JSON.stringify(s)}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function addDaysUtc(ms, days) {
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() + days);
  return d.getTime();
}

function toYmd(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function buildStaggeredDates(count, endMs) {
  const out = [];
  let dayOffset = 0;
  let useTwo = true;
  while (out.length < count) {
    const dayMs = addDaysUtc(endMs, -dayOffset);
    const label = toYmd(dayMs);
    const batch = useTwo ? 2 : 1;
    useTwo = !useTwo;
    for (let i = 0; i < batch && out.length < count; i++) {
      out.push(label);
    }
    dayOffset += 1;
  }
  return out;
}

const raw = readFileSync(dataPath, 'utf8');
const data = JSON.parse(raw);
const posts = data.posts;
if (!Array.isArray(posts) || posts.length === 0) {
  console.warn('stagger-post-dates: no posts, exit');
  process.exit(0);
}

const endMs = parseYmd(endYmd);
const dates = buildStaggeredDates(posts.length, endMs);
for (let i = 0; i < posts.length; i++) {
  posts[i].date = dates[i];
}

writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(
  'stagger-post-dates:',
  posts.length,
  'posts',
  dates[0],
  '→',
  dates[dates.length - 1],
  '(newest first in file)'
);
