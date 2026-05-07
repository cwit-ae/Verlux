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
 */
export function normalize(input: string): string {
  // Step 0: Fold confusables + NFKC. `foldText` is a no-op fast path for
  // pure-ASCII input, so the common case pays only an isAscii scan.
  let text = foldText(input).toLowerCase();

  // Step 1: Strip invisible chars
  text = text.replace(INVISIBLE_RE, '');

  // Short-circuit: pure-digit tokens bypass l33t decoding
  if (ALL_DIGITS_RE.test(text)) return text;

  // Step 2: Multi-char l33t decode (greedy, longest-first)
  text = decodeMultiChar(text);

  // Step 3: Single-char substitution
  text = decodeSingleChar(text);

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
 */
export function normalizeVariants(input: string): string[] {
  const variants = new Set<string>();
  const base = normalize(input);
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
    noCollapse = decodeMultiChar(noCollapse);
    noCollapse = decodeSingleChar(noCollapse);
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
function decodeMultiChar(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Quick pre-filter: only attempt multi-char if first char could start a sequence
    if (MULTI_FIRST_CHARS.has(char)) {
      let matched = false;

      // Try each sequence (already sorted longest-first)
      for (const [pattern, replacement] of MULTI_CHAR_SEQUENCES) {
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
function decodeSingleChar(text: string): string {
  let result = '';
  for (const char of text) {
    result += SINGLE_MAP[char] ?? char;
  }
  return result;
}
