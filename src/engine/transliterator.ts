/**
 * Transliterator — Devanagari (Hindi) → Latin, plus Hinglish spelling folds.
 *
 * Hindi abuse reaches a moderation pipeline in two shapes: written in Roman
 * script with no standard spelling (`bhenchod`/`benchod`/`bhencod`), or
 * written in native Devanagari (भेनचोद). This module normalizes both onto the
 * romanized forms the `hi-latn` dictionary is keyed by.
 *
 * NOTE: Urdu in Arabic script is NOT handled. An earlier version of this
 * header claimed "Urdu → Roman", but no Arabic-script mapping exists here and
 * none is implemented — Arabic script omits short vowels, so romanizing it
 * requires vocabulary-level inference rather than a character table. Urdu
 * abuse written in Roman script (the common case online) is covered by the
 * Hinglish folds below; in Arabic script it is not detected.
 */

/**
 * Precomposed nuqta consonants (U+0958–U+095F, plus ऩ/ऱ/ऴ).
 *
 * Unicode lists these as composition exclusions, so NFC and NFKC *decompose*
 * them into base letter + U+093C rather than producing them — which is why the
 * literal keys in CONSONANTS below are two-codepoint sequences. Text that
 * arrives already precomposed (common in older corpora and some IMEs) matched
 * none of them, fell through every branch of the parser, and was dropped
 * silently: ज़ simply vanished, turning हरामज़ादा into "haraamaadaa".
 *
 * `detect()` happened to mask this because `unicodeFold` applies NFKC before
 * tokenizing, but the transliterator must be correct on its own input.
 *
 * MAINTENANCE: these keys are single precomposed codepoints (U+0958 etc.),
 * NOT the base+U+093C pairs that CONSONANTS uses, and the two look identical
 * in every editor. Anything that re-saves this file under NFC normalization
 * will silently decompose them back into duplicates of the CONSONANTS keys and
 * reintroduce the bug. `tests/devanagari.test.ts` asserts both encodings
 * romanize identically, which is what catches that.
 */
const PRECOMPOSED_NUQTA: Record<string, string> = {
  'ऩ': 'n',   // ऩ
  'ऱ': 'r',   // ऱ
  'ऴ': 'l',   // ऴ
  'क़': 'q',   // क़
  'ख़': 'kh',  // ख़
  'ग़': 'gh',  // ग़
  'ज़': 'z',   // ज़
  'ड़': 'r',   // ड़
  'ढ़': 'rh',  // ढ़
  'फ़': 'f',   // फ़
  'य़': 'y',   // य़
};


/** Devanagari consonant to Latin mapping */
const CONSONANTS: Record<string, string> = {
  ...PRECOMPOSED_NUQTA,
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ळ': 'l',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'फ़': 'f',
  'ड़': 'r', 'ढ़': 'rh',
};

/** Devanagari independent vowel to Latin mapping */
const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri', 'ऑ': 'o',
};

/** Devanagari vowel marks (matras) — these follow consonants and replace the inherent 'a' */
const VOWEL_MARKS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri',
  'ॉ': 'o', 'ॅ': 'e',
};

/** Special Devanagari marks */
const SPECIAL: Record<string, string> = {
  'ं': 'n', 'ँ': 'n', 'ः': 'h',
};

const VIRAMA = '्';

/** Nuqta as a standalone combining mark (U+093C). */
const NUQTA = '़';

/**
 * Common Hinglish phonetic variations.
 * When someone writes Hindi in English, they use inconsistent spellings.
 * These mappings help normalize those variations.
 */
const HINGLISH_NORMALIZATIONS: [RegExp, string][] = [
  // Common phonetic swaps
  [/bh/g, 'b'],
  [/dh/g, 'd'],
  [/gh/g, 'g'],
  [/kh/g, 'k'],
  [/ph/g, 'f'],
  [/th/g, 't'],
  [/sh/g, 's'],
  [/chh/g, 'ch'],
  [/aa/g, 'a'],
  [/ee/g, 'i'],
  [/oo/g, 'u'],
  [/ai/g, 'e'],
  [/au/g, 'o'],
];

/**
 * Union of every HINGLISH_NORMALIZATIONS pattern, used as a fast reject in
 * `hinglishFold`. Must be kept in step with the table above — a rule whose
 * pattern is missing here would silently stop firing.
 */
const HINGLISH_FOLD_PROBE = new RegExp(
  HINGLISH_NORMALIZATIONS.map(([pattern]) => pattern.source).join('|')
);

/**
 * One parsed Devanagari syllable: an optional consonant onset, a vowel, and
 * any nasal/visarga coda that trails it.
 *
 * `inherent` marks the vowel as the implicit schwa that every bare Devanagari
 * consonant carries — the one that Hindi pronunciation routinely drops and
 * that `applySchwaDeletion` is responsible for removing.
 */
