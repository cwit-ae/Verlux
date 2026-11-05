/**
 * Text normalizer — comprehensive l33t speak decoder, diacritics stripper,
 * separator remover, and obfuscation handler.
 *
 * Algorithm: Single-pass greedy longest-match for multi-char sequences,
 * followed by single-char substitution, repeat collapse, and separator strip.
 *
 * Performance: O(n) for single-char, O(n * maxSeqLen) for multi-char where
 * maxSeqLen is bounded at 4. Pre-sorted sequences by length (longest first)
 * ensure greedy matching is correct.
 */

// ─────────────────────────────────────────────
// MULTI-CHARACTER L33T SEQUENCES
// Sorted longest-first for greedy matching
// ─────────────────────────────────────────────
const MULTI_CHAR_SEQUENCES: [string, string][] = [
  // 4-char
  ['\\/\\/', 'w'],     // \/\/ → w
  ['|\\\\|', 'n'],    // |\\| → n  (escaped for JS)
  ['/\\/\\', 'n'],    // /\/\ → n
  // 3-char
  ['/-\\', 'a'],       // /-\ → a
  ['|-|', 'h'],        // |-| → h
  ['|_|', 'u'],        // |_| → u
  ['|\\|', 'n'],       // |\| → n
  ['/\\/', 'n'],       // /\/ → n
  ['><', 'x'],         // >< → x
  ['}{', 'x'],         // }{ → x
  // 2-char
  ['/\\', 'a'],        // /\ → a
  ['\\/', 'v'],        // \/ → v
  ['|)', 'd'],         // |) → d
  ['|<', 'k'],         // |< → k
  ['|3', 'b'],         // |3 → b
  ['|*', 'p'],         // |* → p
  ['|o', 'p'],         // |o → p
  ['|2', 'r'],         // |2 → r
  ['|=', 'f'],         // |= → f
  ['|_', 'l'],         // |_ → l
  ['_|', 'j'],         // _| → j
  ['/<', 'k'],         // /< → k
  ['/2', 'r'],         // /2 → r
  ['()', 'o'],         // () → o
  ['[]', 'd'],         // [] → d
  ['[)', 'd'],         // [) → d
  ['0_', 'q'],         // 0_ → q
  ['`/', 'y'],         // `/ → y
  ['~/', 'z'],         // ~/ → z
  ['13', 'b'],         // 13 → b
  ['ph', 'f'],         // ph → f
  ['vv', 'w'],         // vv → w
  ['//', 'n'],         // // → n
].sort((a, b) => b[0].length - a[0].length) as [string, string][];  // Sort longest-first

// Build a Set of first chars for quick pre-filter
const MULTI_FIRST_CHARS = new Set(MULTI_CHAR_SEQUENCES.map(s => s[0][0]));

// The same table minus every sequence that involves a digit (`13`, `|3`,
// `|2`, `/2`, `0_`), used when digits are kept literal — see `looksLikeCode`.
const MULTI_CHAR_SEQUENCES_NO_DIGITS = MULTI_CHAR_SEQUENCES.filter(
  ([pattern]) => !/[0-9]/.test(pattern)
);
const MULTI_FIRST_CHARS_NO_DIGITS = new Set(
  MULTI_CHAR_SEQUENCES_NO_DIGITS.map(s => s[0][0])
);

// ─────────────────────────────────────────────
// SINGLE-CHARACTER SUBSTITUTION MAP
// ─────────────────────────────────────────────
const SINGLE_MAP: Record<string, string> = {
  // Numbers → letters
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',

  // Common symbol substitutions
  '@': 'a',
  '$': 's',
  '§': 's',
  '!': 'i',
  '|': 'i',
  '+': 't',
  '†': 't',
  '(': 'c',
  '<': 'c',
  '{': 'c',
  '[': 'c',
  '^': 'a',
  '#': 'h',
  '*': '',   // Strip asterisks (used as censoring: f*ck, p*ssy, s**t)
  '×': 'x',

  // Currency
  '¡': 'i',
  '€': 'e',
  '£': 'l',
  '¥': 'y',

  // Diacritics → base letter
  'ä': 'a', 'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
  'ë': 'e', 'é': 'e', 'è': 'e', 'ê': 'e',
  'ï': 'i', 'í': 'i', 'ì': 'i', 'î': 'i',
  'ö': 'o', 'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
  'ü': 'u', 'ú': 'u', 'ù': 'u', 'û': 'u',
  'ñ': 'n',
  'ç': 'c',
  'ð': 'd',

  // Multi-char diacritics (return multi-char — handled as string concat)
  'ß': 'ss',
  'æ': 'ae',
  'œ': 'oe',
  'þ': 'th',
};

