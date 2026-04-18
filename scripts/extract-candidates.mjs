#!/usr/bin/env node
// Extract candidate English profanity entries from external MIT-licensed sources.
// Output: scripts/staging/candidates.json
//
// Sources:
//   - obscenity (jo3-l/obscenity)          - MIT
//   - leo-profanity / LDNOOBW             - MIT
//   - google-profanity-words (coffee-and-fun) - MIT
//
// Process:
//   1. Parse src/dictionaries/en.ts as text; collect every single-quoted token.
//   2. Normalize each external list into a flat word set.
//   3. Subtract the existing-token set.
//   4. Write remaining candidates (with provenance) to staging.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const EN_TS         = resolve(ROOT, 'src/dictionaries/en.ts');
const LEO_JSON      = resolve(ROOT, 'scripts/staging/leo-profanity-en.json');
const OBSCENITY_TS  = resolve(ROOT, 'scripts/staging/obscenity-english.ts');
const GPW_TXT       = resolve(ROOT, 'scripts/staging/google-profanity-words-en.txt');
const OUT           = resolve(ROOT, 'scripts/staging/candidates.json');

const readText = (p) => readFileSync(p, 'utf8');

function existingTokens() {
  const src = readText(EN_TS);
  const tokens = new Set();
  // Single-quoted string literals (the convention in en.ts).
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const raw = m[1].trim().toLowerCase();
    if (!raw) continue;
    tokens.add(raw);
    // Strip l33t substitutions for a broader match against plain words.
    const deLeet = raw
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/8/g, 'b')
      .replace(/\$/g, 's')
      .replace(/@/g, 'a')
      .replace(/\*/g, '');
    if (deLeet !== raw) tokens.add(deLeet);
  }
  return tokens;
}

function leoList() {
  const arr = JSON.parse(readText(LEO_JSON));
  return arr.map((w) => String(w).trim().toLowerCase()).filter(Boolean);
}

function obscenityList() {
  const src = readText(OBSCENITY_TS);
  // Pull every originalWord: 'foo' metadata literal.
  const re = /originalWord:\s*'([^']+)'/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1].trim().toLowerCase());
  return out;
}

function gpwList() {
  return readText(GPW_TXT)
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

function diff(list, existing) {
  const fresh = [];
  for (const w of list) {
    if (existing.has(w)) continue;
    // Also ignore if an alias/normalized stem is present.
    const condensed = w.replace(/[\s\-'`]/g, '');
    if (existing.has(condensed)) continue;
    fresh.push(w);
  }
  return Array.from(new Set(fresh)).sort();
}

const existing = existingTokens();

const sources = {
  obscenity:                diff(obscenityList(), existing),
  'leo-profanity':          diff(leoList(),       existing),
  'google-profanity-words': diff(gpwList(),       existing),
};

const unionMap = new Map();
for (const [src, words] of Object.entries(sources)) {
  for (const w of words) {
    if (!unionMap.has(w)) unionMap.set(w, []);
    unionMap.get(w).push(src);
  }
}
const union = Array.from(unionMap.entries())
  .map(([word, sources]) => ({ word, sources }))
  .sort((a, b) => a.word.localeCompare(b.word));

const report = {
  existingTokenCount: existing.size,
  perSource: Object.fromEntries(
    Object.entries(sources).map(([k, v]) => [k, v.length])
  ),
  unionUnique: union.length,
  candidates: union,
};

writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log('Existing tokens (word/alias/normalized):', existing.size);
for (const [src, words] of Object.entries(sources)) {
  console.log(`  new from ${src}:`, words.length);
}
console.log('Union unique candidates:', union.length);
console.log('Wrote', OUT);
