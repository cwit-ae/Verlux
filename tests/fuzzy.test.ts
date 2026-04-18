import { levenshtein, similarity, canMatch, bestFuzzyMatch } from '../src/engine/fuzzy';

describe('Fuzzy Matcher', () => {
  describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('hello', 'hello')).toBe(0);
    });

    it('returns correct distance for single edit', () => {
      expect(levenshtein('fuck', 'fuc')).toBe(1);
      expect(levenshtein('shit', 'sht')).toBe(1);
    });

    it('returns correct distance for multiple edits', () => {
      expect(levenshtein('fuck', 'phuk')).toBe(3); // f→p, u→h, c→u
      expect(levenshtein('kitten', 'sitting')).toBe(3);
    });

    it('handles empty strings', () => {
      expect(levenshtein('', 'hello')).toBe(5);
      expect(levenshtein('hello', '')).toBe(5);
      expect(levenshtein('', '')).toBe(0);
    });
  });

  describe('similarity', () => {
    it('returns 1 for identical strings', () => {
      expect(similarity('hello', 'hello')).toBe(1);
    });

    it('returns high similarity for close strings', () => {
      expect(similarity('fuck', 'fuk')).toBeGreaterThan(0.7);
    });

    it('returns low similarity for different strings', () => {
      expect(similarity('hello', 'world')).toBeLessThan(0.5);
    });
  });

  describe('canMatch', () => {
    it('rejects strings with large length differences', () => {
      expect(canMatch('hi', 'something', 0.85)).toBe(false);
    });

    it('accepts strings with similar lengths', () => {
      expect(canMatch('fuck', 'fuk', 0.7)).toBe(true);
    });
  });

  describe('bestFuzzyMatch', () => {
    it('finds the closest match above threshold', () => {
      const result = bestFuzzyMatch('fuk', ['fuck', 'duck', 'luck'], 0.7);
      expect(result).not.toBeNull();
      expect(result!.match).toBe('fuck');
    });

    it('returns null when nothing meets threshold', () => {
      const result = bestFuzzyMatch('hello', ['fuck', 'shit'], 0.85);
      expect(result).toBeNull();
    });
  });
});