// ─────────────────────────────────────────────
// INVISIBLE UNICODE CHARS REGEX + CONFUSABLES (pre-compiled)
// ─────────────────────────────────────────────
const INVISIBLE_RE = /[\u200B-\u200F\u2028-\u202F\u2060-\u2069\uFEFF\u00AD\u034F\u17B4\u17B5\u180E\uFFF0-\uFFFF]/g;

// Confusables — Cyrillic/Greek codepoints that visually impersonate Latin
// letters. Folded so obfuscated profanity like "fuсk" (Cyrillic U+0441 in
// place of Latin 'c') matches the dictionary. Safe to fold globally because
// every shipped dictionary uses Latin script.
const CONFUSABLES: Record<string, string> = {
  // Cyrillic lower
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p',
  'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i',
  'ј': 'j', 'ѕ': 's', 'ӏ': 'l',
  // Cyrillic upper
  'А': 'A', 'В': 'B', 'Е': 'E', 'Н': 'H',
  'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P',
  'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I',
  'Ј': 'J',
  // Greek lower (τ omitted — collides with legitimate tau usage)
  'α': 'a', 'ο': 'o', 'ρ': 'p', 'ν': 'v',
  'ι': 'i', 'κ': 'k',
  // Greek upper
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z',
  'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M',
  'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T',
  'Υ': 'Y', 'Χ': 'X',
};

// Orphan combining marks — base character + combining strikethrough/overlay/
// dot/etc. is a common obfuscation (e.g. "f̸u̸c̸k̸"). NFKC won't compose these
// because there's no precomposed equivalent for `f` + U+0338. Strip them
// before tokenization so the base letters fuse into one token.
//
// Ranges covered: Combining Diacritical Marks (and Extended/Supplement),
// Combining Marks for Symbols, Combining Half Marks. Excludes Devanagari /
// Arabic / Hebrew combining marks, which sit in their own blocks and belong
// to legitimate words in those scripts.
const COMBINING_MARK_RE = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/;

// ─────────────────────────────────────────────
// ALL-DIGITS SHORT-CIRCUIT
// ─────────────────────────────────────────────
// Pure-digit tokens (e.g. "422", "1337") decode to hallucinated matches via
// SINGLE_MAP (4→a, 2→z, etc.). Skip l33t decoding when the token is all digits.
const ALL_DIGITS_RE = /^\d+$/;

// ─────────────────────────────────────────────
// ALPHANUMERIC-CODE GUARD
// ─────────────────────────────────────────────
const LETTER_RE = /\p{L}|\p{M}/u;