interface Syllable {
  /** Latin consonant(s); empty for an independent vowel. */
  onset: string;
  /** Latin vowel; empty when a virama suppressed it. */
  vowel: string;
  /** True when `vowel` is the implicit schwa rather than a written matra. */
  inherent: boolean;
  /** Latin output of a trailing anusvara / chandrabindu / visarga. */
  coda: string;
}

/**
 * Delete the inherent schwas that Hindi does not pronounce.
 *
 * Devanagari writes no vowel for the schwa: every bare consonant carries one
 * implicitly. Hindi then drops most of them, which is why चूत is "choot" and
 * not "choota", and मादरचोद is "maadarchod" and not "maadarachoda". Emitting
 * every schwa — as this module used to — produced romanizations that matched
 * no dictionary key, so Devanagari abuse went entirely undetected.
 *
 * Two rules, applied right-to-left (the order matters: deleting a later schwa
 * changes the environment an earlier one is judged in):
 *
 *  1. Word-final schwa is always dropped. गांड → `gaand`.
 *  2. Ohala's rule, the standard descriptive generalisation for Hindi:
 *     a schwa deletes in the environment `V C _ C V`. भेनचोद parses as
 *     bh(e) n(ə) ch(o) d(ə); the न schwa sits between a vowel-bearing
 *     syllable and `cho`, so it goes, giving `bhenchod`.
 *
 * A schwa carrying a coda is protected — the nasal needs a vowel to attach
 * to, so लंड stays `land` rather than collapsing to `lnd`. A single-syllable
 * word is left alone, since a bare consonant is not a pronounceable form.
 *
 * The result is a best-effort romanization, not a guarantee: schwa deletion in
 * Hindi is genuinely ambiguous in places, notably in Sanskrit loanwords and
 * compounds. Both audits treat that as an accepted limit — a word the
 * heuristic mis-reads is a missed match, never a false one.
 */
function applySchwaDeletion(syllables: Syllable[]): void {
  const n = syllables.length;
  if (n <= 1) return;

  for (let i = n - 1; i >= 0; i--) {
    const syllable = syllables[i];
    if (!syllable.inherent || syllable.coda) continue;

    if (i === n - 1) {
      syllable.vowel = '';
      syllable.inherent = false;
      continue;
    }

    // ə → ∅ / VC _ CV
    const prev = syllables[i - 1];
    const next = syllables[i + 1];
    if (i > 0 && prev.vowel !== '' && next.onset !== '' && next.vowel !== '') {
      syllable.vowel = '';
      syllable.inherent = false;
    }
  }
}

function renderSyllables(syllables: Syllable[]): string {
  let out = '';
  for (const s of syllables) out += s.onset + s.vowel + s.coda;
  return out;
}

/**
 * The retroflex flaps ड़ and ढ़ have two live romanizations. Strictly they are
 * `r`-like (ṛ/ṛh), which is what CONSONANTS maps them to, but Hinglish writes
 * them with `d` far more often — लौड़ा is spelled "lauda", भोसड़ीके
 * "bhosdike", भड़वा "bhadwa", none of which the `r` reading reaches. Both
 * readings are generated, so either spelling in the dictionary matches.
 */
const FLAP_AS_D: Record<string, string> = {
  'ड़': 'd',
  'ढ़': 'dh',
  'ड़': 'd',
  'ढ़': 'dh',
};

/** Chandrabindu (U+0901) — nasalizes the vowel rather than adding a consonant. */
const CHANDRABINDU = 'ँ';

/**
 * Knobs for the readings that Hinglish spells inconsistently.
 * `devanagariToLatinVariants` enumerates the combinations.
 */
interface RomanizationOptions {
  /** Consonant reading overrides — see FLAP_AS_D. */
  consonants?: Record<string, string>;
  /**
   * How to read the chandrabindu, which marks a nasalized vowel rather than a
   * nasal consonant. Hinglish is split on it — आँख is written "aankh" but माँ
   * is written "maa", never "maan" — and the split is positional, not
   * arbitrary: the `n` is written when a consonant follows it inside the same
   * word, and dropped at the end of one.
   *
   * `'positional'` (the default) applies that rule and is right for both
   * words above, which matters because a single phrase can need one of each:
   * माँ की आँख → "maa kee aankh". The two fixed readings are generated as
   * well, to cover spellings that ignore the convention.
   *
   * Anusvara ं is deliberately NOT configurable — before a consonant it is a
   * real nasal, and dropping it would turn गांड into "gaad".
   */
  chandrabindu?: 'positional' | 'nasal' | 'drop';
}

/**
 * Parse Devanagari into syllables, emitting non-Devanagari characters
 * verbatim. Returns alternating runs so that schwa deletion — which is a
 * per-WORD rule — never reaches across a space or a Latin character.
 */
