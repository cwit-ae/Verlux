/**
 * Broad false-positive audit across ALL match types and ALL languages.
 * Complements audit-fuzzy-fp.js (which only looks at fuzzy/en). Catches the
 * cross-language exact collisions (bite/bites → fr) and transliteration-fold
 * collisions (smooth → smut) classes.
 *
 * Not shipped — install wordlist with:
 *   npm install --no-save an-array-of-english-words
 */
const { verlux } = require('../dist/cjs/index.js');
const words = require('an-array-of-english-words');

const buckets = new Map(); // key: matchType|language|matched -> [words]
let scanned = 0;

for (const w of words) {
  if (w.length < 3) continue;
  scanned++;
  for (const r of verlux.detect(w)) {
    // We only care about FPs surfaced by a plain English dictionary word.
    // matchType 'exact' on an English low/medium word may be a true positive,
    // so flag the suspicious classes: non-en language, or transliteration/
    // normalized/fuzzy producing a hit from an everyday English word.
    const suspicious =
      r.language !== 'en' ||
      r.matchType === 'normalized' ||
      r.matchType === 'fuzzy';
    if (!suspicious) continue;
    // Drop genuine inflections: if the input literally contains the matched
    // profane root (e.g. "fucked" ⊇ "fuck", "bullshitters" ⊇ "shit"), or the
    // root contains the input, it's a true positive, not an FP.
    const lw = w.toLowerCase();
    const lm = String(r.matched).toLowerCase();
    if (lw.includes(lm) || lm.includes(lw)) continue;
    const key = `${r.matchType}|${r.language}|${r.matched}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(w);
  }
}

const rows = [...buckets.entries()]
  .map(([k, ws]) => ({ k, ws, n: ws.length }))
  .sort((a, b) => b.n - a.n);

console.log(`Scanned ${scanned} English words. ${rows.length} suspicious clusters.\n`);
for (const { k, ws, n } of rows) {
  console.log(`  ${k}  — ${n}`);
  console.log(`    ${ws.slice(0, 12).join(', ')}${n > 12 ? ` … +${n - 12}` : ''}`);
}
