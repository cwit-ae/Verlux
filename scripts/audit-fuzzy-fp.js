/**
 * One-shot fuzzy false-positive audit.
 * Runs every English word from `an-array-of-english-words` through the
 * detector and groups fuzzy hits by matched dictionary entry.
 *
 * Not shipped — install the wordlist with `npm install --no-save an-array-of-english-words`.
 */

const { verlux } = require('../dist/cjs/index.js');
const words = require('an-array-of-english-words');

const fpByDict = new Map();
let scanned = 0;

for (const w of words) {
  if (w.length < 3) continue;
  scanned++;
  const results = verlux.detect(w);
  if (results.length === 0) continue;
  for (const r of results) {
    if (r.matchType !== 'fuzzy') continue;
    if (r.language !== 'en') continue;
    const key = r.matched;
    if (!fpByDict.has(key)) fpByDict.set(key, []);
    fpByDict.get(key).push({ word: w, conf: r.confidence, sev: r.severity });
  }
}

const sorted = [...fpByDict.entries()]
  .map(([dict, hits]) => ({ dict, hits, count: hits.length }))
  .sort((a, b) => b.count - a.count);

console.log(`Scanned ${scanned} English words.`);
console.log(`Fuzzy FPs grouped by dictionary entry: ${sorted.length} clusters\n`);
for (const { dict, hits, count } of sorted) {
  const sev = hits[0].sev;
  console.log(`  ${dict} (${sev}) — ${count} FP${count === 1 ? '' : 's'}`);
  const sample = hits.slice(0, 15).map(h => h.word).join(', ');
  console.log(`    ${sample}${hits.length > 15 ? ` … +${hits.length - 15} more` : ''}`);
}