function parseSegments(
  text: string,
  options: RomanizationOptions = {}
): Array<Syllable[] | string> {
  const segments: Array<Syllable[] | string> = [];
  const chars = [...text];
  let current: Syllable[] = [];
  const overrides = options.consonants ?? {};
  const readConsonant = (key: string): string | undefined =>
    overrides[key] ?? CONSONANTS[key];

  /**
   * `next` is the character following the mark, used only for the positional
   * chandrabindu rule: nasal before a consonant, silent at the end of a word.
   */
  const readSpecial = (key: string, next: string): string | undefined => {
    if (key !== CHANDRABINDU) return SPECIAL[key];
    switch (options.chandrabindu) {
      case 'nasal':
        return SPECIAL[key];
      case 'drop':
        return '';
      default:
        return readConsonant(next) !== undefined ? SPECIAL[key] : '';
    }
  };

  const flush = () => {
    if (current.length) {
      segments.push(current);
      current = [];
    }
  };

  let i = 0;
  while (i < chars.length) {
    const char = chars[i];
    const next = i + 1 < chars.length ? chars[i + 1] : '';

    // Consonant — precomposed nuqta form (क़) or base + combining nuqta.
    let onset: string | undefined;
    let consumed = 0;
    if (next && readConsonant(char + next) !== undefined) {
      onset = readConsonant(char + next);
      consumed = 2;
    } else if (next === NUQTA && readConsonant(char) !== undefined) {
      // Base consonant followed by a standalone nuqta we have no mapping for:
      // drop the nuqta and keep the base letter rather than emitting it raw.
      onset = readConsonant(char);
      consumed = 2;
    } else if (readConsonant(char) !== undefined) {
      onset = readConsonant(char);
      consumed = 1;
    }

    if (onset !== undefined) {
      i += consumed;
      const syllable: Syllable = { onset, vowel: 'a', inherent: true, coda: '' };
      const following = i < chars.length ? chars[i] : '';
      if (following === VIRAMA) {
        syllable.vowel = '';
        syllable.inherent = false;
        i++;
      } else if (VOWEL_MARKS[following] !== undefined) {
        syllable.vowel = VOWEL_MARKS[following];
        syllable.inherent = false;
        i++;
      }
      while (i < chars.length && readSpecial(chars[i], chars[i + 1] ?? '') !== undefined) {
        syllable.coda += readSpecial(chars[i], chars[i + 1] ?? '') as string;
        i++;
      }
      current.push(syllable);
      continue;
    }

    // Independent vowel
    if (VOWELS[char] !== undefined) {
      const syllable: Syllable = {
        onset: '',
        vowel: VOWELS[char],
        inherent: false,
        coda: '',
      };
      i++;
      while (i < chars.length && readSpecial(chars[i], chars[i + 1] ?? '') !== undefined) {
        syllable.coda += readSpecial(chars[i], chars[i + 1] ?? '') as string;
        i++;
      }
      current.push(syllable);
      continue;
    }

    // Stray matra / special mark / virama — keep the sound, skip the mark.
    if (VOWEL_MARKS[char] !== undefined) {
      current.push({ onset: '', vowel: VOWEL_MARKS[char], inherent: false, coda: '' });
      i++;
      continue;
    }
    if (readSpecial(char, next) !== undefined) {
      if (current.length) {
        current[current.length - 1].coda += readSpecial(char, next) as string;
      } else {
        current.push({ onset: readSpecial(char, next) as string, vowel: '', inherent: false, coda: '' });
      }
      i++;
      continue;
    }
    if (char === VIRAMA || char === NUQTA) {
      i++;
      continue;
    }

    // Anything else ends the Devanagari word. Latin letters, digits and
    // whitespace pass through; other scripts and punctuation are dropped, as
    // before.
    flush();
    if (/[a-zA-Z0-9\s]/.test(char)) segments.push(char);
    i++;
  }

  flush();
  return segments;
}

/**
 * Romanize Devanagari, applying Hindi schwa deletion.
 *
 * Non-Devanagari input is returned unchanged (lowercased), so this is safe to
 * call on any token.
 */
export function devanagariToLatin(text: string): string {
  let out = '';
  for (const segment of parseSegments(text)) {
    if (typeof segment === 'string') {
      out += segment;
      continue;
    }
    applySchwaDeletion(segment);
    out += renderSyllables(segment);
  }
  return out.toLowerCase();
}

/**
 * Every romanization of a Devanagari string worth looking up: schwa deletion,
 * crossed with both readings of the retroflex flaps and both readings of the
 * chandrabindu. Deduplicated, so a word containing neither of those marks
 * still yields exactly one variant and pays nothing for the cross product.
 *
 * Deliberately does NOT emit the fully-voweled form (every inherent schwa
 * kept). That form is not Hindi — it is the raw glyph sequence — and it
 * manufactures words: साल "year" would romanize to `saala`, an exact hit on
 * the insult, and दाल "lentil" to `daala` → `dala`. Since schwa deletion is
 * the correct reading and the audit shows it costs no recall, the spurious
 * form is not generated.
 */