/**
 * Whether a token that mixes letters and digits reads as a code — postcode,
 * road, model or part number, quantity, ID — rather than a l33t-spelled word.
 * Callers keep the digits of such a token literal: no digit→letter decoding,
 * and no lookup of the dictionary's own digit-bearing l33t aliases.
 *
 * The all-digit short-circuit above closes `422` → `azz`; this closes the
 * mixed case, which produced a steady supply of high-severity hits on
 * ordinary codes:
 *
 *   6DU  → (6→g)       → `gdu`   → hi-latn `gandu`   HIGH
 *   N16  → (1→i, 6→g)  → `nig`   → English `nigger`  HIGH   (London postcode)
 *   900k → (9→g, 0→o)  → `gook`  → English `gook`    HIGH   ("900k views")
 *   A55  → (5→s)       → `ass`                              (UK road, Galaxy A55)
 *   J4P  → `j4p`, a listed alias of `jap`               HIGH   (Canadian postal FSA)
 *
 * L33t substitutes digits for letters *inside* a word (`sh1t`, `n1gg3r`,
 * `fagg07`), and heavy l33t can look as random as any code (`n1663r`), so
 * the generic rules are kept narrow and specific formats are recognised by
 * their exact structure instead. A token counts as a code when its core —
 * letters, digits and l33t symbols, separators dropped — mixes letters and
 * digits and:
 *
 *  A. is at most 3 chars, or 4 chars of which 3 are digits. The space is too
 *     small to tell `N1G` (Guelph, ON) from `n1g`, or flight `5H46` from
 *     `5h17`, and codes dominate it.
 *  B. is one letter block and one digit block, with 2 digits and at most 2
 *     letters (`10kg`, `AB05`, `SE15`) or 3+ digits (`600k`, `brat123`,
 *     `dark2024`). Edge l33t never runs 3 substitutions together.
 *  C. is all hex and 6+ chars (`ab33df5` — git SHAs, hash prefixes).
 *  D. matches a known format: a UK or Canadian postcode written without its
 *     space (`LA833DB`, `N5H1T3`), or a flight number with 3+ digits
 *     (`5H1790`).
 *
 * A word with 1–2 digits on one edge (`whor3`, `5lut`, `fagg07`, `chars12`)
 * is still decoded, but only for a whole-word match (`hasEdgeDigits`).
 *
 * Detection of a real word inside a code is unaffected — `fuck99` still hits
 * `fuck` through partial matching — only the digit decoding is withheld.
 * The matcher extends the guard to short tokens that sit inside a larger code
 * (`isCodeContext`). Audited by `scripts/audit-alnum-codes-fp.mjs`.
 */
export function looksLikeCode(token: string): boolean {
  if (!HAS_DIGIT_RE.test(token)) return false;
  const shape = codeShape(token);
  if (shape.digits === 0 || shape.digits === shape.core) return false;
  if (shape.core <= 3 || (shape.core === 4 && shape.digits === 3)) return true;
  if (shape.runs === 2 && (shape.digits >= 3 || (shape.digits === 2 && shape.core <= 4))) {
    return true;
  }
  if (shape.hexOnly && shape.core >= 6) return true;
  return CODE_FORMATS.some(re => re.test(shape.text));
}

// UK postcode areas, and the central-London districts that take a letter.
const UK_AREAS =
  'ab|al|b|ba|bb|bd|bh|bl|bn|br|bs|bt|ca|cb|cf|ch|cm|co|cr|ct|cv|cw|da|dd|de|' +
  'dg|dh|dl|dn|dt|dy|e|ec|eh|en|ex|fk|fy|g|gl|gu|gy|ha|hd|hg|hp|hr|hs|hu|hx|' +
  'ig|im|ip|iv|je|ka|kt|kw|ky|l|la|ld|le|ll|ln|ls|lu|m|me|mk|ml|n|ne|ng|nn|np|' +
  'nr|nw|ol|ox|pa|pe|ph|pl|po|pr|rg|rh|rm|s|sa|se|sg|sk|sl|sm|sn|so|sp|sr|ss|' +
  'st|sw|sy|ta|td|tf|tn|tq|tr|ts|tw|ub|w|wa|wc|wd|wf|wn|wr|ws|wv|yo|ze';
const UK_SUBDISTRICTS =
  'ec[1-4][amnprvy]|wc1[abehnrvx]|wc2[abehnr]|w1[abcdfghjkstuw]|' +
  'sw1[aehpvwxy]|se1p|e1w|n1[cp]|nw1w';

/**
 * Exact formats for D, matched against the lowercased core. Each is specific
 * enough that a l33t spelling fits it only by coincidence — which is why the
 * UK pattern lists real areas and sub-districts instead of `[a-z]{1,2}`
 * (that would read `n1g6er` as `N1G 6ER`). Unspaced Irish Eircodes are not
 * here: their identifier alphabet covers most letters, so the format admits
 * l33t words (`r46head`).
 */
const CODE_FORMATS: readonly RegExp[] = [
  // UK postcode, unspaced: outward code + inward code (9AA).
  new RegExp(
    `^(?:(?:${UK_AREAS})[1-9][0-9]?|${UK_SUBDISTRICTS})[0-9][abdefghjlnpqrstuwxyz]{2}$`
  ),
  // Canadian postal code, unspaced: A9A9A9 (D F I O Q U never used).
  /^[abceghjklmnprstvxy][0-9][abceghjklmnprstvwxyz][0-9][abceghjklmnprstvwxyz][0-9]$/,
  // Flight number: 2-char airline designator + 3–4 digits.
  /^(?:[a-z]{2}|[a-z][0-9]|[0-9][a-z])[0-9]{3,4}$/,
];

