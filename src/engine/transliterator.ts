/**
 * Transliterator — converts between scripts.
 * Primary use: Devanagari (Hindi) → Latin (Hinglish), Urdu → Roman.
 * This enables detection of Hindi/Urdu abuse written in Roman script.
 */

/** Devanagari consonant to Latin mapping */
const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'फ़': 'f',
  'ड़': 'r', 'ढ़': 'rh',
};

/** Devanagari independent vowel to Latin mapping */
const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri',
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
 * Transliterate Devanagari text to Latin script.
 * Handles inherent vowel 'a' in consonants: a consonant gets 'a' appended
 * unless followed by a virama (्) or a vowel mark (matra).
 */
export function devanagariToLatin(text: string): string {
  let result = '';
  const chars = [...text]; // Spread to handle multi-byte chars

  let i = 0;
  while (i < chars.length) {
    const char = chars[i];
    const next = i + 1 < chars.length ? chars[i + 1] : '';

    // Try two-char consonant combinations (e.g., nuqta forms like क़)
    if (next && CONSONANTS[char + next]) {
      result += CONSONANTS[char + next];
      i += 2;
      // Check what follows this consonant
      const afterNext = i < chars.length ? chars[i] : '';
      if (afterNext === VIRAMA) {
        i++; // Skip virama, no inherent vowel
      } else if (VOWEL_MARKS[afterNext]) {
        result += VOWEL_MARKS[afterNext];
        i++;
      } else {
        result += 'a'; // Inherent vowel
      }
      continue;
    }

    // Independent vowels
    if (VOWELS[char]) {
      result += VOWELS[char];
      i++;
      continue;
    }

    // Consonants
    if (CONSONANTS[char]) {
      result += CONSONANTS[char];
      i++;
      // Check what follows
      const afterChar = i < chars.length ? chars[i] : '';
      if (afterChar === VIRAMA) {
        i++; // Skip virama, suppress inherent vowel
      } else if (VOWEL_MARKS[afterChar]) {
        result += VOWEL_MARKS[afterChar];
        i++;
      } else {
        result += 'a'; // Inherent vowel
      }
      continue;
    }

    // Vowel marks (shouldn't appear standalone, but handle gracefully)
    if (VOWEL_MARKS[char]) {
      result += VOWEL_MARKS[char];
      i++;
      continue;
    }

    // Special marks (anusvara, chandrabindu, visarga)
    if (SPECIAL[char]) {
      result += SPECIAL[char];
      i++;
      continue;
    }

    // Virama standalone (shouldn't happen, skip)
    if (char === VIRAMA) {
      i++;
      continue;
    }

    // Pass through Latin chars, numbers, and whitespace
    if (/[a-zA-Z0-9\s]/.test(char)) {
      result += char;
    }
    i++;
  }

  return result.toLowerCase();
}

/**
 * Generate normalized Hinglish variants of a Roman-script word.
 * Since Hinglish has no standard spelling, we generate possible forms.
 */
export function hinglishVariants(word: string): string[] {
  const variants = new Set<string>();
  let normalized = word.toLowerCase();
  variants.add(normalized);

  // Apply each normalization to get simplified forms
  for (const [pattern, replacement] of HINGLISH_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  variants.add(normalized);

  // Also try the original with just the vowel normalizations
  let vowelNorm = word.toLowerCase();
  vowelNorm = vowelNorm.replace(/aa/g, 'a');
  vowelNorm = vowelNorm.replace(/ee/g, 'i');
  vowelNorm = vowelNorm.replace(/oo/g, 'u');
  variants.add(vowelNorm);

  return [...variants].filter(v => v.length > 0);
}

/**
 * Check if a text contains Devanagari characters.
 */
export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Full transliteration pipeline: if the text has Devanagari, convert it.
 * Otherwise return the original text.
 */
export function transliterate(text: string): string[] {
  const results: string[] = [text.toLowerCase()];

  if (hasDevanagari(text)) {
    results.push(devanagariToLatin(text));
  }

  // For Latin-script text, also generate Hinglish variants
  const latinVariants = hinglishVariants(text);
  for (const v of latinVariants) {
    if (!results.includes(v)) {
      results.push(v);
    }
  }

  return results;
}
