import { verlux } from '../src/index';
import { unicodeFold, normalize } from '../src/engine/normalizer';

describe('Unicode obfuscation', () => {
  // ─── Confusables (Cyrillic / Greek look-alikes) ───
  describe('Cyrillic confusables', () => {
    // Each entry mixes Latin + Cyrillic codepoints that render visually
    // identical to the canonical English profanity. Tests confirm that
    // the dictionary still matches and that the original input is preserved
    // in the `original` field of the result.
    const cyrillicSpoofs: [string, string][] = [
      // 'fuсk' — с is Cyrillic U+0441
      ['fuсk', 'fuck'],
      // 'fucк' — к is Cyrillic U+043A (NOTE: К U+041A is in confusables but
      //          lowercase к is not; we expect this NOT to fold and so it
      //          falls through to fuzzy matching)
      // 'shіt' — і is Cyrillic U+0456
      ['shіt', 'shit'],
      // 'аss' — а is Cyrillic U+0430
      ['аss', 'ass'],
      // 'bitсh' — с is Cyrillic U+0441
      ['bitсh', 'bitch'],
      // 'сoсk' — both 'с' chars Cyrillic
      ['сoсk', 'cock'],
    ];

    it.each(cyrillicSpoofs)('detects "%s" as profanity', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  describe('Greek confusables', () => {
    const greekSpoofs: [string, string][] = [
      // 'cοck' — ο is Greek U+03BF (omicron → o)
      ['cοck', 'cock'],
      // 'shοt' wouldn't be profane; use 'pοrn' — ο folds to o
      ['pοrn', 'porn'],
    ];

    it.each(greekSpoofs)('detects "%s" as %s', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  // ─── NFKC compatibility folds ───
  describe('NFKC: fullwidth Latin', () => {
    // Fullwidth forms (U+FF21–U+FF5A) are common in CJK input contexts.
    const fullwidthSpoofs: [string, string][] = [
      ['ｆｕｃｋ', 'fuck'],         // ｆｕｃｋ
      ['ｓｈｉｔ', 'shit'],         // ｓｈｉｔ
      ['Ａｓｓ', 'ass'],                // Ａｓｓ
    ];

    it.each(fullwidthSpoofs)('detects "%s" as %s', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  describe('NFKC: mathematical alphanumeric', () => {
    // U+1D400 block — popular on social media. Each glyph is a surrogate
    // pair (length 2 in JS string), which makes position mapping testable.
    const mathSpoofs: [string, string][] = [
      ['\u{1D41F}\u{1D42E}\u{1D41C}\u{1D424}', 'fuck'],   // 𝐟𝐮𝐜𝐤 (bold)
      ['\u{1D453}\u{1D462}\u{1D450}\u{1D458}', 'fuck'],   // 𝑓𝑢𝑐𝑘 (italic)
      ['\u{1D5BF}\u{1D5CE}\u{1D5BC}\u{1D5C4}', 'fuck'],   // 𝖿𝗎𝖼𝗄 (sans-serif: a=1D5BA, f=1D5BF, c=1D5BC, k=1D5C4, u=1D5CE)
      ['\u{1D42C}\u{1D421}\u{1D422}\u{1D42D}', 'shit'],   // 𝐬𝐡𝐢𝐭 (bold)
    ];

    it.each(mathSpoofs)('detects mathematical-alphanumeric "%s" as %s', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  // ─── Position mapping back to original ───
  describe('position mapping preserves original indices', () => {
    it('maps fullwidth profanity to its original byte range', () => {
      const original = 'hi ｆｕｃｋ everyone';
      // 'hi ' = 3 chars, 'ｆｕｃｋ' = 4 chars (each BMP), ' everyone' = 9.
      const results = verlux.detect(original);
      expect(results.length).toBeGreaterThan(0);
      const r = results[0];
      expect(r.matched).toBe('fuck');
      expect(r.position).toEqual([3, 7]);
      expect(original.slice(r.position[0], r.position[1])).toBe('ｆｕｃｋ');
      expect(r.original).toBe('ｆｕｃｋ');
    });

    it('maps mathematical-alphanumeric profanity through surrogate pairs', () => {
      // Each math letter is a UTF-16 surrogate pair (length 2 in the string).
      const profane = '\u{1D41F}\u{1D42E}\u{1D41C}\u{1D424}'; // 𝐟𝐮𝐜𝐤
      const original = `oh ${profane}!`;
      // 'oh ' = 3, profane = 8 UTF-16 units, '!' = 1; total 12.
      const results = verlux.detect(original);
      expect(results.length).toBeGreaterThan(0);
      const r = results[0];
      expect(r.matched).toBe('fuck');
      expect(r.position).toEqual([3, 11]);
      expect(original.slice(r.position[0], r.position[1])).toBe(profane);
      expect(r.original).toBe(profane);
    });

    it('maps Cyrillic-spoofed profanity to original indices', () => {
      const original = 'they fuсk dogs'; // 'fuсk' with Cyrillic 'с'
      const results = verlux.detect(original);
      expect(results.length).toBeGreaterThan(0);
      const r = results[0];
      expect(r.matched).toBe('fuck');
      // 'they ' = 5, 'fuсk' = 4 chars (Cyrillic 'с' is BMP, length 1)
      expect(r.position).toEqual([5, 9]);
      expect(original.slice(r.position[0], r.position[1])).toBe('fuсk');
    });
  });

  // ─── Censor preserves original chars ───
  describe('censor() handles Unicode obfuscation', () => {
    it('masks fullwidth profanity in the original input', () => {
      const censored = verlux.censor('hi ｆｕｃｋ everyone');
      expect(censored).toBe('hi **** everyone');
    });

    it('masks mathematical-alphanumeric profanity', () => {
      const profane = '\u{1D41F}\u{1D42E}\u{1D41C}\u{1D424}'; // 𝐟𝐮𝐜𝐤
      const censored = verlux.censor(`say ${profane}`);
      // Mask covers the full UTF-16 length of the surrogate pairs (8 units).
      expect(censored).toBe('say ********');
    });

    it('masks Cyrillic-spoofed profanity', () => {
      const censored = verlux.censor('they fuсk dogs');
      expect(censored).toBe('they **** dogs');
    });
  });

  // ─── Must NOT cause false positives on legit non-Latin text ───
  describe('does not falsely flag legitimate non-Latin text', () => {
    // These contain Cyrillic/Greek codepoints that fold to Latin letters but
    // do not form any dictionary entry after folding.
    const cleanInputs = [
      'привет',            // Russian "hello" — folds to "privet"-ish, not in dict
      'спасибо',           // Russian "thank you"
      'γεια σας',          // Greek "hello"
      'καλημέρα',          // Greek "good morning"
    ];

    it.each(cleanInputs)('does NOT flag legitimate non-Latin "%s"', (text) => {
      expect(verlux.detect(text)).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────
// unicodeFold() unit tests
// ─────────────────────────────────────────────
describe('unicodeFold', () => {
  it('returns input unchanged when already ASCII', () => {
    const { text, indexMap } = unicodeFold('hello');
    expect(text).toBe('hello');
    expect(indexMap).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('folds fullwidth Latin to ASCII', () => {
    const { text } = unicodeFold('ｆｕｃｋ');
    expect(text).toBe('fuck');
  });

  it('folds mathematical bold to ASCII', () => {
    const { text } = unicodeFold('\u{1D41F}\u{1D42E}\u{1D41C}\u{1D424}');
    expect(text).toBe('fuck');
  });

  it('folds Cyrillic confusables to Latin', () => {
    const { text } = unicodeFold('fuсk');
    expect(text).toBe('fuck');
  });

  it('builds correct indexMap for surrogate pairs', () => {
    // '𝐟𝐮' = 4 UTF-16 units, folds to 'fu' (2 chars).
    const { text, indexMap } = unicodeFold('\u{1D41F}\u{1D42E}');
    expect(text).toBe('fu');
    // folded[0]='f' from original[0..2], folded[1]='u' from original[2..4]
    expect(indexMap).toEqual([0, 2, 4]);
  });

  it('builds correct indexMap when fold expands a codepoint', () => {
    // 'ﬁ' (U+FB01, length 1) folds via NFKC to 'fi' (length 2).
    const { text, indexMap } = unicodeFold('ﬁ');
    expect(text).toBe('fi');
    // Both output chars came from the same original codepoint at index 0;
    // the sentinel marks the original end at index 1.
    expect(indexMap).toEqual([0, 0, 1]);
  });

  it('handles empty input', () => {
    const { text, indexMap } = unicodeFold('');
    expect(text).toBe('');
    expect(indexMap).toEqual([0]);
  });
});

// ─────────────────────────────────────────────
// normalize() now applies confusables + NFKC
// ─────────────────────────────────────────────
describe('normalize() applies Unicode folds', () => {
  it('folds Cyrillic confusables and lowercases', () => {
    expect(normalize('FUСK')).toBe('fuck'); // С = Cyrillic U+0421
  });

  it('folds mathematical alphanumerics', () => {
    expect(normalize('\u{1D41F}\u{1D42E}\u{1D41C}\u{1D424}')).toBe('fuck');
  });

  it('combines confusables with l33t decoding', () => {
    // Cyrillic ѕ (U+0455 "dze") visually impersonates Latin s — that's the
    // homoglyph attackers use to obfuscate 's'. Cyrillic с (U+0441 "es")
    // visually impersonates Latin c, not s, despite the phonetic.
    expect(normalize('ѕh!t')).toBe('shit'); // Cyrillic ѕ → s
    expect(normalize('@ѕѕ')).toBe('ass');   // Cyrillic ѕ × 2 + @
  });
});

// ─────────────────────────────────────────────
// Combining-mark obfuscation
// ─────────────────────────────────────────────
describe('Combining-mark obfuscation', () => {
  // Each base letter followed by U+0338 (combining long solidus overlay)
  // renders as a strikethrough version (e.g. f̸u̸c̸k̸). Without combining-mark
  // stripping the tokenizer splits these into single-letter fragments and
  // the dictionary lookup misses entirely.
  const STRIKE = '̸';

  it('strips combining strikethrough so the base letters fuse', () => {
    const original = `f${STRIKE}u${STRIKE}c${STRIKE}k${STRIKE}`;
    const results = verlux.detect(original);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matched).toBe('fuck');
  });

  it('strips combining marks inside a sentence', () => {
    const original = `you s${STRIKE}h${STRIKE}i${STRIKE}t${STRIKE} happens`;
    const results = verlux.detect(original);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matched).toBe('shit');
  });

  it('handles multiple stacked combining marks per base letter', () => {
    // U+0301 (acute) + U+0308 (diaeresis) stacked on each letter
    const stacked = 'f́̈ú̈ć̈ḱ̈';
    const results = verlux.detect(stacked);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matched).toBe('fuck');
  });

  it('preserves precomposed Latin diacritics — Spanish, French, German', () => {
    // These are single-codepoint precomposed forms (NOT decomposed base+mark),
    // so the combining-mark strip must not touch them.
    expect(verlux.detect('cabrón')[0]?.matched).toBe('cabrón');
    expect(verlux.detect('connard')[0]?.matched).toBe('connard');
    expect(verlux.detect('arschloch')[0]?.matched).toBe('arschloch');
  });

  it('does not falsely flag legitimate text with stray combining marks', () => {
    // 'hello' with a combining acute mid-word renders as "héllo" but base
    // letters spell "hello" — should still be recognized as clean.
    expect(verlux.detect(`héllo world`)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// foldText / unicodeFold combining-mark behaviour
// ─────────────────────────────────────────────
describe('fold drops combining marks', () => {
  it('foldText strips orphan combining strikethrough', () => {
    // Re-import for type narrowing — foldText is internal but exercised via normalize
    expect(normalize('f̸u̸c̸k̸')).toBe('fuck');
  });

  it('unicodeFold updates indexMap correctly when marks are skipped', () => {
    // Build the decomposed sequence explicitly via codepoint escapes so the
    // test does not depend on whether the editor stores 'á' as a single
    // precomposed codepoint or as 'a' + U+0301.
    const decomposed = 'áb';
    expect(decomposed.length).toBe(3); // sanity-check decomposition
    const { text, indexMap } = unicodeFold(decomposed);
    expect(text).toBe('ab');
    // 'a' ← orig[0..1], combining mark at orig[1..2] is dropped, 'b' ← orig[2..3]
    expect(indexMap).toEqual([0, 2, 3]);
  });
});