/**
 * Whether a whitespace segment is a hex identifier — git SHA, UUID, MAC or
 * IPv6 address, hash: hex digits and separators only, 6+ chars, mixing
 * letters and digits. Its letters are as random as its digits, so a word
 * they spell (`…-86ab-eede-…` → `abeed`, a `caca` group) is coincidence, and
 * the segment is not matched at all.
 */
export function isHexBlob(segment: string): boolean {
  if (!HAS_DIGIT_RE.test(segment)) return false;
  const shape = codeShape(segment);
  return shape.hexOnly && shape.core >= 6 && shape.digits > 0 && shape.digits < shape.core;
}

/**
 * Whether a token is one letter block plus one digit block on either edge
 * (`whor3`, `5lut`, `fagg07`, `chars12`) — the shape `looksLikeCode` leaves to
 * l33t decoding when the digits are few. It is also how usernames and labels
 * look (`bimbashi7`, `faa69`, `99rope`), so callers accept the decoded token
 * only as a whole word: its plain `normalize` form must itself be a
 * dictionary key. The aggressive-collapse variant (`faagg` → `fag`),
 * transliteration, substring and fuzzy tiers keep the digits literal.
 */
export function hasEdgeDigits(token: string): boolean {
  return HAS_DIGIT_RE.test(token) && codeShape(token).runs === 2;
}

/** Core length of a token as `looksLikeCode` counts it. */
export function coreLength(token: string): number {
  return codeShape(token).core;
}

interface CodeShape {
  /** The core, lowercased: letters, digits and l33t symbols, separators dropped. */
  text: string;
  core: number;
  digits: number;
  /** Alternating letter/digit blocks. */
  runs: number;
  hexOnly: boolean;
}

function codeShape(token: string): CodeShape {
  const shape: CodeShape = {
    text: '', core: 0, digits: 0, runs: 0, hexOnly: true,
  };
  let prevDigit: boolean | null = null;
  for (const ch of token) {
    const isDigit = ch >= '0' && ch <= '9';
    // Separators (`.`, `-`, `/`, quotes, …) don't count; l33t symbols that
    // stand in for a letter (`@`, `$`, `*`, `|`, …) count as letters.
    if (!isDigit && !LETTER_RE.test(ch) && !(ch in SINGLE_MAP)) continue;
    shape.text += ch.toLowerCase();
    shape.core++;
    if (isDigit) shape.digits++;
    if (isDigit !== prevDigit) shape.runs++;
    if (!isDigit && !HEX_LETTER_RE.test(ch)) shape.hexOnly = false;
    prevDigit = isDigit;
  }
  return shape;
}

const HEX_LETTER_RE = /^[a-fA-F]$/;
// Cheap pre-check: almost all text has no digits, and none of the guards
// above apply to a token without one.
const HAS_DIGIT_RE = /[0-9]/;

// ─────────────────────────────────────────────
// SEPARATOR REGEX (pre-compiled)
// ─────────────────────────────────────────────
// `\w` is ASCII-only in JS, so it misses Latin-Extended (é, ñ), Devanagari,
// Arabic, CJK — the same ranges the tokenizer treats as word chars. The
// lookarounds below mirror that set so separators are stripped inside
// Unicode words too (e.g. "caf.é" → "café").
const WORD_CLASS = '[a-zA-Z0-9_\\u00C0-\\u024F\\u0900-\\u097F\\u0600-\\u06FF\\u4E00-\\u9FFF\\u3400-\\u4DBF]';
const SEPARATOR_RE = new RegExp(
  `(?<=${WORD_CLASS})[.\\-_*~\\s\`'"\\/\\\\\\[\\]\\(\\)\\{\\}|](?=${WORD_CLASS})`,
  'g'
);

/**
 * Collapse runs of identical characters: any run of length ≥ `minRun` is
 * replaced by `keep` copies of that character. Runs shorter than `minRun` are
 * preserved verbatim.
 *
 * Implemented as a manual scan because the equivalent regex
 * (`/(.)\1{minRun-1,}/g` with `$1.repeat(keep)`) blows V8's regex-engine stack
 * around the 4-million-character mark on a single long run — a remote DoS
 * vector via any unguarded `verlux.detect()` caller. The scan is O(n), uses
 * no recursion, and is trivially bounded by input length.
 *
 * Newline-like characters (`\n`, `\r`, U+2028, U+2029) are deliberately
 * excluded from collapse so semantics match the original `(.)` regex (which
 * does not match newlines without the `s` flag).
 */
