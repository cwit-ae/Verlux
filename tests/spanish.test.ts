import { verlux } from '../src/index';

describe('Spanish detection', () => {
  describe('accented + accent-stripped forms', () => {
    it('detects accented word', () => {
      const results = verlux.detect('eres un cabrón');
      expect(results.some(r => r.matched === 'cabrón')).toBe(true);
      expect(results[0].language).toBe('es');
    });

    it('detects accent-stripped variant', () => {
      const results = verlux.detect('eres un cabron');
      expect(results.some(r => r.matched === 'cabrón')).toBe(true);
    });

    it('detects ñ word with and without tilde', () => {
      expect(verlux.detect('qué coño').some(r => r.matched === 'coño')).toBe(true);
      // Plain "cono" (cone) is safelisted to avoid false positives
      expect(verlux.detect('un cono de helado')).toEqual([]);
    });

    it('detects common Mexican slang', () => {
      const results = verlux.detect('que pendejo eres');
      expect(results.some(r => r.matched === 'pendejo')).toBe(true);
    });

    it('detects Argentine slang', () => {
      const results = verlux.detect('sos un boludo pelotudo');
      const matches = results.map(r => r.matched);
      expect(matches).toContain('boludo');
      expect(matches).toContain('pelotudo');
    });

    it('detects Spain-specific insult', () => {
      const results = verlux.detect('vaya gilipollas');
      expect(results.some(r => r.matched === 'gilipollas')).toBe(true);
    });
  });

  describe('phrases', () => {
    it('detects "hijo de puta"', () => {
      const results = verlux.detect('eres un hijo de puta');
      expect(results.some(r => r.matchType === 'phrase' && r.matched === 'hijo de puta')).toBe(true);
    });

    it('detects "chinga tu madre" phrase, not just the verb', () => {
      const results = verlux.detect('chinga tu madre');
      const phrase = results.find(r => r.matchType === 'phrase');
      expect(phrase?.matched).toBe('chinga tu madre');
    });

    it('detects "la concha de tu madre"', () => {
      const results = verlux.detect('la concha de tu madre boludo');
      expect(results.some(r => r.matched === 'la concha de tu madre')).toBe(true);
      expect(results.some(r => r.matched === 'boludo')).toBe(true);
    });

    it('detects "me cago en dios"', () => {
      const results = verlux.detect('joder, me cago en dios');
      expect(results.some(r => r.matched === 'me cago en dios')).toBe(true);
    });
  });

  describe('mixed-language input (automatic, no language hint needed)', () => {
    it('detects English + Spanish + Hinglish in one sentence', () => {
      const results = verlux.detect('hello fuck you cabrón bhenchod');
      const langs = new Set(results.map(r => r.language));
      expect(langs.has('en')).toBe(true);
      expect(langs.has('es')).toBe(true);
      expect(langs.has('hi-latn')).toBe(true);
    });
  });

  describe('false positives', () => {
    it('does not flag "cono" meaning cone', () => {
      expect(verlux.detect('un cono de helado por favor')).toEqual([]);
    });

    it('does not flag "pollo" (chicken)', () => {
      expect(verlux.detect('el pollo está rico')).toEqual([]);
    });

    it('does not flag words containing "culo" substring', () => {
      expect(verlux.detect('este círculo es ridículo')).toEqual([]);
      expect(verlux.detect('el oculto vínculo')).toEqual([]);
    });

    it('does not flag "cacao"', () => {
      expect(verlux.detect('me gusta el cacao')).toEqual([]);
    });
  });

  describe('censor', () => {
    it('censors Spanish profanity', () => {
      const censored = verlux.censor('eres un cabrón');
      expect(censored).not.toContain('cabrón');
      expect(censored).toContain('******');
    });
  });

  describe('language pack is registered', () => {
    it('lists es among available languages', () => {
      expect(verlux.languages()).toContain('es');
    });
  });
});
