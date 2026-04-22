import { verlux } from '../src/index';

describe('French detection', () => {
  describe('accented + accent-stripped forms', () => {
    it('detects accented word', () => {
      const results = verlux.detect('espèce d\'enculé');
      expect(results.some(r => r.matched === 'enculé')).toBe(true);
      expect(results[0].language).toBe('fr');
    });

    it('detects accent-stripped variant', () => {
      const results = verlux.detect('espece d\'encule');
      expect(results.some(r => r.matched === 'enculé')).toBe(true);
    });

    it('detects c-cedilla word in both forms', () => {
      expect(verlux.detect('enfoiré').some(r => r.matched === 'enfoiré')).toBe(true);
      expect(verlux.detect('enfoire').some(r => r.matched === 'enfoiré')).toBe(true);
    });

    it('detects common high-severity slurs', () => {
      const results = verlux.detect('t\'es qu\'un connard de pédé');
      const matches = results.map(r => r.matched);
      expect(matches).toContain('connard');
      expect(matches).toContain('pédé');
    });

    it('detects banlieue slang', () => {
      const results = verlux.detect('je vais te niquer');
      expect(results.some(r => r.matched === 'niquer')).toBe(true);
    });
  });

  describe('phrases', () => {
    it('detects "fils de pute"', () => {
      const results = verlux.detect('sale fils de pute');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'fils de pute')
      ).toBe(true);
    });

    it('detects "va te faire foutre"', () => {
      const results = verlux.detect('mais va te faire foutre');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'va te faire foutre')
      ).toBe(true);
    });

    it('detects "nique ta mère"', () => {
      const results = verlux.detect('nique ta mère connard');
      expect(results.some(r => r.matched === 'nique ta mère')).toBe(true);
      expect(results.some(r => r.matched === 'connard')).toBe(true);
    });

    it('detects "trou du cul"', () => {
      const results = verlux.detect('quel trou du cul');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'trou du cul')
      ).toBe(true);
    });

    it('detects "ta gueule"', () => {
      const results = verlux.detect('ta gueule je te dis');
      expect(
        results.some(r => r.matchType === 'phrase' && r.matched === 'ta gueule')
      ).toBe(true);
    });
  });

  describe('false positives — French Scunthorpe cases', () => {
    // `con` family — the biggest French collision root
    const conFalsePositives = [
      'un concert magnifique',
      'selon la condition',
      'je vais le compte',
      'la conclusion du rapport',
      'conférence de presse',
      'il faut se connaître',
      'il est content',
      'le contenu du paquet',
      'le garçon joue',
      'un balcon au soleil',
    ];

    it.each(conFalsePositives)('does NOT flag innocent "con-" word: %s', (phrase) => {
      expect(verlux.detect(phrase)).toEqual([]);
    });

    // `pute` family
    const puteFalsePositives = [
      'le député a voté',
      'elle est très réputée',
      'une dispute banale',
      'son ordinateur est en panne',
    ];

    it.each(puteFalsePositives)('does NOT flag innocent "-pute" word: %s', (phrase) => {
      expect(verlux.detect(phrase)).toEqual([]);
    });

    // `bite` family
    const biteFalsePositives = [
      'il habite à Paris',
      'l\'orbite lunaire',
      'ils cohabitent',
    ];

    it.each(biteFalsePositives)('does NOT flag innocent "-bite" word: %s', (phrase) => {
      expect(verlux.detect(phrase)).toEqual([]);
    });

    // `salope` contains `escalope`
    it('does NOT flag "escalope" (veal cutlet)', () => {
      expect(verlux.detect('une escalope de veau')).toEqual([]);
    });

    // `cul` family
    const culFalsePositives = [
      'la culture française',
      'un calcul difficile',
      'il va cultiver la terre',
    ];

    it.each(culFalsePositives)('does NOT flag innocent "cul-" word: %s', (phrase) => {
      expect(verlux.detect(phrase)).toEqual([]);
    });

    // `merde` fuzzy collisions
    it('does NOT flag "merci"', () => {
      expect(verlux.detect('merci beaucoup')).toEqual([]);
    });
    it('does NOT flag "mercredi"', () => {
      expect(verlux.detect('on se voit mercredi')).toEqual([]);
    });
  });

  describe('language pack is registered', () => {
    it('lists fr among available languages', () => {
      expect(verlux.languages()).toContain('fr');
    });
  });
});
