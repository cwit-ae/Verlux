/**
 * Native-script (Devanagari) Hindi detection.
 *
 * Roman-script Hindi is covered by transliteration-scope.test.ts. This file
 * covers input written in Devanagari, which reaches the `hi-latn` dictionary
 * only through `devanagariToLatin` plus the Hinglish folds — a path that was
 * almost entirely broken:
 *
 *  1. `devanagariToLatin` emitted every inherent schwa, so चूत romanized to
 *     "choota" and भेनचोद to "bhenachoda" — spellings no dictionary key has.
 *     Hindi drops most of those schwas.
 *  2. `transliterate` applied the Hinglish folds to the ORIGINAL string. Being
 *     Latin-only regexes they matched nothing against Devanagari, so the
 *     romanized form never got folded: गांडू produced `gaandoo` but never
 *     `gaandu`, the spelling the dictionary lists.
 *  3. Both safelists are keyed by surface form, so a Devanagari token was
 *     matched on its romanization but safelist-checked on its original
 *     script — the check missed every time.
 */
import { verlux, createInstance } from '../src/index';
import {
  devanagariToLatin,
  devanagariToLatinVariants,
  transliterate,
  hasDevanagari,
} from '../src/engine/transliterator';

describe('Devanagari romanization', () => {
  describe('schwa deletion', () => {
    // Hindi does not pronounce most inherent schwas. Emitting them produced
    // romanizations that matched nothing.
    const romanizations: Array<[string, string]> = [
      ['चूत', 'choot'],           // was "choota"
      ['गांड', 'gaand'],          // was "gaanda"
      ['भेनचोद', 'bhenchod'],     // was "bhenachoda"
      ['मादरचोद', 'maadarchod'],  // was "maadarachoda" — medial schwa kept
      ['बहनचोद', 'bahanchod'],    // medial schwa kept after the first syllable
      ['नमस्ते', 'namaste'],      // conjunct + final matra, unchanged
      ['साल', 'saal'],            // "year" — must NOT become "saala"
      ['दाल', 'daal'],            // "lentil" — must NOT become "daala"
    ];

    it.each(romanizations)('romanizes %s as "%s"', (devanagari, expected) => {
      expect(devanagariToLatin(devanagari)).toBe(expected);
    });

    it('leaves a single-syllable word its vowel', () => {
      // A bare consonant is not a pronounceable form, so the rule stops short.
      expect(devanagariToLatin('न')).toBe('na');
    });

    it('protects a schwa that carries a nasal coda', () => {
      // लंड → "land": dropping the schwa would strand the nasal as "lnd".
      expect(devanagariToLatin('लंड')).toBe('land');
    });
  });

  describe('retroflex flap readings', () => {
    // ड़/ढ़ are strictly r-like, but Hinglish spells them with `d` far more
    // often. Both readings are emitted so either dictionary spelling matches.
    it('emits both the r and d readings', () => {
      expect(devanagariToLatinVariants('लौड़ा').sort()).toEqual(['laudaa', 'lauraa']);
      expect(devanagariToLatinVariants('भोसड़ीके').sort()).toEqual(['bhosdeeke', 'bhosreeke']);
    });

    it('collapses to one variant when no flap is present', () => {
      expect(devanagariToLatinVariants('चूत')).toEqual(['choot']);
    });
  });

  describe('nuqta encoding', () => {
    // Nuqta consonants exist in two encodings: a single precomposed codepoint
    // (U+0958–U+095F) and base + U+093C. Unicode lists the precomposed forms
    // as composition exclusions, so NFC/NFKC produce the DEcomposed pair —
    // which is what the literal keys in CONSONANTS are. Precomposed input
    // used to match nothing and be dropped silently, so ज़ vanished outright.
    //
    // The first two columns below are genuinely different codepoints that
    // render identically — do not "tidy" them into one. They are the guard on
    // PRECOMPOSED_NUQTA: if this file or transliterator.ts is ever re-saved
    // under NFC normalization, the precomposed column decomposes, the map
    // keys collapse into duplicates, and these assertions fail.
    const encodings: Array<[string, string, string]> = [
      ['क़', 'क़', 'qa'],
      ['ग़', 'ग़', 'gha'],
      ['ज़', 'ज़', 'za'],
      ['फ़', 'फ़', 'fa'],
    ];

    it.each(encodings)(
      'romanizes precomposed and decomposed alike as "%s"->"%s"->%s',
      (precomposed, decomposed, expected) => {
        expect(devanagariToLatin(precomposed)).toBe(expected);
        expect(devanagariToLatin(decomposed)).toBe(expected);
      }
    );

    it('detects a word spelled with either encoding', () => {
      // हरामज़ादा, with ज़ precomposed and decomposed respectively.
      const precomposed = 'हरामज़ादा';
      const decomposed = 'हरामज़ादा';
      expect(devanagariToLatin(precomposed)).toBe('haraamzaadaa');
      expect(devanagariToLatin(decomposed)).toBe('haraamzaadaa');
      expect(verlux.detect(precomposed).length).toBeGreaterThan(0);
      expect(verlux.detect(decomposed).length).toBeGreaterThan(0);
    });
  });

  it('applies the Hinglish folds to the ROMANIZED form, not the original', () => {
    // The regression: folding the Devanagari string is a no-op, so `gaandu`
    // — the spelling the dictionary lists — was never generated.
    const variants = transliterate('गांडू');
    expect(variants).toContain('gaandoo'); // raw romanization
    expect(variants).toContain('gandu');   // folded (aa→a, oo→u)
  });

  it('detects Devanagari without a regex scan', () => {
    expect(hasDevanagari('चूत')).toBe(true);
    expect(hasDevanagari('hello')).toBe(false);
    expect(hasDevanagari('')).toBe(false);
    expect(hasDevanagari('hello चूत')).toBe(true);
  });
});