function collapseRuns(text: string, minRun: number, keep: number): string {
  if (text.length < minRun) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    // Skip collapse for newline-like chars (\n, \r, U+2028, U+2029) so
    // semantics match the original `(.)` regex, which without the `s` flag
    // does not match newlines.
    const collapsable =
      code !== 0x0a && code !== 0x0d && code !== 0x2028 && code !== 0x2029;
    let j = i + 1;
    if (collapsable) {
      while (j < text.length && text.charCodeAt(j) === code) j++;
    }
    const run = j - i;
    if (run >= minRun) {
      const c = text[i];
      for (let k = 0; k < keep; k++) out += c;
    } else {
      // Preserve the original slice — correct for single chars and runs of
      // newline-like chars that we deliberately did not collapse.
      out += text.slice(i, j);
    }
    i = j;
  }
  return out;
}
/**
 * True iff every codepoint in `s` is plain ASCII (≤ 0x7F). Pure-ASCII inputs
 * cannot contain any of the obfuscation forms `unicodeFold` exists to handle,
 * so this check unlocks fast paths in both `unicodeFold` and `normalize`.
 *
 * Implemented as a tight charCodeAt loop — much cheaper than NFKC or regex.
 */
function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return false;
  }
  return true;
}

/**
 * Text-only fold (no indexMap). Used by `normalize()` where the index map
 * would be allocated and immediately discarded.
 */
function foldText(input: string): string {
  if (isAscii(input)) return input;
  let folded = '';
  for (const codepoint of input) {
    if (COMBINING_MARK_RE.test(codepoint)) continue;
    folded += (CONFUSABLES[codepoint] ?? codepoint).normalize('NFKC');
  }
  return folded;
}

/**
 * Fold Unicode obfuscations into ASCII-equivalent forms while tracking the
 * original-string index of every output character. This is the front door for
 * detection: tokenization and matching run on the folded text, then result
 * positions are mapped back to the original via the returned indexMap.
 *
 * Folds applied (per codepoint):
 *  - Confusables: Cyrillic/Greek letters that visually impersonate Latin
 *    (e.g. Cyrillic 'а' U+0430 → 'a').
 *  - NFKC compatibility decomposition: fullwidth (Ｆｕｃｋ → Fuck),
 *    mathematical alphanumeric (𝐟𝐮𝐜𝐤 → fuck), ligatures (ﬁ → fi), etc.
 *
 * The indexMap has length `folded.length + 1`. For any folded slice
 * [start, end), the corresponding original slice is
 * [indexMap[start], indexMap[end]).
 *
 * Fast path: pure-ASCII input returns an identity index map without entering
 * the per-codepoint loop. Callers that already detect ASCII can skip this
 * entirely.
 */
export function unicodeFold(input: string): { text: string; indexMap: number[] } {
  if (isAscii(input)) {
    const indexMap = new Array<number>(input.length + 1);
    for (let i = 0; i <= input.length; i++) indexMap[i] = i;
    return { text: input, indexMap };
  }

  let folded = '';
  const indexMap: number[] = [];
  let originalIdx = 0;

  for (const codepoint of input) {
    const cpLength = codepoint.length; // 1 or 2 UTF-16 units
    // Combining marks are dropped — they yield no folded characters but
    // still consume their original-string slot so subsequent indexMap
    // entries point past them.
    if (COMBINING_MARK_RE.test(codepoint)) {
      originalIdx += cpLength;
      continue;
    }
    const mapped = (CONFUSABLES[codepoint] ?? codepoint).normalize('NFKC');
    folded += mapped;
    for (let k = 0; k < mapped.length; k++) {
      indexMap.push(originalIdx);
    }
    originalIdx += cpLength;
  }
  // Sentinel so positions [start, folded.length] are valid for end mapping.
  indexMap.push(originalIdx);

  return { text: folded, indexMap };
}

