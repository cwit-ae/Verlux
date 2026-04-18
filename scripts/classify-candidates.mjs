#!/usr/bin/env node
// Read scripts/staging/candidates.json and produce a classified,
// deduplicated, FP-safe entry list ready to be merged into en.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const IN  = resolve(ROOT, 'scripts/staging/candidates.json');
const OUT = resolve(ROOT, 'scripts/staging/final-entries.json');

const data = JSON.parse(readFileSync(IN, 'utf8'));
const existingEnTs = readFileSync(resolve(ROOT, 'src/dictionaries/en.ts'), 'utf8');

const existingSet = new Set();
{
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'/g;
  let m;
  while ((m = re.exec(existingEnTs)) !== null) {
    existingSet.add(m[1].toLowerCase().trim());
  }
}

const hasDigit         = (s) => /[0-9]/.test(s);
const hasNonAscii      = (s) => /[^\x00-\x7f]/.test(s);
const hasPunctuation   = (s) => /[^a-z ]/.test(s);
const hasRepeatRun     = (s) => /(.)\1{2,}/.test(s);
const isTooShort       = (s) => s.replace(/\s+/g, '').length < 3;

const existingContainsStem = (s) => {
  const core = s.replace(/\s+/g, '');
  const bases = [
    core.replace(/(es|s)$/, ''),
    core.replace(/(ing|ed|er|ers)$/, ''),
  ].filter((x) => x && x !== core && x.length >= 3);
  return bases.some((b) => existingSet.has(b));
};

// Hard drops: clinical/descriptive/surname FP risks, or already-covered obfuscations
// that the engine normalizer will handle.
const DROP = new Set([
  // Too clinical / descriptive / household
  'balls', 'ballsack', 'butt', 'breasts', 'nipple', 'nipples', 'nude', 'nudity',
  'sexy', 'sexo', 'erotic', 'erotism', 'escort', 'hardcore', 'humping', 'lust', 'lusting',
  'intercourse', 'lovemaking', 'playboy', 'kinky', 'kinkster', 'pubes', 'rectum',
  'swinger', 'topless', 'undressing', 'genitals', 'panties', 'panty', 'eunuch',
  'masochist', 'menage a trois', 'missionary position', 'mound of venus',
  'fecal', 'vibrator', 'homoerotic', 'pornography', 'phone sex', 'gay sex',
  'foot fetish', 'leather restraint', 'leather straight jacket', 'dry hump',
  'golden shower', 'threesome', 'group sex', 'hardcoresex', 'hard core',
  // Surname / brand / common-word FP risk
  'cox', 'santorum', 'twinkie', 'skeet',
  // Ambiguous short/common
  'jerk', 'pawn', 'nob', 'dink', 'dinks', 'flange', 'hoer', 'hoare', 'kooch', 'kootch',
  // Spanish / Portuguese entries — should not go in en.ts
  'bastardo', 'buceta', 'boiolas', 'dirsa', 'fanyy',
  // Brand / meme references too niche
  'babeland', 'bangbros', 'pimpis', 'santorum',
  // Dangerous-sounding but not profanity
  'how to kill', 'how to murder',
  // CSEM-adjacent phrases too generic to catch safely
  'girls gone wild', 'one cup two girls', 'one guy one jar', 'mr hands',
  'alabama hot pocket', 'alaskan pipeline', 'blue waffle', 'cleveland steamer',
  'dirty pillows', 'dirty sanchez', 'donkey punch', 'hot carl', 'lemon party',
  'jelly donut', 'nsfw images', 'dp action', 'chocolate rosebuds',
  // Explicit but clinical / acronym
  'dvda', 'pthc', 'bbw',
  // Items that are verbose plural/gerund/past of something already existing
  'asses', 'bitches', 'bitcher', 'bitchers', 'bitching', 'blowjobs', 'cocks',
  'cumming', 'cunnilingus', 'fucked', 'fuckin', 'fucking', 'fucktards',
  'pissing', 'raping', 'rapist', 'shitty',
  // Generic household / anatomy
  'big black', 'big breasts', 'big knockers', 'big tits',
  'blonde action', 'blonde on blonde action', 'brunette action',
  'booty call', 'bullet vibe', 'bunny fucker',
  'auto erotic', 'autoerotic', 'ball gag', 'ball gravy', 'ball kicking',
  'ball licking', 'ball sack', 'ball sucking', 'baby batter', 'baby juice',
  'barely legal', 'black cock', 'blow your load', 'grope', 'milf', 'mature',
  'beaver cleaver', 'beaver lips', 'brown showers', 'bareback', 'barenaked',
  // CSEM acronyms — dangerous to partial-match (may appear in file hashes, etc)
  '2g1c', '2 girls 1 cup',
]);