export function devanagariToLatinVariants(text: string): string[] {
  const variants = new Set<string>();

  const chandrabinduReadings: Array<RomanizationOptions['chandrabindu']> = [
    'positional',
    'nasal',
    'drop',
  ];

  for (const consonants of [undefined, FLAP_AS_D]) {
    for (const chandrabindu of chandrabinduReadings) {
      const parts: string[] = [];
      for (const segment of parseSegments(text, { consonants, chandrabindu })) {
        if (typeof segment === 'string') {
          parts.push(segment);
          continue;
        }
        applySchwaDeletion(segment);
        parts.push(renderSyllables(segment));
      }
      variants.add(parts.join('').toLowerCase());
    }
  }

  return [...variants].filter(v => v.length > 0);
}

/**
 * Apply every Hinglish phonetic fold, in order — the lossy skeleton that
 * `hinglishVariants` returns as its second form, exposed on its own.
 */
export function hinglishFold(word: string): string {
  const lower = word.toLowerCase();

  // Fast path. The rules are applied in sequence, so an earlier one can create
  // input for a later one — but only if something matched to begin with. When
  // no rule's pattern is present at all, every replace is a no-op and the
  // result is exactly `lower`. One combined test is far cheaper than thirteen
  // global replaces, and this runs per token on every detect() call.
  if (!HINGLISH_FOLD_PROBE.test(lower)) return lower;

  let folded = lower;
  for (const [pattern, replacement] of HINGLISH_NORMALIZATIONS) {
    folded = folded.replace(pattern, replacement);
  }
  return folded;
}

/**
 * The single canonical romanized-and-folded form of one token, used to key the
 * phrase index from BOTH sides.
 *
 * The phrase tier cannot use `transliterate`'s full variant set: a phrase is
 * several tokens, so the variants would multiply out combinatorially, and
 * folding each n-gram window from scratch costs more than the rest of
 * detection put together. Collapsing each token to one deterministic form
 * instead makes the two sides comparable by construction and lets a token be
 * folded once and reused across every window it appears in.
 *
 * Folding per token rather than per phrase is sound because `transliterate`
 * runs before `normalize` strips the spaces, so no fold pattern ever spanned a
 * token boundary anyway.
 */
export function foldTokenForPhrase(token: string): string {
  const romanized = hasDevanagari(token) ? devanagariToLatin(token) : token;
  return hinglishFold(romanized);
}

/**
 * Generate normalized Hinglish variants of a Roman-script word.
 * Since Hinglish has no standard spelling, we generate possible forms.
 */
export function hinglishVariants(word: string): string[] {
  const variants = new Set<string>();
  variants.add(word.toLowerCase());
  variants.add(hinglishFold(word));

  // Also try the original with just the vowel normalizations
  let vowelNorm = word.toLowerCase();
  vowelNorm = vowelNorm.replace(/aa/g, 'a');
  vowelNorm = vowelNorm.replace(/ee/g, 'i');
  vowelNorm = vowelNorm.replace(/oo/g, 'u');
  variants.add(vowelNorm);

  return [...variants].filter(v => v.length > 0);
}

/**
 * Check if a text contains Devanagari characters (U+0900–U+097F).
 *
 * A charCode scan rather than a regex: this runs once per token on every
 * `detect()` call — including from the Devanagari safelist check in
 * matcher.ts — and the overwhelmingly common answer is "no", which the loop
 * reaches without entering the regex engine.
 */
export function hasDevanagari(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0900 && code <= 0x097f) return true;
  }
  return false;
}

/**
 * Full transliteration pipeline: every romanized form a token could plausibly
 * correspond to.
 *
 * For Devanagari input the Hinglish folds are applied to the ROMANIZED forms.
 * They used to be applied to the original string, where — being Latin-only
 * regexes — they matched nothing, so a Devanagari word only ever reached the
 * dictionary via its raw romanization. That is why गांडू produced `gaandoo`
 * but never `gaandu`, the spelling the dictionary actually lists.
 */
export function transliterate(text: string): string[] {
  const results = new Set<string>([text.toLowerCase()]);

  if (hasDevanagari(text)) {
    for (const romanized of devanagariToLatinVariants(text)) {
      results.add(romanized);
      for (const variant of hinglishVariants(romanized)) results.add(variant);
    }
  }

  // Latin-script input (and the odd mixed token) folds directly.
  for (const variant of hinglishVariants(text)) results.add(variant);

  return [...results].filter(v => v.length > 0);
}
