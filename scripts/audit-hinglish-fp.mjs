/**
 * False-positive audit over romanized Hindi/Urdu (Hinglish) input.
 *
 * Complements audit-all-fp.js and audit-fuzzy-fp.js, which both scan an
 * ENGLISH wordlist and therefore cannot surface this class: an everyday
 * Hinglish word that the phonetic folds in transliterator.ts collapse onto a
 * profanity root. `dikhai` ("visible") folds kh->k then ai->e and lands on
 * `dike`, an alias of the English slur `dyke`.
 *
 * No published wordlist of romanized Hindi exists, so the corpus below is
 * hand-built from everyday vocabulary - verbs and their inflections, kinship
 * terms, numbers, time words, question words, pronouns - weighted toward the
 * digraphs the folds actually rewrite (kh, gh, bh, dh, th, sh, ph, ch) and the
 * vowel clusters they collapse (aa, ee, oo, ai, au).
 *
 * Every word here is BENIGN and must stay clean. Run after any change to the
 * fold rules or the transliteration tier:
 *   node scripts/audit-hinglish-fp.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { verlux } = require('../dist/cjs/index.js');

const CORPUS = [
  // -- kh / gh / bh / dh / th / sh / ph digraphs --
  'dikhai', 'dikhana', 'dikhao', 'dikhaya', 'dikhawa', 'dikhta', 'dikhti',
  'likhai', 'likhna', 'likha', 'likhi', 'likhte', 'likhkar',
  'sikhai', 'sikhna', 'sikha', 'sikhi', 'sikhane', 'sikhaya',
  'rakhai', 'rakhna', 'rakha', 'rakhi', 'rakhte', 'rakhwali',
  'dekhna', 'dekha', 'dekhi', 'dekhte', 'dekhkar', 'dekhbhal',
  'khana', 'khaya', 'khaana', 'khilana', 'khilaya',
  'khush', 'khushi', 'khushiyan', 'khuda', 'khud', 'khaas', 'khaaskar',
  'khel', 'khelna', 'khela', 'kheti', 'khet', 'khidki', 'khoj', 'khojna',
  'khareed', 'kharab', 'khada', 'khadi', 'khoon', 'khatam', 'khatra',
  'dukh', 'dukhi', 'sukh', 'sukhi', 'mukh', 'mukhya', 'rukh', 'lakh',
  'aankh', 'aankhein', 'bhookh', 'bhookha', 'sakhi', 'sakha', 'makhan',
  'nikhar', 'tikha', 'pramukh', 'shankh', 'chakh', 'chakhna',
  'ghar', 'ghari', 'ghanta', 'ghaas', 'ghayal', 'ghoomna', 'ghoda', 'ghata',
  'bhai', 'bhaiya', 'bhabhi', 'bhasha', 'bharat', 'bharosa', 'bhagwan',
  'bheja', 'bhejna', 'bhari', 'bhala', 'bhoot', 'bheed',
  'dhoop', 'dhona', 'dhoya', 'dhyan', 'dhanyavaad', 'dhanda', 'dheere',
  'dhoondna', 'dhool', 'dharti', 'dharm', 'dhokha',
  'thoda', 'thanda', 'thakna', 'thaka', 'thali', 'theek', 'thehar',
  'shaam', 'shahar', 'shanti', 'shaadi', 'shuru', 'shukriya', 'shabd',
  'shaala', 'paathshaala', 'shayad', 'shor', 'shauk', 'shishya',
  'phir', 'phal', 'phool', 'phaila', 'phatak', 'phursat',
  'chai', 'chalna', 'chala', 'chali', 'chhota', 'chhoti', 'chhutti',
  'chhoot', 'chhutkara', 'chehra', 'chinta', 'chamak', 'chaand', 'chor',
  // -- ai / au / aa / ee / oo vowel clusters --
  'hai', 'hain', 'nahi', 'nahin', 'kahin', 'kai', 'jai', 'rai', 'sai',
  'chahiye', 'paisa', 'paise', 'kaisa', 'kaise', 'kaisi', 'hairan',
  'faida', 'taiyar', 'baithna', 'baitha', 'paida', 'paidal', 'maidan',
  'sainik', 'vaise', 'jaise', 'aise', 'bhaiyon', 'gaai', 'aai', 'jaai',
  'aurat', 'aur', 'kaun', 'kaunsa', 'daud', 'daudna', 'chauka', 'nauka',
  'maut', 'taubah', 'chaubis', 'paudha',
  'aana', 'aaya', 'aayi', 'aage', 'aadmi', 'aaj', 'aasan', 'aaraam',
  'baat', 'baap', 'baal', 'baadal', 'kaam', 'kaagaz', 'saal', 'maal',
  'paani', 'raat', 'haath', 'saath', 'jaan', 'jaana', 'maan', 'shaan',
  'meetha', 'peeche', 'seedha', 'teen', 'been', 'cheez', 'jeet', 'jeetna',
  'neend', 'deen', 'heera', 'keemat', 'zameen', 'mahine',
  'doosra', 'doodh', 'pooja', 'poora', 'roop', 'soorat', 'noor', 'zaroor',
  'bahut', 'boond', 'choona', 'joota', 'loota', 'mooch', 'toota',
  // -- everyday vocabulary --
  'namaste', 'dhanyawad', 'maaf', 'maafi', 'kripya', 'swagat',
  'behen', 'behan', 'maa', 'pita', 'mata', 'beta', 'beti', 'dada', 'dadi',
  'nana', 'nani', 'chacha', 'chachi', 'mama', 'mami', 'bua', 'mausi',
  'dost', 'dosti', 'pyaar', 'mohabbat', 'ishq', 'dil', 'dilse',
  'sar', 'muh', 'naak', 'kaan', 'pair', 'ungli', 'daant', 'gala',
  'din', 'raat', 'subah', 'dopahar', 'saptah', 'mahina', 'varsh', 'samay',
  'waqt', 'abhi', 'kal', 'parso', 'jaldi', 'hamesha', 'kabhi',
  'jagah', 'sheher', 'gaon', 'desh', 'duniya', 'rasta', 'safar', 'gaadi',
  'ladka', 'ladki', 'bachcha', 'bachche', 'log', 'logon',
  'accha', 'achha', 'bura', 'bada', 'lamba', 'naya', 'purana', 'sundar',
  'garam', 'khatta', 'halka', 'tez', 'sasta', 'mehnga',
  'kya', 'kyun', 'kahan', 'kab', 'kitna', 'kitne', 'yeh', 'woh',
  'main', 'tum', 'aap', 'hum', 'mera', 'tera', 'uska', 'hamara', 'tumhara',
  'karna', 'kiya', 'karta', 'karte', 'hona', 'hua', 'hui', 'raha', 'rahi',
  'lena', 'liya', 'dena', 'diya', 'jana', 'gaya', 'gayi', 'bolna', 'bola',
  'sunna', 'suna', 'sunai', 'samajh', 'samjhana', 'sochna', 'socha',
  'milna', 'mila', 'milai', 'banana', 'banai', 'banaya', 'uthana', 'uthai',
  'padhai', 'padhna', 'padha', 'lagana', 'lagai', 'lagta', 'chalana',
  'zaroorat', 'koshish', 'madad', 'sawaal', 'jawab', 'galti', 'sahi',
  'kitab', 'kalam', 'naukri', 'bazaar',
  'khareedna', 'bechna', 'daam', 'mol', 'hisaab', 'ginti',
  'ek', 'do', 'char', 'paanch', 'chhah', 'saat', 'aath', 'nau', 'das',
  // -- Urdu-leaning everyday vocabulary --
  'inshallah', 'mashallah', 'dua', 'ibadat', 'namaz', 'roza',
  'zindagi', 'khayal', 'tajurba', 'mehfil', 'adaab', 'tashreef',
  // -- words that fold directly onto a hi-latn root, plus their compounds --
  // (the compounds must stay clean without being safelisted)
  'shaala', 'shala', 'shaalaa', 'shalaa', 'vidyashaala', 'dharamshala',
  'chhoot', 'achhoot', 'chhootna',
  'gandh', 'sugandh', 'durgandh', 'gandhak', 'sugandhit',
  'lodha', 'lodhi', 'bodha', 'sodha',
  'phool', 'phools', 'phoolon', 'phoolwala', 'phoolgobhi',
  // -- Indian proper nouns / surnames that brush the fold rules --
  'gandhi', 'gandhinagar', 'choudhary', 'chaudhary', 'chaudhry', 'randhawa',
  'bhosale', 'bandhan', 'sindhu', 'skandha', 'madhav', 'bhandari',
  // -- cross-language control set --
  // Everyday NON-Hindi words that the Hinglish folds rewrite onto a foreign
  // root (`pushy`->`pusy`->pussy, `nigh`->`nig`->nigger, `theta`->`teta`->
  // tetas). They are clean only because the transliteration tier is scoped to
  // TRANSLITERATION_LANGUAGE in matcher.ts. If that gate is ever removed or
  // widened, these light up first.
  'pushy', 'nigh', 'theta', 'thetas', 'jeez', 'cool', 'cools', 'boom',
  'farthing', 'neep', 'neeps', 'deek', 'scath', 'cauk', 'coonty', 'pithos',
  'leear', 'leears', 'fouth', 'chutney', 'chutneys',
];

const seen = new Set();
const hits = [];
let scanned = 0;

for (const w of CORPUS) {
  if (seen.has(w)) continue;
  seen.add(w);
  scanned++;
  for (const r of verlux.detect(w)) {
    hits.push({ word: w, ...r });
  }
}

console.log(`scanned ${scanned} unique benign Hinglish words`);
if (!hits.length) {
  console.log('\nno false positives');
  process.exit(0);
}

console.log(`\n${hits.length} false positive(s):\n`);
const byMatch = new Map();
for (const h of hits) {
  const k = `${h.matched} (${h.language}/${h.severity}/${h.category})`;
  if (!byMatch.has(k)) byMatch.set(k, []);
  byMatch.get(k).push(`${h.word} [${h.matchType} ${h.confidence}]`);
}
for (const [k, ws] of [...byMatch].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  -> ${k}`);
  for (const w of ws) console.log(`       ${w}`);
}
process.exitCode = 1;
