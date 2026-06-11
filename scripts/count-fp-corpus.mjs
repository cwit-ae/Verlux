import { readFileSync } from 'node:fs';

const src = readFileSync('tests/false-positives.test.ts', 'utf8');
const names = [
  'assWords', 'cockWords', 'cumWords', 'hellWords', 'buttWords', 'titWords',
  'penWords', 'analWords', 'organWords', 'properNames', 'miscWords',
  'ukPlaceNames', 'fuzzyCollisions', 'clWords', 'numericStrings',
  'crossLangAndFoldCollisions', 'shortAliasCollisions', 'medicalContexts',
  'realProfanity',
];

let grandTotal = 0;
for (const name of names) {
  const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) { console.log(`${name}: NOT FOUND`); continue; }
  const body = m[1].replace(/\/\/[^\n]*/g, ''); // strip line comments
  const count = (body.match(/'(?:[^'\\]|\\.)*'/g) ?? []).length;
  console.log(`${name}: ${count}`);
  if (name !== 'realProfanity') grandTotal += count;
}
console.log(`innocent total (incl. medical): ${grandTotal}`);
