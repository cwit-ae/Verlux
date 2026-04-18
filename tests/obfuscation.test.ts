import { verlux } from '../src/index';

describe('Obfuscation Detection', () => {
  // === L33T SPEAK (symbol → letter) ===
  describe('l33t speak', () => {
    const leetTests: [string, string][] = [
      ['@$$hole', 'asshole'],
      ['$h!t', 'shit'],
      ['b!7ch', 'bitch'],
      ['n1gg3r', 'nigger'],
      ['r3t4rd', 'retard'],
      ['f4gg07', 'faggot'],
      ['d1ck', 'dick'],
      ['c*nt', 'cunt'],
      ['p*ssy', 'pussy'],
      ['f*ck', 'fuck'],
      ['$lut', 'slut'],
      ['wh0r3', 'whore'],
      ['@ss', 'ass'],
      ['sh!t', 'shit'],
      ['|=uck', 'fuck'],     // |= → f
      ['ph*ck', 'fuck'],     // ph → f
      ['@$$h0l3', 'asshole'],
      ['$h1t', 'shit'],
    ];

    it.each(leetTests)('detects "%s" as %s', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  // === SEPARATOR OBFUSCATION ===
  describe('separator insertion', () => {
    const sepTests: [string, string][] = [
      ['f.u.c.k', 'fuck'],
      ['f-u-c-k', 'fuck'],
      ['f_u_c_k', 'fuck'],
      ['s.h.i.t', 'shit'],
      ['b-i-t-c-h', 'bitch'],
      ['i.d.i.o.t', 'idiot'],
      ['F.U.C.K', 'fuck'],
      ['N.1.G.G.3.R', 'nigger'],
    ];

    it.each(sepTests)('detects "%s" as %s', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  // === REPEATED CHARACTERS ===
  describe('repeated characters', () => {
    const repeatTests: [string, string][] = [
      ['fuuuuck', 'fuck'],
      ['shiiiit', 'shit'],
      ['stuuuupid', 'stupid'],
      ['assshole', 'asshole'],
      ['biiiitch', 'bitch'],
      ['niggggger', 'nigger'],
      ['duuuumb', 'dumb'],
      ['reeeetard', 'retard'],
    ];

    it.each(repeatTests)('detects "%s" as %s', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  // === MIXED CASE ===
  describe('mixed case', () => {
    const caseTests: [string, string][] = [
      ['FuCk', 'fuck'],
      ['SHIT', 'shit'],
      ['IdIoT', 'idiot'],
      ['StUpId', 'stupid'],
      ['BITCH', 'bitch'],
      ['NiGgEr', 'nigger'],
      ['ASSHOLE', 'asshole'],
    ];

    it.each(caseTests)('detects "%s" as %s', (input, expected) => {
      const results = verlux.detect(input);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe(expected);
    });
  });

  // === COMBINED OBFUSCATION ===
  describe('combined techniques', () => {
    it('handles l33t + separators', () => {
      expect(verlux.detect('f.*.c.k').length).toBeGreaterThan(0);
    });

    it('handles l33t + repeats', () => {
      expect(verlux.detect('fuuuu*k').length).toBeGreaterThan(0);
    });

    it('handles censoring asterisks', () => {
      expect(verlux.detect('f**k').length).toBeGreaterThan(0);
      expect(verlux.detect('s**t').length).toBeGreaterThan(0);
      expect(verlux.detect('a**hole').length).toBeGreaterThan(0);
      // Note: b***h strips to 'bh' — too short for detection (by design)
    });

    it('handles case + l33t + separators', () => {
      expect(verlux.detect('F.U.C.K').length).toBeGreaterThan(0);
      expect(verlux.detect('$H!T').length).toBeGreaterThan(0);
    });
  });

  // === MUST NOT FALSE POSITIVE ===
  describe('no false positives on obfuscation', () => {
    const cleanTexts = [
      'assistant', 'class', 'Scunthorpe', 'cocktail',
      'document', 'hello', 'butterfly', 'analyst',
      'passage', 'classic', 'peacock', 'penalty',
    ];

    it.each(cleanTexts)('does NOT flag clean word "%s"', (word) => {
      expect(verlux.detect(word)).toHaveLength(0);
    });
  });
});
