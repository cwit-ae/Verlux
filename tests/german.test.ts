import { verlux } from '../src/index';

describe('German detection', () => {
  describe('umlaut + ASCII-digraph forms', () => {
    it('detects umlaut word', () => {
      const results = verlux.detect('du bist ein arschloch');
      expect(results.some(r => r.matched === 'arschloch')).toBe(true);
      expect(results[0].language).toBe('de');
    });

    it('detects umlaut canonical form', () => {
      const results = verlux.detect('so eine möse');
      expect(results.some(r => r.matched === 'möse')).toBe(true);
    });

    it('detects ASCII-dropped umlaut form', () => {
      const results = verlux.detect('so eine mose');
      expect(results.some(r => r.matched === 'möse')).toBe(true);
    });

    it('detects ASCII-digraph umlaut form (oe for ö)', () => {
      const results = verlux.detect('so eine moese');
      expect(results.some(r => r.matched === 'möse')).toBe(true);
    });

    it('detects eszett in both forms', () => {
      expect(verlux.detect('was für eine scheiße').some(r => r.matched === 'scheiße')).toBe(true);
      expect(verlux.detect('was fuer eine scheisse').some(r => r.matched === 'scheiße')).toBe(true);
    });

    it('detects vögeln vs Vögel disambiguation', () => {
      // "vögeln" (to fuck) should be flagged
      expect(verlux.detect('ich will vögeln').some(r => r.matched === 'vögeln')).toBe(true);
      // "Vögel" (birds, plural of Vogel) should NOT be flagged
      expect(verlux.detect('die vögel fliegen')).toEqual([]);
    });

    it('detects common high-severity insults', () => {
      // "du hurensohn" is a phrase in its own right — deduplication keeps
      // the phrase over the word. Use a structure where the word is isolated.
      const results = verlux.detect('ein hurensohn und eine schlampe');
      const matches = results.map(r => r.matched);
      expect(matches).toContain('hurensohn');
      expect(matches).toContain('schlampe');
    });

    it('detects racial slurs', () => {
      const results = verlux.detect('kanake');
      expect(results.some(r => r.matched === 'kanake')).toBe(true);
    });
  });

  describe('phrases', () => {
    it('detects "fick dich"', () => {
      const results = verlux.detect('ach fick dich');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'fick dich')
      ).toBe(true);
    });

    it('detects "leck mich am arsch"', () => {
      const results = verlux.detect('ach leck mich am arsch');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'leck mich am arsch')
      ).toBe(true);
    });

    it('detects "verpiss dich"', () => {
      const results = verlux.detect('verpiss dich endlich');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'verpiss dich')
      ).toBe(true);
    });

    it('detects "halt die fresse"', () => {
      const results = verlux.detect('jetzt halt die fresse');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'halt die fresse')
      ).toBe(true);
    });
  });

  describe('false positives — German collision cases', () => {
    const germanFalsePositives = [
      // `fick` fuzzy-close to German `dick` (= thick/fat)
      'die dicke katze',
      // `nutte` fuzzy-close to mutter/butter/futter
      'meine mutter kommt',
      'ich brauche butter',
      // `möse` close to möge/böse/rose/dose
      'ich möge die rose',
      'die böse katze',
      // `vögeln` close to vogel (bird)
      'ein vogel fliegt',
      'die vögel singen',
      // `hure` close to uhr (clock)
      'die uhr zeigt drei',
      // `arsch` close to marsch (march)
      'ein langer marsch',
      // `titten` close to bitten/sitten/mitten
      'ich möchte bitten',
      // `nackt` explicitly excluded from dict — must remain clean
      'das nackte auge',
      'der nackte stein',
      // `rosette` — excluded from dict (decorative shape)
      'eine schöne rosette',
      // `orgasmus` / `porno` — clinical/mainstream, excluded from de dict.
      // Note: `penis` IS flagged via the English dictionary (a deliberate
      // decision in en.ts), so it is NOT tested as clean here.
      'der orgasmus ist ein medizinischer begriff',
    ];

    it.each(germanFalsePositives)('does NOT flag innocent German text: %s', (phrase) => {
      expect(verlux.detect(phrase)).toEqual([]);
    });
  });

  describe('mixed-language input', () => {
    it('detects English + French + German + Spanish + Hinglish in one sentence', () => {
      const results = verlux.detect('hello fuck arschloch pendejo connard bhenchod');
      const langs = new Set(results.map(r => r.language));
      expect(langs.has('en')).toBe(true);
      expect(langs.has('de')).toBe(true);
      expect(langs.has('es')).toBe(true);
      expect(langs.has('fr')).toBe(true);
      expect(langs.has('hi-latn')).toBe(true);
    });
  });

  describe('language pack is registered', () => {
    it('lists de among available languages', () => {
      expect(verlux.languages()).toContain('de');
    });
  });
});