/**
 * Normalize a string by applying all transformations.
 * Returns the cleaned, lowercase form.
 *
 * Pipeline:
 * 1. Lowercase
 * 2. Strip invisible unicode
 * 3. Replace multi-char l33t sequences (greedy longest-first)
 * 4. Replace single-char substitutions
 * 5. Collapse repeated characters (3+ → 2)
 * 6. Strip separators between chars
 *
 * With `literalDigits`, digits pass through steps 3–4 unchanged — for tokens
 * that `looksLikeCode`.
 */
export function normalize(input: string, literalDigits = false): string {
  // Step 0: Fold confusables + NFKC. `foldText` is a no-op fast path for
  // pure-ASCII input, so the common case pays only an isAscii scan.
  let text = foldText(input).toLowerCase();

  // Step 1: Strip invisible chars
  text = text.replace(INVISIBLE_RE, '');

  // Short-circuit: pure-digit tokens bypass l33t decoding
  if (ALL_DIGITS_RE.test(text)) return text;

  // Step 2: Multi-char l33t decode (greedy, longest-first)
  text = decodeMultiChar(text, literalDigits);

  // Step 3: Single-char substitution
  text = decodeSingleChar(text, literalDigits);

  // Step 4: Collapse repeated chars (3+ → 2). Manual scan rather than regex —
  // V8's Irregexp engine overflows its internal stack around 4M+ chars on
  // `/(.)\1{2,}/g`, which was a remote DoS vector via `detect()`.
  text = collapseRuns(text, 3, 2);

  // Step 5: Strip separators
  text = text.replace(SEPARATOR_RE, '');

  return text.trim();
}

/**
 * Generate multiple normalized variants for broader matching.
 * `literalDigits` as for `normalize`.
 */
export function normalizeVariants(input: string, literalDigits = false): string[] {
  const variants = new Set<string>();
  const base = normalize(input, literalDigits);
  variants.add(base);

  // Aggressive collapse: all repeated chars to 1. Manual scan, same reason
  // as in `normalize()` — avoids a regex stack-overflow on huge runs.
  const aggressive = collapseRuns(base, 2, 1);
  variants.add(aggressive);

  // No-collapse variant (some words have legit doubles)
  const folded = foldText(input);
  let noCollapse = folded.toLowerCase();
  noCollapse = noCollapse.replace(INVISIBLE_RE, '');
  if (!ALL_DIGITS_RE.test(noCollapse)) {
    noCollapse = decodeMultiChar(noCollapse, literalDigits);
    noCollapse = decodeSingleChar(noCollapse, literalDigits);
  }
  noCollapse = noCollapse.replace(SEPARATOR_RE, '');
  variants.add(noCollapse.trim());

  // Strip everything non-alphanumeric (operates on the folded form so that
  // mathematical-alphabet / fullwidth obfuscations survive the strip).
  variants.add(folded.toLowerCase().replace(/[^a-z0-9]/g, '').trim());

  return [...variants].filter(v => v.length > 0);
}

/**
 * Decode multi-character l33t sequences using greedy longest-first matching.
 * Single-pass left-to-right scan.
 */
function decodeMultiChar(text: string, literalDigits = false): string {
  const sequences = literalDigits ? MULTI_CHAR_SEQUENCES_NO_DIGITS : MULTI_CHAR_SEQUENCES;
  const firstChars = literalDigits ? MULTI_FIRST_CHARS_NO_DIGITS : MULTI_FIRST_CHARS;
  let result = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Quick pre-filter: only attempt multi-char if first char could start a sequence
    if (firstChars.has(char)) {
      let matched = false;

      // Try each sequence (already sorted longest-first)
      for (const [pattern, replacement] of sequences) {
        if (i + pattern.length <= text.length) {
          const slice = text.substring(i, i + pattern.length);
          if (slice === pattern) {
            result += replacement;
            i += pattern.length;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        result += char;
        i++;
      }
    } else {
      result += char;
      i++;
    }
  }

  return result;
}

/**
 * Decode single-character substitutions.
 * Uses direct map lookup — O(1) per character, O(n) total.
 */
function decodeSingleChar(text: string, literalDigits = false): string {
  let result = '';
  for (const char of text) {
    if (literalDigits && char >= '0' && char <= '9') {
      result += char;
      continue;
    }
    result += SINGLE_MAP[char] ?? char;
  }
  return result;
}
