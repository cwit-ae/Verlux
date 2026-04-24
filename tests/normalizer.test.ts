import { normalize, normalizeVariants } from '../src/engine/normalizer';

describe('Normalizer', () => {
  describe('normalize', () => {
    it('converts to lowercase', () => {
      expect(normalize('HELLO')).toBe('hello');
    });

    it('decodes l33t speak numbers', () => {
      expect(normalize('h3ll0')).toBe('hello');
      expect(normalize('4ss')).toBe('ass');
      expect(normalize('sh1t')).toBe('shit');
    });

    it('decodes l33t speak symbols', () => {
      expect(normalize('@ss')).toBe('ass');
      expect(normalize('$hit')).toBe('shit');
      expect(normalize('b!tch')).toBe('bitch');
    });

    it('collapses repeated characters', () => {
      expect(normalize('fuuuuck')).toBe('fuuck');
      expect(normalize('shiiiit')).toBe('shiit');
      expect(normalize('assssss')).toBe('ass');
    });

    it('strips separator characters between letters', () => {
      expect(normalize('f.u.c.k')).toBe('fuck');
      expect(normalize('s-h-i-t')).toBe('shit');
      expect(normalize('a_s_s')).toBe('ass');
    });

    it('strips invisible unicode characters', () => {
      expect(normalize('f\u200Buck')).toBe('fuck');
      expect(normalize('sh\u00ADit')).toBe('shit');
    });

    it('handles combined obfuscation', () => {
      expect(normalize('F.U.C.K')).toBe('fuck');
      expect(normalize('$h!t')).toBe('shit');
      expect(normalize('@$$h0l3')).toBe('asshole');
    });

    it('passes pure-digit tokens through without l33t decoding', () => {
      // SINGLE_MAP would otherwise turn "422" into "azz" (an alias of "ass")
      expect(normalize('422')).toBe('422');
      expect(normalize('1337')).toBe('1337');
      expect(normalize('4')).toBe('4');
      expect(normalize('55')).toBe('55');
    });
  });

  describe('normalizeVariants', () => {
    it('returns multiple variant forms', () => {
      const variants = normalizeVariants('$h1t');
      expect(variants).toContain('shit');
      // Should always return at least the fully-normalized form
      expect(variants.length).toBeGreaterThanOrEqual(1);
    });

    it('handles clean words without breaking them', () => {
      const variants = normalizeVariants('hello');
      expect(variants).toContain('hello');
    });

    it('does not decode pure-digit tokens into profanity aliases', () => {
      const variants = normalizeVariants('422');
      expect(variants).not.toContain('azz');
      expect(variants).toContain('422');
    });
  });
});
