/**
 * Alphanumeric codes — tokens that mix letters and digits without being l33t.
 *
 * The normalizer decodes digits as l33t (6→g, 1→i, 5→s, 0→o, …), which turned
 * ordinary codes into high-severity hits: the UK postcode inward code `6DU`
 * decoded to `gdu`, an alias of the Hinglish insult `gandu`; the London
 * district `N16` to `nig`; "900k views" to `gook`. `looksLikeCode` (and the
 * matcher's code context) keeps the digits of such tokens literal. The broad
 * sweep lives in scripts/audit-alnum-codes-fp.mjs; this file pins the cases.
 */
import { verlux } from '../src/index';
import { looksLikeCode, hasEdgeDigits, isHexBlob } from '../src/engine/normalizer';

describe('Alphanumeric codes are not decoded as l33t', () => {
  const codes: [string, string][] = [
    // The reported case and its digit twin (9→g as well)
    ['6DU', 'UK postcode inward code'],
    ['9DU', 'UK postcode inward code'],
    ['N16 6DU', 'full UK postcode'],
    ['N166DU', 'UK postcode without the space'],
    ['LA83 3DB', 'UK postcode'],
    ['LA833DB', 'UK postcode without the space'],
    ['N16', 'London postcode district'],
    ['N19', 'London postcode district'],
    ['HA9', 'Wembley postcode district'],
    ['HA6', 'postcode district'],
    ['SW1A 1AA', 'UK postcode with sub-district'],
    ['A55', 'UK road / Galaxy A55'],
    ['Samsung Galaxy A55', 'product model in prose'],
    ['N1G 2W1', 'Canadian postal code (Guelph)'],
    ['J4P', 'Canadian FSA (Brossard)'],
    ['H3L', 'Canadian FSA (Montreal)'],
    ['N5H1T3', 'Canadian postal code without the space'],
    ['A60 P3D0', 'Irish Eircode'],
    ['D6W P0YA', 'Irish Eircode'],
    ['600k', 'quantity'],
    ['900k views', 'quantity in prose'],
    ['AB05', 'postcode-style label'],
    ['10kg', 'quantity with unit'],
    ['5H1790', 'flight number'],
    ['4B1300', 'flight number'],
    ['5H46', 'short flight number'],
    ['ab33df5', 'git short SHA'],
    ['7bffb32abeed', 'hex hash'],
    ['de95fb79-4227-86ab-eede-08c4e87a1465', 'UUID'],
    ['b57bd172-b9aa-6567-caca-62b3970156cc', 'UUID with a word-like group'],
    ['SKU-B00B-42', 'hyphenated SKU'],
    ['SKU-6DU-22', 'hyphenated SKU'],
    ['(6DU)', 'bracketed code'],
    ['6-DU', 'hyphenated code'],
  ];

  it.each(codes)('does NOT flag "%s" (%s)', (input) => {
    expect(verlux.detect(input)).toEqual([]);
  });

  const usernames: [string, string][] = [
    ['twinkle12', 'safelisted word + number'],
    ['99twinkle', 'number + safelisted word'],
    ['brat123', 'word + 3-digit number'],
    ['chars12', 'word + 2-digit number (fuzzy collision)'],
    ['faa69', 'collapse-only collision'],
    ['99rope', 'collapse-only collision'],
    ['bimbashi7', 'edge digit completing a substring'],
    ['orgasm7', 'safelisted word + digit'],
  ];

  it.each(usernames)('does NOT flag "%s" (%s)', (input) => {
    expect(verlux.detect(input)).toEqual([]);
  });
});

describe('L33t spellings are still detected', () => {
  const leet: [string, string][] = [
    ['g4ndu', 'gandu'],
    ['sh1t', 'shit'],
    ['$h1t', 'shit'],
    ['n1gg3r', 'nigger'],
    ['N.1.G.G.3.R', 'nigger'],
    ['a55hole', 'asshole'],
    ['pu55y', 'pussy'],
    ['b00bs', 'boobs'],
    ['r46head', 'raghead'],
    ['n1g6er', 'nigger'],
    ['5lut', 'slut'],
    ['whor3', 'whore'],
    ['3some', 'threesome'],
    ['fagg07', 'faggot'],
    ['sam80', 'sambo'],
    ['fuck99', 'fuck'],
    ['@ss', 'ass'],
  ];

  it.each(leet)('detects "%s" as %s', (input, expected) => {
    const results = verlux.detect(input);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matched).toBe(expected);
  });

  it('still detects l33t next to a code that is not a postcode prefix', () => {
    const results = verlux.detect('the 2nd b1tch');
    expect(results.map(r => r.matched)).toContain('bitch');
  });

  it('reports the l33t word, not the code, in mixed text', () => {
    const results = verlux.detect('Order N16 6DU shipped, what a sh1t service');
    expect(results.map(r => r.matched)).toEqual(['shit']);
  });
});

describe('looksLikeCode', () => {
  it.each(['6DU', 'N16', 'J4P', '600k', 'AB05', '10kg', 'brat123', '5H46', '5H1790', 'ab33df5', 'LA833DB', 'N5H1T3'])(
    'treats "%s" as a code',
    (token) => expect(looksLikeCode(token)).toBe(true)
  );

  it.each(['sh1t', 'n1gg3r', 'a55hole', '5lut', 'whor3', 'fagg07', 'b00bs', 'r46head', 'hello', '422'])(
    'treats "%s" as a word',
    (token) => expect(looksLikeCode(token)).toBe(false)
  );

  it('flags one-edge digit blocks for whole-word-only decoding', () => {
    expect(hasEdgeDigits('whor3')).toBe(true);
    expect(hasEdgeDigits('fagg07')).toBe(true);
    expect(hasEdgeDigits('sh1t')).toBe(false);
    expect(hasEdgeDigits('hello')).toBe(false);
  });

  it('recognises hex identifiers', () => {
    expect(isHexBlob('7bffb32abeed')).toBe(true);
    expect(isHexBlob('de95fb79-4227-86ab-eede-08c4e87a1465')).toBe(true);
    expect(isHexBlob('b00b')).toBe(false); // too short to tell from l33t
    expect(isHexBlob('deadbeef')).toBe(false); // no digit
  });
});
