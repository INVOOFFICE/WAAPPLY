import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TAG_MAP = {
  'make money online': 'Make Money Online',
  'ai tools reviews': 'AI Tools Reviews',
  'freelancing guides': 'Freelancing Guides',
  'side hustle ideas': 'Side Hustle Ideas',
  'money & income': 'Side Hustle Ideas',
  'ai & income': 'Side Hustle Ideas',
  'personal finance': 'Make Money Online',
  investing: 'Make Money Online',
  'business & income': 'Make Money Online',
  'business & marketing': 'Make Money Online',
  'career & jobs': 'Freelancing Guides',
  'career & job': 'Freelancing Guides',
  'work & income': 'Freelancing Guides',
  'ai freelance and side hustle': 'Freelancing Guides',
  'ai freelance': 'Freelancing Guides',
  'ai tools': 'AI Tools Reviews',
  'ai tools comparison': 'AI Tools Reviews',
  'ai coding tools': 'AI Tools Reviews',
  'ai image generators': 'AI Tools Reviews',
  'ai automation tools': 'AI Tools Reviews',
  'chatgpt use cases': 'AI Tools Reviews',
  'gemini ai': 'AI Tools Reviews',
  'ai news': '',
};

function normalizeTag(tag) {
  const key = String(tag || '').trim().toLowerCase();
  if (!key) return '';
  return Object.prototype.hasOwnProperty.call(TAG_MAP, key) ? TAG_MAP[key] : '';
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
      continue;
    }
    if (c === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function toCsvField(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function run(inputPath, outputPath) {
  const raw = readFileSync(inputPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === ''));
  if (!lines.length) throw new Error('Empty CSV');

  const header = splitCsvLine(lines[0]);
  const tagIdx = header.findIndex((h) => String(h).trim().toLowerCase() === 'tag');
  if (tagIdx < 0) throw new Error('Missing "tag" column');

  let mapped = 0;
  let dropped = 0;
  const out = [header.map(toCsvField).join(',')];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    while (cols.length < header.length) cols.push('');

    const oldTag = cols[tagIdx];
    const nextTag = normalizeTag(oldTag);
    if (!nextTag) {
      dropped++;
      continue;
    }
    if (nextTag !== oldTag) mapped++;
    cols[tagIdx] = nextTag;
    out.push(cols.map(toCsvField).join(','));
  }

  writeFileSync(outputPath, out.join('\n') + '\n', 'utf8');
  console.log(`remap-editorial-tags: mapped=${mapped}, dropped=${dropped}, kept=${out.length - 1}`);
  console.log(`output: ${outputPath}`);
}

const input = process.argv[2] || join(process.cwd(), 'WAAPPLY - Articles.csv');
const output = process.argv[3] || join(process.cwd(), 'WAAPPLY - Articles.tag-clean.csv');
run(input, output);