describe('Devanagari detection — recall', () => {
  // Native spellings of the hi-latn entries.
  const nativeProfanity = [
    'भेनचोद', 'बहनचोद', 'भैनचोद', 'मादरचोद', 'चूतिया', 'चुतिया',
    'गांड', 'गाण्ड', 'गांडू', 'गांडु', 'लंड', 'लौड़ा', 'रंडी',
    'हरामज़ादा', 'हरामी', 'भोसड़ीके', 'चूत', 'टट्टी', 'साला',
    'कुत्ता', 'कुत्ती', 'कमीना', 'गधा', 'उल्लू', 'बेवकूफ', 'बेवकूफ़',
    'झाटू', 'छक्का', 'हिजड़ा', 'दल्ला', 'चिनाल', 'सुअर', 'सूअर',
    'हगना', 'चरसी', 'नालायक', 'चपरी', 'भड़वा',
  ];

  it.each(nativeProfanity)('flags "%s"', (word) => {
    const results = verlux.detect(word);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].language).toBe('hi-latn');
  });

  it('reports positions against the ORIGINAL string', () => {
    const [result] = verlux.detect('यह चूत है');
    expect(result.original).toBe('चूत');
    expect(result.position).toEqual([3, 6]);
  });

  it('handles Devanagari embedded in Latin text', () => {
    const [result] = verlux.detect('hello चूत world');
    expect(result.matched).toBe('chut');
    expect(result.position).toEqual([6, 9]);
  });

  describe('phrases', () => {
    // The phrase tier used to do a bare normalize() lookup, so a Devanagari
    // phrase — which shares no surface form with the stored Roman key — could
    // never match. It now falls back to a folded phrase index.
    const nativePhrases: Array<[string, string]> = [
      ['तेरी माँ की', 'teri maa ki'],
      ['माँ की आँख', 'maa ki aankh'],
      ['तेरी गांड', 'teri gaand'],
      ['उल्लू का पट्ठा', 'ullu ka pattha'],
      ['चुप कर', 'chup kar'],
    ];

    it.each(nativePhrases)('flags "%s" as the phrase "%s"', (native, expected) => {
      const results = verlux.detect(native);
      const phrase = results.find(r => r.matchType === 'phrase');
      expect(phrase).toBeDefined();
      expect(phrase!.matched).toBe(expected);
      expect(phrase!.language).toBe('hi-latn');
    });

    it('reports a folded phrase match at reduced confidence', () => {
      // Reached through a lossy rewrite, so it carries the same 0.9 the
      // word-level transliteration tier reports — not the 1.0 of an exact hit.
      const [phrase] = verlux.detect('चुप कर').filter(r => r.matchType === 'phrase');
      expect(phrase.confidence).toBe(0.9);
      expect(verlux.detect('chup kar')[0].confidence).toBe(1.0);
    });
  });

  it('matches a natively-listed entry at Tier 1', () => {
    // लंड cannot be reached by romanization — it reads "land" — so it is
    // listed in Devanagari in hi-latn.ts and must match exactly.
    expect(verlux.detect('लंड')[0].matchType).toBe('exact');
  });
});