// Obfuscation alias: maps candidate → existing dictionary root that should absorb it.
// If engine normalizer already catches these (it handles l33t, ph→f, kk→ck etc),
// we simply drop them to keep the dictionary tight.
const OBFUSCATION_RE = /^(ph|f)(u|oo|o|uc|ook|uk|uq|kk?|k)(k|c|q)?(ed|in|ing|er|ers|a|s)?$/i;
const MOTHAFUCK_RE  = /^m(u|o)(o?th|th?)a+f.{0,6}(ed|er|in|ing|s|ers|ings)?$/i;

// Keyword buckets — order matters (first hit wins).
const BUCKETS = [
  // Racial / ethnic / religious slurs
  { pat: /^(abeed|africoon|arabush|boonga|coons?|darkies?|jiggab|jigab|jigger|pickaninn|sambo|spook|wetback|paki|pakis|raghead|towelhead|honk(e)?y|cracker|gook|chink|chinc|slanteye|beaner|spic|wop|kraut|dago|guido|polack|nipp?|jap|kike|zipperhead|mick|redskin|squaw|injun|abbo|coolie|oreo|niglet|nig.?nog|niggaz?)/, cat: 'slur', sev: 'high' },
  // Homophobic / transphobic slurs
  { pat: /^(fagg?|faggot|fags|faggs|fagbag|fagging|faggitt|fagtard|dyke|tranny|shemale|twink|bulldyke|poofter?|sodom(ize|y)|gaylord|gaytard|heshe|gaywad|gayass|gaysex|gaybob|gaydo)/, cat: 'slur', sev: 'high' },
  // Hate / ideology
  { pat: /(nazi|swastika|holocaust|genocide|kkk|klan)/, cat: 'hate', sev: 'high' },
  // CSEM / pedophilia
  { pat: /(pedo|paedo|nambla|jailbait|lolita|shota|pedobear|loli)/, cat: 'sexual', sev: 'high' },
  // Sexual violence
  { pat: /(daterape|rape|molest)/, cat: 'threat', sev: 'high' },
  // Compound insults (higher priority than generic sexual)
  { pat: /^(bampot|douche|douchebag|douchewaffle|doosh|duche|doochbag|dipshit|dumbass|dumbshit|dumass|dumshit|dumbfuck|fuckface|fuckhead|fuckheads|fuckhole|fucktard|fucktwat|fuckup|fuckwad|fuckwit|fukwit|fukwhit|fuckwhit|fukkin|goddamn(it|ed)?|jackass|jerkass|numbnuts|numbskull|peckerwood|pissant|pissflaps|pissoff|punkass|scumbag|shitbag|shitbagger|shitbrain|shitbrains|shitbreath|shiteater|shitfull|shitheel|shitstain|shitstick|shitstorm|shittiest|twathead|twatlips|twatty|twatwaffle|wankstain|wankjob|wiseass)/, cat: 'insult', sev: 'medium' },
  // Explicit compounds using ass/cock/cum/cunt/dick/fuck/shit/tit as stems
  { pat: /^(ass(bag|bandit|banger|bite|cock|cracker|face|fucker|fukka|goblin|head|hopper|jacker|lick|licker|monkey|munch|muncher|pirate|whole|shole|sucker)|arrse)/, cat: 'sexual', sev: 'medium' },
  { pat: /^(cock(bite|burger|face|fucker|head|jockey|knoker|master|mongler|mongruel|monkey|munch|muncher|nose|nugget|shit|smith|smoke|smoker|sniffer|sucker|sucking|suka))/, cat: 'sexual', sev: 'medium' },
  { pat: /^(cum(bubble|dumpster|guzzler|jockey|shot|slut|stain|tart))/, cat: 'sexual', sev: 'medium' },
  { pat: /^(cunt(bag|face|hair|hole|lick|licker|licking|rag|slut))/, cat: 'sexual', sev: 'medium' },
  { pat: /^(dick(bag|beater|face|fuck|fucker|head|hole|juice|milk|monger|slap|sucker|sucking|tickler|wad|weasel|weed|wod))/, cat: 'sexual', sev: 'medium' },
  { pat: /^(shit(dick|face|faced|fuck|head|holes?|house|kicker|load|stain|stick|ter|ters|ting|tings|blimp|bag|cunt))/, cat: 'sexual', sev: 'medium' },
  { pat: /^(tit(ty|tyfuck|tyfucker|ties|es))/, cat: 'sexual', sev: 'low' },
  // Fetish / explicit acts (non-slur)
  { pat: /^(anilingus|acrotomophilia|apeshit|blumpkin|buttcheeks?|buttplug|bunghole|bukkake|bondage|bdsm|birdlock|carpetmuncher|clunge|coochie|coochy|coprolagnia|coprophilia|cornhole|cunnie|cunilingus|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|cyberfucks|dendrophilia|dildos|dingleberr|dogg[iy]style|dolcett|domination|dominatrix|dommes|ecchi|ejaculates?|ejaculating|ejaculation|felcher|felching|feltch|femdom|figging|fingerbang|fingering|fingerfuck|fistfuck|fisting|footjob|frotting|fudgepacker|futanari|gangbang|gassyass|goatcx|goatse|gokkun|goodpoop|goregasm|guro|handjob|hentai|hotsex|incest|jackoff|jerkoff|jizz|juggs|kinbaku|knobbing|knobend|knobhead|knobjockey|knobjokey|lubejob|minge|muffdiv|nawashi|niglet|nimphomania|nympho|nymphomania|octopussy|omorashi|orgasm|orgy|paedophile|pecker|peckerhead|penisbanger|penisfucker|penispuffer|phalli|pisspig|ponyplay|poon|poonani|poonany|poontang|punany|poopchute|porno|queaf|queef|quim|rimjob|rimming|sadism|schlong|scissoring|scrote|scrotum|shag|shagger|shaggin|shagging|shibari|shiz|shiznit|shota|skank|smeg|smegma|smut|snatch|snowballing|splooge|spooge|spunk|strapon|strappado|throating|tribadism|tubgirl|tushy|urophilia|vorarephilia|voyeur|vulva|wank|yaoi|yiffy|zoophilia|fannyfucker|cooter|cummer|dookie|fook|fooker|fux|hoar|kawk|kock|kondum|kondums|kummer|kumming|kunilingus|muff|muffdiving|mothafuck|mothafuckaz|mothafuckers|mothafuckin|mothafucks|muthafecker|muthafuckker|nob(head|jocky|jokey)?|nobhead|nobjocky|nobjokey|panooch|phukked|phukking|phuq|pigfucker|fagbag|fagg|fagging|faggitt|faggs|fagtard)/, cat: 'sexual', sev: 'low' },
  // Drug
  { pat: /^(cocaine|crackhead|meth|heroin|viagra)/, cat: 'drug', sev: 'medium' },
];

