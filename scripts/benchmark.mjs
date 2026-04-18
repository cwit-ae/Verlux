#!/usr/bin/env node
// Verlux benchmark — evaluates the shipped dataset against an internally
// curated test corpus that mirrors the HateCheck functional-test structure
// (derogation, dehumanisation, threat) and adds Hinglish, Spanish, and
// obfuscation coverage on top.
//
// Outputs precision, recall, F1, accuracy, and a confusion matrix.
//
// Usage:
//   npm run build
//   node scripts/benchmark.mjs

import { verlux } from '../dist/esm/index.js';

// ────────────────────────────────────────────────────────────────────────────
// HATEFUL CORPUS
// Sentences expected to be flagged by Verlux.
// Each entry is paired with the HateCheck-style category it represents.
// ────────────────────────────────────────────────────────────────────────────
const hateful = [
  // ─── Derogation: explicit slurs (English) ───
  { text: 'you are a worthless piece of shit',                category: 'derogation-en' },
  { text: 'shut up you fucking idiot',                        category: 'derogation-en' },
  { text: 'what an asshole that guy is',                      category: 'derogation-en' },
  { text: 'she is such a stupid bitch',                       category: 'derogation-en' },
  { text: 'you absolute moron',                               category: 'derogation-en' },
  { text: 'go fuck yourself',                                 category: 'derogation-en' },
  { text: 'you incompetent fraud',                            category: 'derogation-en' },
  { text: 'shut your mouth you scammer',                      category: 'derogation-en' },

  // ─── Derogation: identity slurs (English) ───
  { text: 'he is a faggot',                                   category: 'identity-slur-en' },
  { text: 'that retard cannot do anything right',             category: 'identity-slur-en' },
  { text: 'typical tranny behaviour',                         category: 'identity-slur-en' },
  { text: 'she is a whore',                                   category: 'identity-slur-en' },
  { text: 'such a slut',                                      category: 'identity-slur-en' },

  // ─── Dehumanisation (English) ───
  { text: 'they are vermin and should be removed',            category: 'dehumanisation-en' },
  { text: 'those people are subhuman parasites',              category: 'dehumanisation-en' },
  { text: 'they are nothing but cockroaches',                 category: 'dehumanisation-en' },
  { text: 'these savages do not belong here',                 category: 'dehumanisation-en' },
  { text: 'you are scum of the earth',                        category: 'dehumanisation-en' },
  { text: 'inferior degenerate filth',                        category: 'dehumanisation-en' },

  // ─── Threats and incitement to violence (English) ───
  { text: 'I will murder you',                                category: 'threat-en' },
  { text: 'they should all be exterminated',                  category: 'threat-en' },
  { text: 'we need to eradicate them',                        category: 'threat-en' },
  { text: 'I hope you get raped',                             category: 'threat-en' },
  { text: 'someone should lynch him',                         category: 'threat-en' },
  { text: 'you deserve to die',                               category: 'threat-en' },

  // ─── Self-harm incitement (English) ───
  { text: 'kill yourself already',                            category: 'self-harm-en' },
  { text: 'just kys nobody cares',                            category: 'self-harm-en' },

  // ─── Obfuscated profanity (English) ───
  { text: 'what the f.u.c.k is wrong with you',               category: 'obfuscation-en' },
  { text: 'you are an @$$h0le',                               category: 'obfuscation-en' },
  { text: 'this is total bullsh!t',                           category: 'obfuscation-en' },
  { text: 'you are soooo fuuuucking annoying',                category: 'obfuscation-en' },
  { text: 'go to h3ll you sh1t',                              category: 'obfuscation-en' },

  // ─── Hinglish abuse (Hindi/Urdu in Latin script) ───
  { text: 'tu ek bhenchod hai',                               category: 'derogation-hi' },
  { text: 'madarchod kahin ka',                               category: 'derogation-hi' },
  { text: 'chutiya mat bana',                                 category: 'derogation-hi' },
  { text: 'gandu insaan',                                     category: 'derogation-hi' },
  { text: 'haramzada nikla',                                  category: 'derogation-hi' },
  { text: 'tu randi ki aulad hai',                            category: 'derogation-hi' },

  // ─── Spanish abuse (peninsular and Latin American) ───
  { text: 'eres un cabron de mierda',                         category: 'derogation-es' },
  { text: 'que pendejo eres',                                 category: 'derogation-es' },
  { text: 'sois unos gilipollas',                             category: 'derogation-es' },
  { text: 'vete a la mierda',                                 category: 'derogation-es' },
  { text: 'eres un hijo de puta',                             category: 'derogation-es' },
  { text: 'me cago en dios',                                  category: 'derogation-es' },
  { text: 'que coño haces',                                   category: 'derogation-es' },
  { text: 'sos un boludo',                                    category: 'derogation-es' },

  // ─── Mixed multilingual abuse in a single utterance ───
  { text: 'your service is shit, sois unos gilipollas, bhenchod', category: 'multilingual' },
  { text: 'fuck you cabron and madarchod too',                category: 'multilingual' },
];

