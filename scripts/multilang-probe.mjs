import { verlux } from '../dist/esm/index.js';

const samples = [
  'fuck you cabrón espèce de connard du Schwein',
  'this is fuсk and pendejo and salaud',
  'puta madre du Arschloch you bastard',
  'tu gandu hai you are an idiot',
];

for (const s of samples) {
  const results = verlux.detect(s);
  console.log(`\nINPUT: "${s}"`);
  console.log(`HITS:  ${results.length}`);
  const langs = new Set(results.map(r => r.language));
  console.log(`LANGS: [${[...langs].join(', ')}]`);
  for (const r of results) {
    console.log(`  - ${r.language}/${r.matched} (${r.matchType}) at [${r.position[0]},${r.position[1]}]`);
  }
}
