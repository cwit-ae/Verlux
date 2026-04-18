#!/usr/bin/env node
// Emit TypeScript dictionary entries from scripts/staging/final-entries.json
// and splice them into src/dictionaries/en.ts.
//
// Splice points:
//   - Words:   directly before the closing `];` of EN_WORDS
//   - Phrases: directly before the closing `];` of EN_PHRASES

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const EN_TS = resolve(ROOT, 'src/dictionaries/en.ts');
const IN    = resolve(ROOT, 'scripts/staging/final-entries.json');

const { words, phrases } = JSON.parse(readFileSync(IN, 'utf8'));

const indent = '  ';
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function renderWord(e) {
  return [
    `${indent}{`,
    `${indent*2 ? '    ' : '    '}word: '${esc(e.word)}',`,
    `    normalized: [],`,
    `    language: 'en',`,
    `    severity: '${e.severity}',`,
    `    category: '${e.category}',`,
    `    allowPartialMatch: ${e.allowPartialMatch ? 'true' : 'false'},`,
    `    aliases: [],`,
    `${indent}},`,
  ].join('\n');
}

function renderPhrase(e) {
  const wordsArr = e.word.split(/\s+/).map((w) => `'${esc(w)}'`).join(', ');
  return [
    `${indent}{`,
    `    phrase: '${esc(e.word)}',`,
    `    words: [${wordsArr}],`,
    `    language: 'en',`,
    `    severity: '${e.severity}',`,
    `    category: '${e.category}',`,
    `${indent}},`,
  ].join('\n');
}

const wordsBlock = [
  '',
  `  // ╔══════════════════════════════════════════════╗`,
  `  // ║  EXTENDED DICTIONARY (v1.1)                  ║`,
  `  // ║  Merged from MIT-licensed sources:           ║`,
  `  // ║    - obscenity (jo3-l/obscenity)             ║`,
  `  // ║    - leo-profanity / LDNOOBW (Shutterstock)  ║`,
  `  // ║    - google-profanity-words (coffee-and-fun) ║`,
  `  // ║  See NOTICES/ for upstream license text.     ║`,
  `  // ╚══════════════════════════════════════════════╝`,
  '',
  ...words.map(renderWord),
].join('\n') + '\n';

const phrasesBlock = [
  '',
  `  // --- Extended phrases (v1.1) ---`,
  ...phrases.map(renderPhrase),
].join('\n') + '\n';

let src = readFileSync(EN_TS, 'utf8');

// Splice into EN_WORDS
{
  const marker = 'export const EN_WORDS: DictionaryEntry[] = [';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('EN_WORDS opener not found');
  const closeIdx = src.indexOf('\n];', start);
  if (closeIdx === -1) throw new Error('EN_WORDS closer not found');
  src = src.slice(0, closeIdx) + wordsBlock + src.slice(closeIdx);
}

// Splice into EN_PHRASES
{
  const marker = 'export const EN_PHRASES: PhraseEntry[] = [';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('EN_PHRASES opener not found');
  const closeIdx = src.indexOf('\n];', start);
  if (closeIdx === -1) throw new Error('EN_PHRASES closer not found');
  src = src.slice(0, closeIdx) + phrasesBlock + src.slice(closeIdx);
}

writeFileSync(EN_TS, src);

console.log(`Inserted ${words.length} words and ${phrases.length} phrases into`, EN_TS);
