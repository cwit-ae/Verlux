/**
 * The transliteration tier is scoped to hi-latn.
 *
 * `transliterate()` folds Roman-script input phonetically (kh→k, bh→b, dh→d,
 * sh→s, th→t, ph→f, ai→e, oo→u, ee→i, applied cumulatively) so that Hindi
 * abuse — which has no standard romanization — is caught however it is
 * spelled. The fold is deliberately lossy, and it used to be matched against
 * the *unified* index, so any word in any language sharing the resulting
 * skeleton with a dictionary entry was flagged.
 *
 * That turned ordinary vocabulary into high-severity hits: `pushy` → `pussy`,
 * `nigh` → `nigger`, `dikhai` (Hindi for "visible") → the slur `dyke`.
 * `TRANSLITERATION_LANGUAGE` in matcher.ts now confines the tier to the one
 * dictionary it was built for.
 */
import { verlux, createInstance } from '../src/index';
import { getWords } from '../src/dictionaries';
import { transliterate } from '../src/engine/transliterator';

describe('Transliteration tier is scoped to hi-latn', () => {
  // ── The reported case ───────────────────────────────────────────────
  describe('the reported regression: "dikhai"', () => {
    const usages = [
      'dikhai',
      'mujhe dikhai de raha hai',
      'kuch dikhai nahi diya',
      'Dikhai',
      'DIKHAI',
    ];
    it.each(usages)('does NOT flag "%s"', (text) => {
      expect(verlux.detect(text)).toHaveLength(0);
    });
  });

  // ── The class the gate closes ───────────────────────────────────────
  // Everyday NON-Hindi words whose Hinglish fold lands on a foreign root.
  // Each is annotated with the fold that used to produce the false hit.
  const crossLanguageFoldCollisions: Array<[string, string]> = [
    ['pushy', 'sh→s → pusy → en pussy (HIGH)'],
    ['nigh', 'gh→g → nig → en nigger (HIGH)'],
    ['dikhai', 'kh→k, ai→e → dike → en dyke (HIGH)'],
    ['dikhaai', 'kh→k, aa→a, ai→e → dike → en dyke (HIGH)'],
    ['nikhai', 'kh→k, ai→e → nike → fr niquer (HIGH)'],
    ['neep', 'ee→i → nip → en nip (HIGH)'],
    ['neeps', 'ee→i → nips → en nip (HIGH)'],
    ['jeez', 'ee→i → jiz → en jizz'],
    ['deek', 'ee→i → dik → en dick'],
    ['coonty', 'oo→u → cunty → en cunt (HIGH)'],
    ['cauk', 'au→o → cok → en cock (HIGH)'],
    ['scath', 'th→t → scat → en scat (HIGH)'],
    ['farthing', 'th→t → farting → en fart'],
    ['leear', 'ee→i → liar → en liar'],
    ['leears', 'ee→i → liars → en liar'],
    ['cools', 'oo→u → culs → fr cul'],
    ['fouth', 'th→t → fout → fr foutre (HIGH)'],
    ['theta', 'th→t → teta → es tetas'],
    ['thetas', 'th→t → tetas → es tetas'],
    ['pithos', 'th→t → pitos → es pito'],
  ];

  it.each(crossLanguageFoldCollisions)(
    'does NOT flag "%s" (%s)',
    (word) => {
      expect(verlux.detect(word)).toHaveLength(0);
    }
  );

  it('leaves the words clean in running prose too', () => {
    expect(verlux.detect('the end is nigh')).toHaveLength(0);
    expect(verlux.detect('a pushy salesman')).toHaveLength(0);
    expect(verlux.detect('plot theta against time')).toHaveLength(0);
  });

  // ── The structural invariant that makes the gate free ───────────────
  // Tier 2.5 must never be the ONLY route to a dictionary surface form:
  // Tier 1 (exact) and Tier 2 (normalizeVariants) already cover every key.
  // Stated differentially so the assertion is about the tier alone and not
  // about phrases or safelisted keys — whatever the default config detects,
  // the same config with the tier switched off must detect too. If this ever
  // fails, scoping the tier would have begun dropping real hits.
  it('adds no coverage of its own over any dictionary surface form', () => {
    const noTranslit = createInstance({ transliteration: false });
    const lostWithoutTier: string[] = [];

    for (const entry of getWords(null)) {
      for (const key of [entry.word, ...entry.normalized, ...entry.aliases]) {
        if (verlux.detect(key).length === 0) continue; // safelisted / phrase-only
        if (noTranslit.detect(key).length === 0) lostWithoutTier.push(key);
      }
    }

    expect(lostWithoutTier).toEqual([]);
  });

  // ── The gate itself ─────────────────────────────────────────────────
  it('never returns a non-hi-latn match for a fold-only input', () => {
    // Inputs whose ONLY route to the dictionary is the Hinglish fold.
    const foldOnly = crossLanguageFoldCollisions.map(([w]) => w);
    for (const word of foldOnly) {
      // Sanity: the fold really does rewrite these (otherwise the case is moot).
      expect(transliterate(word).length).toBeGreaterThan(1);
      for (const result of verlux.detect(word)) {
        expect(result.language).toBe('hi-latn');
      }
    }
  });

  // ── Hindi abuse detection is unchanged ──────────────────────────────
  const hinglishProfanity = [
    // canonical
    'bhenchod', 'madarchod', 'chutiya', 'gandu', 'gaand', 'lund', 'chut',
    'saala', 'randi', 'harami', 'haramzada', 'bhosdike',
    // alternate romanizations the fold exists to catch
    'benchod', 'bhencod', 'behenchod', 'madarcod', 'chootiya', 'choot',
    'lauda', 'loda', 'bhosadike',
  ];

  it.each(hinglishProfanity)('still CATCHES "%s"', (word) => {
    expect(verlux.detect(word).length).toBeGreaterThan(0);
  });
});

