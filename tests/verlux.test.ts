import { verlux, createInstance } from '../src/index';

describe('Verlux', () => {
  describe('detect', () => {
    // === English Detection ===
    it('detects basic English profanity', () => {
      const results = verlux.detect('what the fuck is this');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe('fuck');
      expect(results[0].language).toBe('en');
    });

    it('detects l33t speak', () => {
      const results = verlux.detect('you are an @$$hole');
      expect(results.length).toBeGreaterThan(0);
    });

    it('detects obfuscated words with separators', () => {
      const results = verlux.detect('f.u.c.k this');
      expect(results.length).toBeGreaterThan(0);
    });

    it('detects repeated character obfuscation', () => {
      const results = verlux.detect('you are soooo fuuuucking stupid');
      const fuckMatch = results.find(r => r.matched === 'fuck');
      expect(fuckMatch).toBeDefined();
    });

    it('returns correct positions', () => {
      const results = verlux.detect('hello fuck world');
      expect(results).toHaveLength(1);
      expect(results[0].position).toEqual([6, 10]);
    });

    it('detects multiple profane words', () => {
      const results = verlux.detect('fuck this shit');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array for clean text', () => {
      const results = verlux.detect('hello world, how are you today?');
      expect(results).toHaveLength(0);
    });

    it('handles empty input', () => {
      expect(verlux.detect('')).toHaveLength(0);
      expect(verlux.detect('   ')).toHaveLength(0);
    });

    // === Hinglish Detection ===
    it('detects Hinglish profanity', () => {
      const results = verlux.detect('tu bhenchod hai');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].language).toBe('hi-latn');
    });

    it('detects Hinglish abbreviations', () => {
      const results = verlux.detect('bc kya kar raha hai');
      expect(results.length).toBeGreaterThan(0);
    });

    it('detects common Hinglish insults', () => {
      const results = verlux.detect('saala kamina');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    // === Severity and Category ===
    it('reports correct severity', () => {
      const results = verlux.detect('nigger');
      expect(results[0].severity).toBe('high');
      expect(results[0].category).toBe('slur');
    });

    it('reports correct match type for exact matches', () => {
      const results = verlux.detect('fuck');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].confidence).toBe(1.0);
    });

    // === Language Filtering ===
    it('filters by language when configured', () => {
      const enOnly = verlux.detect('bhenchod', { languages: ['en'] });
      expect(enOnly).toHaveLength(0);

      const hiLatn = verlux.detect('bhenchod', { languages: ['hi-latn'] });
      expect(hiLatn.length).toBeGreaterThan(0);
    });

    // === Severity Filtering ===
    it('filters by minimum severity', () => {
      const all = verlux.detect('damn fuck', { minSeverity: 'low' });
      const highOnly = verlux.detect('damn fuck', { minSeverity: 'high' });
      expect(all.length).toBeGreaterThanOrEqual(highOnly.length);
    });

    // === Whitelist ===
    it('respects whitelist', () => {
      const results = verlux.detect('fuck this', { whitelist: ['fuck'] });
      const fuckMatch = results.find(r => r.matched === 'fuck');
      expect(fuckMatch).toBeUndefined();
    });
  });

  describe('isClean', () => {
    it('returns true for clean text', () => {
      expect(verlux.isClean('hello world')).toBe(true);
    });

    it('returns false for profane text', () => {
      expect(verlux.isClean('fuck you')).toBe(false);
    });
  });

  describe('censor', () => {
    it('censors profane words with asterisks', () => {
      const result = verlux.censor('what the fuck is this');
      expect(result).toContain('****');
      expect(result).not.toContain('fuck');
    });

    it('censors with custom mask character', () => {
      const result = verlux.censor('fuck you', { mask: '#' });
      expect(result).toContain('####');
    });

    it('preserves clean text', () => {
      const result = verlux.censor('hello world');
      expect(result).toBe('hello world');
    });

    it('censors multiple words', () => {
      const result = verlux.censor('fuck this shit');
      expect(result).not.toContain('fuck');
      expect(result).not.toContain('shit');
    });
  });

  describe('configure', () => {
    it('creates a new instance with custom config', () => {
      const strict = verlux.configure({
        fuzzyThreshold: 0.95,
        minSeverity: 'high',
      });
      expect(strict).toBeDefined();
      expect(typeof strict.detect).toBe('function');
    });

    it('custom instance uses its own config', () => {
      const enOnly = verlux.configure({ languages: ['en'] });
      const result = enOnly.detect('bhenchod');
      expect(result).toHaveLength(0);
    });
  });

  describe('languages', () => {
    it('returns available language codes', () => {
      const langs = verlux.languages();
      expect(langs).toContain('en');
      expect(langs).toContain('hi-latn');
    });
  });

  describe('phrase detection', () => {
    it('detects English phrases', () => {
      const results = verlux.detect('go fuck yourself');
      // Should detect "fuck" at minimum
      expect(results.length).toBeGreaterThan(0);
    });

    it('detects Hinglish phrases', () => {
      const results = verlux.detect('teri maa ki');
      expect(results.some(r => r.matchType === 'phrase')).toBe(true);
    });
  });
});
