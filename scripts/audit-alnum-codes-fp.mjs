/**
 * False-positive audit over alphanumeric codes — tokens that mix letters and
 * digits without being l33t: postcodes, flight numbers, quantities, product
 * models, hashes, booking references.
 *
 * The other audits scan word lists, so they cannot surface this class: a
 * code whose digits the normalizer decodes as l33t (6→g, 1→i, 5→s, 0→o, …)
 * until it lands on a dictionary key. `6DU` (a UK postcode inward code)
 * decoded to `gdu`, an alias of the Hinglish insult `gandu`; `N16` (a London
 * postcode district) decoded to `nig`; `900k` decoded to `gook`.
 * `looksLikeCode` in normalizer.ts is the guard.
 *
 * Every corpus below except EXHAUSTIVE is BENIGN and must stay clean; the
 * script exits 1 if any token in them is flagged. Corpora are generated, with
 * a fixed seed for the sampled ones, so runs are reproducible. Run after any
 * change to the normalizer's substitution maps or the code guard:
 *   npm run build && node scripts/audit-alnum-codes-fp.mjs
 *
 * The username corpus needs the English wordlist and is skipped without it:
 *   npm install --no-save an-array-of-english-words
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { verlux } = require('../dist/cjs/index.js');

// mulberry32 — tiny seeded PRNG so sampled corpora are stable across runs.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(0x5eed);
const pick = s => s[Math.floor(rand() * s.length)];
const randStr = (alphabet, n) => Array.from({ length: n }, () => pick(alphabet)).join('');
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const DIGITS = '0123456789';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = UPPER + DIGITS;

// ── UK postcodes ───────────────────────────────────────────────────────────
const UK_AREAS = (
  'AB AL B BA BB BD BH BL BN BR BS BT CA CB CF CH CM CO CR CT CV CW DA DD DE ' +
  'DG DH DL DN DT DY E EC EH EN EX FK FY G GL GU GY HA HD HG HP HR HS HU HX ' +
  'IG IM IP IV JE KA KT KW KY L LA LD LE LL LN LS LU M ME MK ML N NE NG NN NP ' +
  'NR NW OL OX PA PE PH PL PO PR RG RH RM S SA SE SG SK SL SM SN SO SP SR SS ' +
  'ST SW SY TA TD TF TN TQ TR TS TW UB W WA WC WD WF WN WR WS WV YO ZE'
).split(' ');
const UK_INWARD_LETTERS = 'ABDEFGHJLNPQRSTUWXYZ';
// Only central-London districts take a sub-district letter (`SW1A`, `EC1V`).
const UK_SUBDISTRICTS = ['EC1', 'EC2', 'EC3', 'EC4', 'WC1', 'WC2', 'W1', 'SW1', 'SE1', 'E1', 'N1', 'NW1'];
const UK_SUBDISTRICT_LETTERS = 'ABCDEFGHJKMNPRSTUVWXY';
function* ukPostcodes() {
  const outward = [];
  for (const area of UK_AREAS) for (const d of range(0, 99)) outward.push(`${area}${d}`);
  for (const sd of UK_SUBDISTRICTS) for (const l of UK_SUBDISTRICT_LETTERS) outward.push(`${sd}${l}`);
  const inward = [];
  for (const d of DIGITS) for (const a of UK_INWARD_LETTERS) for (const b of UK_INWARD_LETTERS) inward.push(`${d}${a}${b}`);
  yield* outward;
  yield* inward;
  for (let i = 0; i < 100_000; i++) {
    const o = pick(outward), n = pick(inward);
    yield `${o} ${n}`;
    yield `${o}${n}`;
  }
}

// ── Canadian postal codes (letters D F I O Q U never used) ──────────────────
const CA_FIRST = 'ABCEGHJKLMNPRSTVXY';
const CA_LETTER = 'ABCEGHJKLMNPRSTVWXYZ';
function* canadianPostcodes() {
  const fsa = [], ldu = [];
  for (const a of CA_FIRST) for (const d of DIGITS) for (const b of CA_LETTER) fsa.push(`${a}${d}${b}`);
  for (const d of DIGITS) for (const l of CA_LETTER) for (const e of DIGITS) ldu.push(`${d}${l}${e}`);
  yield* fsa;
  yield* ldu;
  for (let i = 0; i < 100_000; i++) {
    const f = pick(fsa), l = pick(ldu);
    yield `${f} ${l}`;
    yield `${f}${l}`;
  }
}

// ── Irish Eircodes: routing key + 4-char unique identifier ─────────────────
// Identifiers are drawn with at least one digit: an all-letter identifier
// that spells a word (`TARD`) is a hit with no digit decoding involved, so it
// is outside what this audit measures.
const EIR_ID = '0123456789ACDEFHKNPRTVWXY';
const withDigit = gen => { let s; do s = gen(); while (!/[0-9]/.test(s)); return s; };
const eircode = () => [
  rand() < 0.05 ? 'D6W' : `${pick(EIR_ID.slice(10))}${randStr(DIGITS, 2)}`,
  withDigit(() => randStr(EIR_ID, 4)),
];
function* eircodes() {
  for (let i = 0; i < 100_000; i++) yield eircode().join(' ');
}
function* eircodesUnspaced() {
  for (let i = 0; i < 100_000; i++) yield eircode().join('');
}

// ── Flight numbers: 2-char airline designator + 1–4 digits ─────────────────
// 3–4 digit flights have a recognisable format; 1–2 digit ones (`4S55`) are
// as short as l33t and share its shape, so they get the random budget.
const airline = () => { let a; do a = randStr(ALNUM, 2); while (!/[A-Z]/.test(a)); return a; };
function* flightNumbers() {
  for (let i = 0; i < 200_000; i++) yield `${airline()}${100 + Math.floor(rand() * 9900)}`;
}
function* shortFlightNumbers() {
  for (let i = 0; i < 100_000; i++) yield `${airline()}${1 + Math.floor(rand() * 99)}`;
}

// ── Quantities, units, ordinals, times, decades ────────────────────────────
const UNITS = (
  'k K m M b bn kg g mg km cm mm mph kph kmh ms s sec h hr hrs min mins gb GB ' +
  'mb MB tb TB kb KB p px pt em x am pm yo lbs lb oz ft in l ml v V w W kw kW ' +
  'kwh kWh hz Hz ghz GHz mhz MHz fps rpm mAh dB bps kbps mbps Mbps pcs yrs'
).split(' ');
function* quantities() {
  const numbers = [...range(1, 1000), 1200, 1500, 2000, 2500, 5000, 9000, 10000, 50000, 100000, 500000];
  for (const n of numbers) {
    for (const u of UNITS) yield `${n}${u}`;
    const r = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
    yield `${n}${r}`;
    yield `${n}s`; // decades, plurals: 90s, 1990s
  }
  for (const n of range(1, 12)) for (const m of ['am', 'pm', 'AM', 'PM']) yield `${n}${m}`;
  for (const n of [3, 6, 9, 12, 18, 24]) for (const s of ['mo', 'mos', 'M', 'wk', 'wks', 'd', 'yr']) yield `${n}${s}`;
}

// ── Prefix letter + number: versions, quarters, sizes, models, grades ──────
function* prefixedNumbers() {
  const prefixes = [...UPPER, ...UPPER.toLowerCase(), 'FY', 'Q', 'H', 'V', 'Rev', 'No', 'Ch', 'Ep', 'Pt', 'Vol', 'Gen'];
  for (const p of prefixes) for (const n of range(0, 999)) yield `${p}${n}`;
  for (const q of range(1, 4)) for (const y of range(19, 30)) {
    yield `Q${q}FY${y}`; yield `FY${y}Q${q}`; yield `${2000 + y}Q${q}`; yield `Q${q}${2000 + y}`;
  }
}

// ── Product models, tech and chemistry tokens ──────────────────────────────
const NAMED = (
  'A55 A54 A35 A15 S24 S23 S10e M2 M3 i3 i5 i7 i9 PS4 PS5 XB1 3DS N64 R2D2 C3PO 4K 8K 1080p 720p ' +
  '2160p 5G 4G 3G LTE H264 H265 x86 x64 ARM64 AMD64 RTX4090 RTX3080 GTX1080 B650 Z790 X570 ' +
  'USB3 MP3 MP4 A4 A3 B5 F1 F150 G7 G20 B52 F16 F35 AK47 M16 COVID19 SARS2 H1N1 H5N1 ' +
  'H2O CO2 NO2 SO2 SO4 CH4 NH3 O3 H2SO4 C6H12O6 NaCl HCl CaCO3 Fe2O3 ' +
  'Win7 Win10 Win11 iOS17 Android14 Py3 ES6 ES2022 IPv4 IPv6 HTTP2 OAuth2 SHA256 MD5 AES256 ' +
  'Web3 B2B B2C P2P 24x7 365d 4x4 2FA MFA2 K8s i18n l10n a11y'
).split(' ');

// ── Random IDs: hex, UUIDs, booking/order refs ─────────────────────────────
// A standalone 4-char hex fragment (`b17e`) has exactly the shape of l33t, so
// it is not sampled on its own; inside a UUID its context marks it as a code.
function* hexIds() {
  const hex = '0123456789abcdef';
  for (let i = 0; i < 100_000; i++) yield withDigit(() => randStr(hex, pick([6, 7, 8, 12, 16])));
  for (let i = 0; i < 20_000; i++) yield randStr(hex, 40);
  for (let i = 0; i < 50_000; i++) {
    yield [8, 4, 4, 4, 12].map(n => randStr(hex, n)).join('-');
  }
}
function* alnumRefs() {
  for (let i = 0; i < 200_000; i++) {
    yield withDigit(() => randStr(ALNUM, 5 + Math.floor(rand() * 6)));
  }
}

// ── Usernames: English word + digits (needs the wordlist) ──────────────────
function loadWords() {
  try { return require('an-array-of-english-words'); } catch { return null; }
}
const USER_SUFFIXES = ['1', '2', '7', '12', '69', '99', '123', '2024'];
const USER_PREFIXES = ['1', '4', '99'];

// ───────────────────────────────────────────────────────────────────────────
// [name, generator, budget]. Budget 0: every token must be clean. A non-zero
// budget is a maximum hit RATE, for corpora of random characters that now and
// then land on a l33t spelling outright — `W08ISP0RN` contains `P0RN`, an
// unspaced Eircode `D00K1ED` reads `dookie`, flight `4S55` reads `4ss`. Those
// are indistinguishable from l33t by shape, so the residue is bounded rather
// than forced to zero.
const RANDOM_BUDGET = 1 / 10_000;
const CORPORA = [
  ['UK postcodes', ukPostcodes, 0],
  ['Canadian postcodes', canadianPostcodes, 0],
  ['Irish Eircodes', eircodes, 0],
  ['Eircodes, unspaced', eircodesUnspaced, RANDOM_BUDGET],
  ['flight numbers', flightNumbers, 0],
  ['flight numbers, short', shortFlightNumbers, RANDOM_BUDGET],
  ['quantities/ordinals', quantities, 0],
  ['prefixed numbers', prefixedNumbers, 0],
  ['named models/tech', function* () { yield* NAMED; }, 0],
  ['hex IDs/UUIDs', hexIds, 0],
  ['random alnum refs', alnumRefs, RANDOM_BUDGET],
];

let failures = 0;
for (const [name, gen, budget] of CORPORA) {
  const seen = new Set();
  const hits = new Map();
  for (const token of gen()) {
    if (seen.has(token)) continue;
    seen.add(token);
    const r = verlux.detect(token);
    if (r.length) hits.set(token, r.map(x => `${x.matched}/${x.matchType}`).join(','));
  }
  const failed = hits.size > budget * seen.size;
  if (failed) failures += hits.size;
  const limit = budget ? ` (budget ${Math.floor(budget * seen.size)})` : '';
  console.log(`${failed ? 'FAIL' : 'ok  '} ${name.padEnd(22)} ${seen.size.toString().padStart(8)} tokens, ${hits.size} flagged${limit}`);
  for (const [t, m] of [...hits].slice(0, 25)) console.log(`       ${t} → ${m}`);
}

const words = loadWords();
if (!words) {
  console.log('skip usernames               (npm install --no-save an-array-of-english-words)');
} else {
  // FP only when the digits introduced the hit: the bare word is clean.
  const hits = new Map();
  let scanned = 0;
  for (const w of words) {
    if (w.length < 3 || w.length > 8 || verlux.detect(w).length) continue;
    for (const t of [...USER_SUFFIXES.map(s => w + s), ...USER_PREFIXES.map(p => p + w)]) {
      scanned++;
      const r = verlux.detect(t);
      if (r.length) hits.set(t, r.map(x => `${x.matched}/${x.matchType}`).join(','));
    }
  }
  // Informational, not a failure: a single digit on the edge of a word is the
  // shape deliberately left to l33t decoding for whole-word matches (`5lut`,
  // `whor3`, `pak1`), so `pack1` → `paki` is the accepted cost. Anything else
  // here is a lead.
  const edge = [...hits].filter(([t]) => /^[0-9][a-z]+$|^[a-z]+[0-9]$/.test(t));
  const other = [...hits].filter(([t]) => !/^[0-9][a-z]+$|^[a-z]+[0-9]$/.test(t));
  failures += other.length;
  console.log(`${other.length ? 'FAIL' : 'ok  '} ${'usernames'.padEnd(22)} ${scanned.toString().padStart(8)} tokens, ${other.length} flagged (+${edge.length} single-edge-digit, accepted)`);
  for (const [t, m] of other.slice(0, 25)) console.log(`       ${t} → ${m}`);
  for (const [t, m] of edge.slice(0, 25)) console.log(`       (edge) ${t} → ${m}`);
}

console.log(failures ? `\n${failures} false positive(s).` : '\nAll corpora clean.');
process.exitCode = failures ? 1 : 0;
