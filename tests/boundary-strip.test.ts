import { verlux, createInstance } from '../src/index';

describe('Boundary punctuation strip + slt removal', () => {
  describe('bracket-class openers no longer fabricate French "con"', () => {
    const benignBracketed = ['(on', '[on', '{on', '<on', '(on)', '[on]', '{on}'];
    it.each(benignBracketed)('does not flag "%s"', (input) => {
      expect(verlux.detect(input)).toHaveLength(0);
    });
  });

  describe('slt no longer flagged (French SMS hi)', () => {
    it('does not flag "slt"', () => {
      expect(verlux.detect('slt')).toHaveLength(0);
    });
    it('does not flag "slt ça va"', () => {
      expect(verlux.detect('slt ça va')).toHaveLength(0);
    });
    it('still flags the canonical "slut"', () => {
      const results = verlux.detect('slut');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matched).toBe('slut');
    });
    it('still flags "sluts" and "slutty"', () => {
      expect(verlux.detect('sluts').length).toBeGreaterThan(0);
      expect(verlux.detect('slutty').length).toBeGreaterThan(0);
    });
  });

  describe('regression guard — obfuscation forms at segment start still match', () => {
    it('@$$hole still matches asshole', () => {
      const r = verlux.detect('@$$hole');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('asshole');
    });
    it('$lut still matches slut', () => {
      const r = verlux.detect('$lut');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('slut');
    });
    it('|=uck still matches fuck', () => {
      const r = verlux.detect('|=uck');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('fuck');
    });
  });

  describe('quoted profanity still matches with positions on the inner word', () => {
    it('"shit" still matches and position covers shit only', () => {
      const r = verlux.detect('"shit"');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('shit');
      expect(r[0].position).toEqual([1, 5]);
    });
    it('(cul) still matches French cul (genuine usage)', () => {
      const r = verlux.detect('(cul)');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('cul');
      expect(r[0].position).toEqual([1, 4]);
    });
    it('(con) matches French con on a French-scoped instance', () => {
      // Safelisted as English under the default config; see the
      // language-scoped safelist tests in false-positives.test.ts.
      const r = createInstance({ languages: ['fr'] }).detect('(con)');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('con');
      expect(r[0].position).toEqual([1, 4]);
    });
  });

  describe('hashtag prefix no longer fabricates English profanity', () => {
    const benignTags = ['#oe', '#or', '#orny', '#oney'];
    it.each(benignTags)('does not flag "%s"', (input) => {
      expect(verlux.detect(input)).toHaveLength(0);
    });
    it('interior # still decodes to h (s#it matches shit)', () => {
      const r = verlux.detect('s#it');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('shit');
    });
  });

  describe('symmetric strip handles transposed/closer-leading punctuation', () => {
    // Fixture is the French `cul` rather than `con`: under the default
    // all-languages config `con` now resolves through the `en` safelist bucket
    // (it is an everyday English noun), so it is no longer a valid probe for
    // punctuation stripping. `cul` is the same length, so the expected
    // positions are unchanged.
    it('"><cul" strips both ends and reports cul at position [2,5]', () => {
      const r = verlux.detect('><cul');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('cul');
      expect(r[0].position).toEqual([2, 5]);
    });
    it('"].cul" strips both leading chars', () => {
      const r = verlux.detect('].cul');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].matched).toBe('cul');
      expect(r[0].position).toEqual([2, 5]);
    });
    it('"})on" is no longer flagged (closers stripped, "on" left)', () => {
      expect(verlux.detect('})on')).toHaveLength(0);
    });

    // The original `con` probes, kept intact against a French-scoped instance
    // where the `en` bucket is inactive and `con` is detectable again.
    describe('French-scoped instance still strips around "con"', () => {
      const fr = createInstance({ languages: ['fr'] });
      it('"><con" strips both ends and reports con at position [2,5]', () => {
        const r = fr.detect('><con');
        expect(r.length).toBeGreaterThan(0);
        expect(r[0].matched).toBe('con');
        expect(r[0].position).toEqual([2, 5]);
      });
      it('"].con" strips both leading chars', () => {
        const r = fr.detect('].con');
        expect(r.length).toBeGreaterThan(0);
        expect(r[0].matched).toBe('con');
        expect(r[0].position).toEqual([2, 5]);
      });
      it('"})on" is still not flagged', () => {
        expect(fr.detect('})on')).toHaveLength(0);
      });
    });
  });
});
