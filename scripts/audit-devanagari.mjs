/**
 * Devanagari (native-script Hindi) detection audit — both directions.
 *
 * Romanized Hindi is covered by scripts/audit-hinglish-fp.mjs. This one
 * exercises the other half of the transliterator: input written in Devanagari,
 * which reaches the hi-latn dictionary only through `devanagariToLatin` plus
 * the Hinglish folds.
 *
 * RECALL half: every hi-latn dictionary entry, spelled natively. Before the
 * schwa-deletion and fold-ordering fixes this scored 1/12 on a spot check --
 * चूत romanized to "choota", भेनचोद to "bhenachoda", and the folds ran against
 * the raw Devanagari (where, being Latin-only regexes, they matched nothing).
 *
 * PRECISION half: a corpus of everyday Hindi that must stay clean. Schwa
 * deletion WIDENS what the romanizer produces, so it can only ship alongside a
 * false-positive corpus.
 *
 *   node scripts/audit-devanagari.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { verlux } = require('../dist/cjs/index.js');

/** Native spellings of the hi-latn entries. These MUST be detected. */
const PROFANITY = [
  ['भेनचोद', 'bhenchod'], ['बहनचोद', 'bhenchod'], ['भैनचोद', 'bhenchod'],
  ['मादरचोद', 'madarchod'],
  ['चूतिया', 'chutiya'], ['चुतिया', 'chutiya'],
  ['गांड', 'gaand'], ['गाण्ड', 'gaand'],
  ['गांडू', 'gandu'], ['गांडु', 'gandu'],
  ['लंड', 'lund'], ['लौड़ा', 'lund'],
  ['रंडी', 'randi'],
  ['हरामज़ादा', 'haramzada'], ['हरामी', 'haramzada'],
  ['भोसड़ीके', 'bhosdike'],
  ['चूत', 'chut'],
  ['टट्टी', 'tatti'],
  ['साला', 'saala'],
  ['कुत्ता', 'kutta'], ['कुत्ती', 'kutti'],
  ['कमीना', 'kamina'],
  ['गधा', 'gadha'],
  ['उल्लू', 'ullu'],
  ['बेवकूफ', 'bewakoof'], ['बेवकूफ़', 'bewakoof'],
  ['झाटू', 'jhatu'],
  ['छक्का', 'chakka'],
  ['हिजड़ा', 'hijra'],
  ['दल्ला', 'dalla'],
  ['चिनाल', 'chinaal'],
  ['सुअर', 'suar'], ['सूअर', 'suar'],
  ['हगना', 'hagna'],
  ['चरसी', 'charsi'],
  ['नालायक', 'nalayak'],
  ['चपरी', 'chapri'],
  ['भड़वा', 'bhadwa'],
  // Multi-word entries. The phrase tier does a normalize() lookup against
  // Roman keys, so these reach the dictionary only via the folded phrase
  // index -- they are the regression guard on it.
  ['तेरी माँ की', 'teri maa ki'],
  ['माँ की आँख', 'maa ki aankh'],
  ['तेरी गांड', 'teri gaand'],
  ['उल्लू का पट्ठा', 'ullu ka pattha'],
  ['चुप कर', 'chup kar'],
];

