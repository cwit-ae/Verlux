import {
  devanagariToLatin,
  hinglishVariants,
  hasDevanagari,
  transliterate,
} from '../src/engine/transliterator';

describe('Transliterator', () => {
  describe('hasDevanagari', () => {
    it('detects Devanagari characters', () => {
      expect(hasDevanagari('गाली')).toBe(true);
      expect(hasDevanagari('hello')).toBe(false);
    });
  });

  describe('devanagariToLatin', () => {
    it('transliterates basic Hindi words', () => {
      const result = devanagariToLatin('नमस्ते');
      expect(result).toContain('namast');
    });

    it('passes through Latin characters', () => {
      const result = devanagariToLatin('hello');
      expect(result).toBe('hello');
    });
  });

  describe('hinglishVariants', () => {
    it('generates phonetic variants', () => {
      const variants = hinglishVariants('bhenchod');
      expect(variants.length).toBeGreaterThan(1);
      expect(variants).toContain('bhenchod');
      // Should include a simplified form
      expect(variants.some(v => v !== 'bhenchod')).toBe(true);
    });

    it('normalizes double vowels', () => {
      const variants = hinglishVariants('gaand');
      expect(variants.some(v => v.includes('gand'))).toBe(true);
    });
  });

  describe('transliterate', () => {
    it('returns original and variants for Latin text', () => {
      const results = transliterate('bhenchod');
      expect(results.length).toBeGreaterThan(1);
    });
  });
});