// ────────────────────────────────────────────────────────────────────────────
// CLEAN CORPUS
// Sentences expected NOT to be flagged. Mixes substring collisions
// (the Scunthorpe problem), business idioms, and benign multilingual content.
// ────────────────────────────────────────────────────────────────────────────
const clean = [
  // ─── Substring collisions ───
  { text: 'the assistant brought a class of students together',  category: 'substring-collision' },
  { text: 'please pass the cocktail glasses',                    category: 'substring-collision' },
  { text: 'the document accumulates over time',                  category: 'substring-collision' },
  { text: 'hello everyone, welcome to the shell',                category: 'substring-collision' },
  { text: 'spread butter on the buttered toast',                 category: 'substring-collision' },
  { text: 'the peninsula is shaped like a thumb',                category: 'substring-collision' },
  { text: 'her analysis of the canal system was thorough',       category: 'substring-collision' },
  { text: 'every organism in the ecosystem matters',             category: 'substring-collision' },
  { text: 'the assembly line was running efficiently',           category: 'substring-collision' },

  // ─── Place names (Scunthorpe problem) ───
  { text: 'I grew up in Scunthorpe',                             category: 'place-name' },
  { text: 'we drove past Penistone last weekend',                category: 'place-name' },
  { text: 'Cockermouth is a lovely town',                        category: 'place-name' },
  { text: 'Middlesex is a historic county',                      category: 'place-name' },

  // ─── Proper names ───
  { text: 'Mr Dickson is our new accountant',                    category: 'proper-name' },
  { text: 'Cockburn presented the quarterly report',             category: 'proper-name' },
  { text: 'Gay was an excellent host',                           category: 'proper-name' },

  // ─── Business idioms that resemble threats ───
  { text: 'kill the process if it hangs',                        category: 'business-idiom' },
  { text: 'execute the order before close of business',          category: 'business-idiom' },
  { text: 'we crushed the quarterly target',                     category: 'business-idiom' },
  { text: 'this campaign is going to kill it',                   category: 'business-idiom' },
  { text: 'let us murder the competition',                       category: 'business-idiom' },
  { text: 'the deployment was a clean kill',                     category: 'business-idiom' },

  // ─── Medical and educational ───
  { text: 'the sex education curriculum is being revised',       category: 'medical-educational' },
  { text: 'breast cancer awareness month begins in October',     category: 'medical-educational' },
  { text: 'sexual health resources are available on campus',     category: 'medical-educational' },
  { text: 'breastfeeding support groups meet weekly',            category: 'medical-educational' },

  // ─── Fuzzy-match collisions ───
  { text: 'a spammer keeps sending unwanted messages',           category: 'fuzzy-collision' },
  { text: 'the children scampered across the lawn',              category: 'fuzzy-collision' },
  { text: 'the shutter on the camera is broken',                 category: 'fuzzy-collision' },
  { text: 'the twinkle in her eye gave her away',                category: 'fuzzy-collision' },
  { text: 'the glass shattered on the floor',                    category: 'fuzzy-collision' },

  // ─── Benign Spanish (no abuse) ───
  { text: 'hola amigo, como estas hoy',                          category: 'benign-es' },
  { text: 'me gusta mucho la comida mexicana',                   category: 'benign-es' },
  { text: 'el partido fue muy emocionante',                      category: 'benign-es' },

  // ─── Benign Hinglish (no abuse) ───
  { text: 'mera naam Bilal hai',                                 category: 'benign-hi' },
  { text: 'kal hum bazaar jayenge',                              category: 'benign-hi' },
  { text: 'yeh kitab bahut acchi hai',                           category: 'benign-hi' },

  // ─── Benign English ───
  { text: 'hello world, how are you today',                      category: 'benign-en' },
  { text: 'the meeting has been rescheduled to Friday',          category: 'benign-en' },
  { text: 'please review the attached document at your leisure', category: 'benign-en' },
  { text: 'thank you for your prompt response',                  category: 'benign-en' },
  { text: 'we appreciate your patience during the outage',       category: 'benign-en' },
];

// ────────────────────────────────────────────────────────────────────────────
// EVALUATION
// ────────────────────────────────────────────────────────────────────────────
let TP = 0, FN = 0, FP = 0, TN = 0;
const missed = [];
const falseAlarms = [];

for (const sample of hateful) {
  const detected = !verlux.isClean(sample.text);
  if (detected) TP++;
  else { FN++; missed.push(sample); }
}

for (const sample of clean) {
  const detected = !verlux.isClean(sample.text);
  if (!detected) TN++;
  else {
    FP++;
    const matches = verlux.detect(sample.text).map(d => `${d.matched}(${d.matchType})`);
    falseAlarms.push({ ...sample, matches });
  }
}

const precision = TP / (TP + FP || 1);
const recall    = TP / (TP + FN || 1);
const f1        = (2 * precision * recall) / ((precision + recall) || 1);
const accuracy  = (TP + TN) / (TP + TN + FP + FN);

const pct = (n) => `${(n * 100).toFixed(1)}%`;

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  Verlux Benchmark — Internal Test Corpus');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Hateful samples: ${hateful.length}`);
console.log(`Clean samples:   ${clean.length}`);
console.log(`Total samples:   ${hateful.length + clean.length}\n`);

console.log('Confusion matrix:');
console.log('                       Predicted Hateful   Predicted Clean');
console.log(`  Actually Hateful     ${String(TP).padStart(10)} (TP)     ${String(FN).padStart(8)} (FN)`);
console.log(`  Actually Clean       ${String(FP).padStart(10)} (FP)     ${String(TN).padStart(8)} (TN)\n`);

console.log('Metrics:');
console.log(`  Precision:        ${pct(precision)}`);
console.log(`  Recall:           ${pct(recall)}`);
console.log(`  F1 Score:         ${pct(f1)}`);
console.log(`  Accuracy:         ${pct(accuracy)}`);
console.log(`  False Positives:  ${FP}\n`);

if (missed.length) {
  console.log(`Missed hateful samples (${missed.length}):`);
  for (const m of missed) console.log(`  [${m.category}] ${JSON.stringify(m.text)}`);
  console.log();
}

if (falseAlarms.length) {
  console.log(`False alarms on clean samples (${falseAlarms.length}):`);
  for (const f of falseAlarms) {
    console.log(`  [${f.category}] ${JSON.stringify(f.text)}`);
    console.log(`     matched: ${f.matches.join(', ')}`);
  }
  console.log();
}