function classify(word) {
  for (const b of BUCKETS) {
    if (b.pat.test(word)) return { category: b.cat, severity: b.sev };
  }
  return null;
}

// Partial-match policy:
//  - short words (<5) → false (stems too easily embedded in innocents)
//  - multi-word phrases → false (phrase engine handles these)
//  - otherwise default true; override to false for known ambiguous stems
const AMBIGUOUS_PARTIAL = new Set([
  'muff', 'poon', 'shiz', 'shag', 'cipa', 'dink', 'fook', 'fux', 'kock', 'kawk',
  'guro', 'yaoi', 'nob',
]);
function shouldAllowPartial(word) {
  if (word.includes(' ')) return false;
  if (word.length < 5)   return false;
  if (AMBIGUOUS_PARTIAL.has(word)) return false;
  return true;
}

const kept = [];
const dropped = [];

for (const { word, sources } of data.candidates) {
  const w = word.toLowerCase().trim();

  const reasons = [];
  if (hasDigit(w))             reasons.push('digit-obfuscation');
  if (hasNonAscii(w))          reasons.push('non-ascii');
  if (isTooShort(w))           reasons.push('too-short');
  if (hasRepeatRun(w))         reasons.push('repeat-run');
  if (hasPunctuation(w) && !/^[a-z]+( [a-z]+)+$/.test(w)) reasons.push('punctuation');
  if (DROP.has(w))             reasons.push('manual-drop');
  if (existingContainsStem(w)) reasons.push('plural-of-existing');
  if (OBFUSCATION_RE.test(w))  reasons.push('fuck-obfuscation-normalizer-handles');
  if (MOTHAFUCK_RE.test(w))    reasons.push('motherfuck-obfuscation-normalizer-handles');

  if (reasons.length) {
    dropped.push({ word: w, reasons, sources });
    continue;
  }

  const klass = classify(w);
  if (!klass) {
    dropped.push({ word: w, reasons: ['unclassified'], sources });
    continue;
  }

  const allowPartialMatch = shouldAllowPartial(w);
  kept.push({
    word: w,
    language: 'en',
    severity: klass.severity,
    category: klass.category,
    allowPartialMatch,
    sources,
  });
}

const words   = kept.filter((e) => !e.word.includes(' '));
const phrases = kept.filter((e) =>  e.word.includes(' '));

const summary = {
  kept: kept.length,
  dropped: dropped.length,
  words: words.length,
  phrases: phrases.length,
  byCategory: {},
  bySeverity: {},
};
for (const e of kept) {
  summary.byCategory[e.category] = (summary.byCategory[e.category] || 0) + 1;
  summary.bySeverity[e.severity] = (summary.bySeverity[e.severity] || 0) + 1;
}

writeFileSync(OUT, JSON.stringify({ summary, words, phrases, dropped }, null, 2));

console.log('Kept:', kept.length, '(words:', words.length, ', phrases:', phrases.length, ')');
console.log('Dropped:', dropped.length);
console.log('By category:', summary.byCategory);
console.log('By severity:', summary.bySeverity);
console.log('Wrote', OUT);