/** Everyday Hindi. None of this may be flagged. */
const BENIGN = [
  // greetings, courtesy
  'नमस्ते', 'नमस्कार', 'धन्यवाद', 'कृपया', 'माफ़', 'माफ', 'स्वागत', 'शुक्रिया',
  // people, kinship
  'आदमी', 'औरत', 'लड़का', 'लड़की', 'बच्चा', 'बच्चे', 'दोस्त', 'माँ', 'पिता',
  'बहन', 'भाई', 'बेटा', 'बेटी', 'दादा', 'दादी', 'नाना', 'नानी', 'चाचा', 'मामा',
  // body
  'दिल', 'जान', 'आँख', 'हाथ', 'पैर', 'सर', 'मुँह', 'नाक', 'कान', 'बाल', 'दाँत',
  // time
  'दिन', 'रात', 'सुबह', 'शाम', 'साल', 'महीना', 'समय', 'आज', 'कल', 'अभी',
  'हमेशा', 'कभी', 'जल्दी', 'देर',
  // place, world
  'घर', 'जगह', 'शहर', 'गाँव', 'देश', 'दुनिया', 'रास्ता', 'सफ़र', 'गाड़ी',
  'धरती', 'आकाश', 'सूरज', 'चाँद', 'तारा', 'बादल', 'बारिश', 'हवा', 'आग',
  // food, objects
  'पानी', 'खाना', 'दूध', 'चाय', 'रोटी', 'चावल', 'दाल', 'नमक', 'चीनी', 'फल',
  'सब्ज़ी', 'पेड़', 'पत्ता', 'मिट्टी', 'किताब', 'कलम', 'काग़ज़', 'पैसा',
  'बाज़ार', 'दुकान', 'नौकरी',
  // verbs
  'पढ़ना', 'लिखना', 'सीखना', 'देखना', 'सुनना', 'बोलना', 'समझना', 'सोचना',
  'मिलना', 'बनाना', 'उठाना', 'लगाना', 'चलाना', 'खेलना', 'गाना', 'नाचना',
  'हँसना', 'रोना', 'सोना', 'जागना', 'आना', 'जाना', 'करना', 'होना', 'देना', 'लेना',
  // adjectives, quantities
  'अच्छा', 'बुरा', 'बड़ा', 'छोटा', 'लंबा', 'नया', 'पुराना', 'सुंदर', 'ठंडा',
  'गरम', 'मीठा', 'खट्टा', 'हल्का', 'भारी', 'तेज़', 'धीरे', 'ज़्यादा', 'कम',
  'बहुत', 'थोड़ा', 'सब', 'कुछ', 'कोई',
  // question words, pronouns
  'क्या', 'कौन', 'कहाँ', 'कब', 'कैसे', 'क्यों', 'कितना', 'यह', 'वह', 'मैं',
  'तुम', 'आप', 'हम', 'मेरा', 'तेरा', 'उसका', 'हमारा', 'तुम्हारा',
  // emotion, religion, festivals
  'खुश', 'खुशी', 'दुख', 'प्रेम', 'प्यार', 'शांति', 'शादी', 'त्योहार', 'दिवाली',
  'होली', 'ईद', 'मंदिर', 'मस्जिद', 'भगवान', 'खुदा', 'दुआ', 'नमाज़', 'रोज़ा',
  // the Devanagari originals of the romanized words that needed safelisting
  'फूल', 'गंध', 'सुगंध', 'शाला', 'पाठशाला', 'विद्यालय', 'छूट', 'अछूत',
  // numbers
  'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
  // running prose
  'मुझे यह दिखाई नहीं दे रहा है',
  'आज मौसम बहुत अच्छा है',
  'कृपया मुझे पानी दीजिए',
  'वह स्कूल जा रहा है',
  'इस दुकान पर पचास प्रतिशत छूट है',
  'फूल बहुत सुंदर हैं',
  // Multi-word benign, to keep the folded phrase index honest.
  'मेरी बहन का घर',
  'कृपया चुप रहिए',
  'माँ की गोद',
  'तेरी किताब कहाँ है',
];

let failures = 0;

const missed = PROFANITY.filter(([word]) => verlux.detect(word).length === 0);
console.log(`RECALL: ${PROFANITY.length - missed.length}/${PROFANITY.length} native-script entries detected`);
if (missed.length) {
  failures += missed.length;
  console.log('  MISSED:');
  for (const [word, expected] of missed) console.log(`    ${word}  (expected ${expected})`);
}

const flagged = [];
for (const text of BENIGN) {
  for (const r of verlux.detect(text)) flagged.push({ text, ...r });
}
console.log(`\nPRECISION: ${BENIGN.length - new Set(flagged.map(f => f.text)).size}/${BENIGN.length} benign inputs clean`);
if (flagged.length) {
  failures += flagged.length;
  console.log('  FALSE POSITIVES:');
  for (const f of flagged) {
    console.log(`    "${f.text}"  ->  ${f.matched} (${f.language}/${f.severity}) [${f.matchType}]`);
  }
}

if (!failures) console.log('\nall clear');
process.exitCode = failures ? 1 : 0;