describe('Devanagari detection — precision', () => {
  const benign = [
    // The romanizations of these are the ones that needed safelisting; the
    // safelist is keyed by surface form, so it used to miss the native script.
    'गंध',       // smell → gandh → gaand (HIGH)
    'शाला',      // school → shaala → saala
    'छूट',       // discount → chhoot → chut (HIGH)
    'अछूत',
    'फूल',       // flower → phool → fool
    // These two were manufactured by emitting every inherent schwa.
    'साल',       // year → would have read "saala"
    'दाल',       // lentil → would have read "daala" → dala
    // ordinary vocabulary
    'नमस्ते', 'धन्यवाद', 'पानी', 'खाना', 'घर', 'दोस्त', 'बहन', 'भाई',
    'स्कूल', 'किताब', 'सुंदर', 'अच्छा', 'बहुत', 'क्या', 'कैसे', 'दिवाली',
    'भगवान', 'सुगंध', 'पाठशाला', 'विद्यालय',
  ];

  it.each(benign)('does NOT flag "%s"', (word) => {
    expect(verlux.detect(word)).toHaveLength(0);
  });

  const prose = [
    'मुझे यह दिखाई नहीं दे रहा है',
    'इस दुकान पर पचास प्रतिशत छूट है',
    'आज मौसम बहुत अच्छा है',
    'फूल बहुत सुंदर हैं',
  ];

  it.each(prose)('does NOT flag running prose: "%s"', (text) => {
    expect(verlux.detect(text)).toHaveLength(0);
  });
});

describe('Safelists apply to Devanagari via romanization', () => {
  it('honours the caller whitelist for native script', () => {
    // whitelist entries are Latin spellings; the token is Devanagari.
    const scoped = createInstance({ whitelist: ['chhoot'] });
    expect(scoped.detect('छूट')).toHaveLength(0);
  });

  it('consults only faithful romanizations, never the lossy folds', () => {
    // छूट romanizes to `chhoot` (safelisted) — exempt. चूत romanizes to
    // `choot`, which is NOT safelisted, and must stay flagged. If the folds
    // were consulted both would collapse to `chut` and the benign word would
    // have exempted the profanity.
    expect(verlux.detect('छूट')).toHaveLength(0);
    expect(verlux.detect('चूत').length).toBeGreaterThan(0);
  });

  it('lets a natively-listed dictionary entry win over the exemption', () => {
    // The romanization check runs AFTER Tier 1 precisely so that adding a
    // benign Roman word to the safelist can never silence a native-script
    // dictionary key that happens to romanize onto it.
    const scoped = createInstance({ whitelist: ['land'] });
    expect(scoped.detect('लंड').length).toBeGreaterThan(0);
  });
});
