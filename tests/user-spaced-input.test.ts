import { verlux } from '../src/index';

describe('User spaced-input accuracy probe', () => {
  const cases: { input: string; expected: string; lang: string }[] = [
    { input: 'f u c k',         expected: 'fuck',      lang: 'en' },
    { input: 's h i t',         expected: 'shit',      lang: 'en' },
    { input: 'b i t c h',       expected: 'bitch',     lang: 'en' },
    { input: 'a s s h o l e',   expected: 'asshole',   lang: 'en' },
    { input: 'm a d a r c h o d', expected: 'madarchod', lang: 'hi-latn' },
    { input: 'b e h e n c h o d', expected: 'bhenchod',  lang: 'hi-latn' },
    { input: 'c h u t i y a',   expected: 'chutiya',   lang: 'hi-latn' },
    { input: 'k a m i n a',     expected: 'kamina',    lang: 'hi-latn' },
    { input: 'k u t t a',       expected: 'kutta',     lang: 'hi-latn' },
  ];

  it.each(cases)('detects "$input" as $expected ($lang)', ({ input, expected, lang }) => {
    const results = verlux.detect(input);
    // Dump the first result for diagnostic output
    console.log(JSON.stringify({ input, results }, null, 2));
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matched).toBe(expected);
    expect(results[0].language).toBe(lang);
  });
});