/**
 * The phrase tier gets the same treatment as the word tier.
 *
 * It used to do a single `normalize()` lookup and nothing else, which meant
 * Hinglish phrases matched only on the exact spelling stored in the
 * dictionary — even though the whole reason the folds exist is that Hinglish
 * has no standard spelling. It also consulted no whitelist at all.
 */
describe('Phrase tier', () => {
  it('matches a Hinglish phrase however it is spelled', () => {
    // Both sides have to be folded: folding only the input takes
    // `teri maa kee` to `terimaki` while the stored key is still `terimaaki`.
    for (const spelling of ['teri maa ki', 'teri maa kee', 'maa ki aankh', 'maa kee aankh']) {
      const results = verlux.detect(spelling);
      expect(results.some(r => r.matchType === 'phrase')).toBe(true);
    }
  });

  it('honours the caller whitelist', () => {
    // `whitelist: ['shut up']` could not suppress a phrase entry, even though
    // the README presents the whitelist as the escape hatch for exactly this.
    expect(verlux.detect('shut up').length).toBeGreaterThan(0);
    const scoped = createInstance({ whitelist: ['shut up'] });
    expect(scoped.detect('shut up')).toHaveLength(0);
  });

  it('keeps the folded phrase index scoped to hi-latn', () => {
    // An English phrase must stay reachable only by its real spelling — the
    // folds must not manufacture a second key for it.
    const scoped = createInstance({ languages: ['en'] });
    expect(scoped.detect('shut up').length).toBeGreaterThan(0);
    expect(scoped.detect('sut up')).toHaveLength(0);
  });

  it('leaves benign multi-word Hindi alone', () => {
    for (const text of [
      'teri maa ka naam kya hai',
      'chup chap baith jao',
      'meri behen ka ghar',
      'मेरी बहन का घर',
      'कृपया चुप रहिए',
    ]) {
      expect(verlux.detect(text)).toHaveLength(0);
    }
  });
});

/**
 * Residue the gate cannot fix: collisions *within* hi-latn, plus one produced
 * by the l33t normalizer rather than the transliterator. These are handled by
 * the `hi-latn` safelist bucket in matcher.ts.
 */
describe('Hinglish safelist — everyday words that fold onto a hi-latn root', () => {
  const benign: Array<[string, string]> = [
    ['shaala', 'शाला school — sh→s, aa→a → sala → saala'],
    ['shala', 'same fold, short spelling'],
    ['shaalaa', 'same fold'],
    ['chhoot', 'छूट discount / छूत contagion — chh→ch, oo→u → chut (HIGH)'],
    ['achhoot', 'अछूत untouchable — same fold'],
    ['gandh', 'गंध smell — dh→d → gand → gaand (HIGH)'],
    ['lodha', 'surname / property developer — dh→d → loda → lund (HIGH)'],
    ['phool', 'फूल flower — normalizer ph→f → fool'],
    ['phools', 'plural of the same'],
  ];

  it.each(benign)('does NOT flag "%s" (%s)', (word) => {
    expect(verlux.detect(word)).toHaveLength(0);
  });

  it('does not blanket-exempt compounds containing the safelisted stem', () => {
    // These come out clean on their own merits, not via the safelist — so a
    // real match hiding inside a longer token is still reachable.
    const compounds = [
      'vidyashaala', 'dharamshala', 'sugandh', 'durgandh', 'gandhak',
      'phoolon', 'phoolgobhi', 'lodhi', 'gandhi', 'gandhinagar',
      'choudhary', 'chaudhary', 'randhawa', 'bhosale',
    ];
    for (const word of compounds) {
      expect(verlux.detect(word)).toHaveLength(0);
    }
  });

  it('keeps the real roots and their obfuscations detectable', () => {
    // Safelisting is exact-surface-only — it must not shield the profanity.
    const stillFlagged = [
      'saala', 'saale', 'sala',
      'chut', 'choot', 'chhut',
      'gaand', 'gand', 'gandu',
      'lund', 'loda', 'lauda', 'lawda',
      'fool', 'fools',
    ];
    for (const word of stillFlagged) {
      expect(verlux.detect(word).length).toBeGreaterThan(0);
    }
  });

  it('is scoped to hi-latn, so English-only mode keeps ph→f deobfuscation', () => {
    // The bucket is active when the caller says the text may contain Hindi.
    // Scoped to English only, "phool" is a plausible ph→f obfuscation of
    // "fool" — the same rule that catches "phuck" — and should still fire.
    const englishOnly = createInstance({ languages: ['en'] });
    expect(englishOnly.detect('phool').length).toBeGreaterThan(0);
    expect(verlux.detect('phool')).toHaveLength(0);
  });
});
