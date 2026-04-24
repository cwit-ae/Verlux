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
// INVISIBLE UNICODE CHARS REGEX (pre-compiled)
// ─────────────────────────────────────────────
const INVISIBLE_RE = /[\u200B-\u200F\u2028-\u202F\u2060-\u2069\uFEFF\u00AD\u034F\u17B4\u17B5\u180E\uFFF0-\uFFFF]/g;

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
  let text = input.toLowerCase();

  // Step 1: Strip invisible chars
  text = text.replace(INVISIBLE_RE, '');

  // Short-circuit: pure-digit tokens bypass l33t decoding
  if (ALL_DIGITS_RE.test(text)) return text;

  // Step 2: Multi-char l33t decode (greedy, longest-first)
  text = decodeMultiChar(text);

  // Step 3: Single-char substitution
  text = decodeSingleChar(text);

  // Step 4: Collapse repeated chars (3+ → 2)
  text = text.replace(/(.)\1{2,}/g, '$1$1');

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

  // Aggressive collapse: all repeated chars to 1
  const aggressive = base.replace(/(.)\1+/g, '$1');
  variants.add(aggressive);

  // No-collapse variant (some words have legit doubles)
  let noCollapse = input.toLowerCase();
  noCollapse = noCollapse.replace(INVISIBLE_RE, '');
  if (!ALL_DIGITS_RE.test(noCollapse)) {
    noCollapse = decodeMultiChar(noCollapse);
    noCollapse = decodeSingleChar(noCollapse);
  }
  noCollapse = noCollapse.replace(SEPARATOR_RE, '');
  variants.add(noCollapse.trim());

  // Strip everything non-alphanumeric
  variants.add(input.toLowerCase().replace(/[^a-z0-9]/g, '').trim());

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
