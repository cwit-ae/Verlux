/**
 * Phrase context: contraction expansion and per-phrase context constraints
 * (`notFollowedBy`, `notPrecededBy`, `atClauseEnd`).
 *
 * The everyday-sentence lists are the regression corpus for the phrase tier:
 * each sentence was flagged by an earlier dictionary entry that matched the
 * words without looking at what came next. Add to them whenever a phrase
 * entry is narrowed.
 */
import { verlux, createInstance } from '../src/index';
import { expandContractions } from '../src/engine/phrase-context';
import { tokenize } from '../src/engine/tokenizer';
import type { PhraseEntry } from '../src/types';

const expand = (s: string) => expandContractions(tokenize(s), s).map(t => t.value);

describe('expandContractions', () => {
  it.each([
    ["you'll", ['you', 'will']],
    ['you’ll', ['you', 'will']],
    ["I'm", ['i', 'am']],
    ["you're", ['you', 'are']],
    ["we've", ['we', 'have']],
    ["I'd", ['i', 'would']],
    ["didn't", ['did', 'not']],
    ["won't", ['will', 'not']],
    ["can't", ['can', 'not']],
    ["ain't", ['is', 'not']],
    ["it's", ['it', 'is']],
    ['gonna', ['going', 'to']],
    ['wanna', ['want', 'to']],
    ['imma', ['i', 'am', 'going', 'to']],
    ['im', ['i', 'am']],
    ['youre', ['you', 'are']],
    ['u r', ['you', 'are']],
  ])('expands %s', (input, expected) => {
    expect(expand(input)).toEqual(expected);
  });

  it.each([
    ["mom's", ['mom', 's']],          // possessive, not "mom is"
    ['I m', ['I', 'm']],              // a space is not an apostrophe
    ['ill', ['ill']],                 // the adjective, not "I will"
    ['well', ['well']],
    ['hell', ['hell']],
    ['ur', ['ur']],                   // "your" or "you are" — not guessed
  ])('leaves %s alone', (input, expected) => {
    expect(expand(input)).toEqual(expected);
  });

  it('gives both halves of a one-word expansion the span of that word', () => {
    const [going, to] = expandContractions(tokenize('gonna'), 'gonna');
    expect([going.start, going.end]).toEqual([0, 5]);
    expect([to.start, to.end]).toEqual([0, 5]);
    expect(going.source).toBe(to.source);
  });
});

describe('contracted threats are detected', () => {
  it.each([
    "I'll kill you",
    'I’ll kill you',
    "I'm going to kill you",
    "I'm gonna kill you",
    'im gonna kill you',
    'imma kill you',
    "I'll kill him",
    "you're dead",
    'u r dead',
    "I'll find you.",
    "you'll regret this",
    "I'll make you regret it",
    "you'll pay for this!",
    "you'll pay for what you did",
    "you'll pay dearly for this",
    "I'll make you pay!",
  ])('flags "%s" as a threat', (text) => {
    expect(verlux.detect(text).some(r => r.category === 'threat')).toBe(true);
  });

  it.each([
    "you're pathetic",
    "you're worthless",
    "you're a waste of space",
  ])('flags the insult "%s"', (text) => {
    expect(verlux.detect(text).some(r => r.category === 'insult')).toBe(true);
  });

  it('flags "wanna die" like "want to die"', () => {
    expect(verlux.detect('i wanna die').some(r => r.matched === 'want to die')).toBe(true);
  });
});

describe('threats are still detected in full', () => {
  it.each([
    'I will kill you',
    'we will kill you',
    'I will murder you',
    "they're going to kill you",
    'I will find you',
    'I will find you and you will regret this',
    'you should die',
    'you should die in a fire',
    'all of them should die',
    'you deserve to die',
    'you better watch your back.',
    'you are dead',
    "you're dead meat",
    'you will regret this',
    "you'll regret crossing me",
    'you will pay for this',
    'You will pay for that!',
    'you will pay for this, I swear',
    'you will pay for what you did',
    'you will pay dearly',
    'you will pay with your life',
    "I'll get you fired",
  ])('flags "%s"', (text) => {
    expect(verlux.detect(text).some(r => r.category === 'threat')).toBe(true);
  });

  it.each([
    ['do me a favor and die', 'insult'],
    ['do us a favour and die', 'insult'],
    ['white trash', 'slur'],
    ['teri maa ki', 'sexual'],
    ['teri maa ki...', 'sexual'],
    ['teri behen ki.', 'sexual'],
    ['तेरी माँ की', 'sexual'],
    ['te voy a matar', 'threat'],
    ['te voy a matar, cabrón', 'threat'],
  ])('flags "%s" (%s)', (text, category) => {
    expect(verlux.detect(text).some(r => r.category === category)).toBe(true);
  });
});

describe('everyday sentences are not flagged', () => {
  it.each([
    // "you will pay" — billing
    'you will pay',
    'you will pay the bill',
    'you will pay by card',
    'you will pay later',
    "you'll pay at checkout",
    'you will pay monthly',
    'you will pay for this order on delivery',
    'you will pay for this service monthly',
    "you'll pay for that separately",
    "you'll pay dearly in fuel costs",
    'I will make you pay the deposit first',
    // "i will kill"
    'I will kill the process and restart the server',
    'I will kill two birds with one stone',
    'I will kill some time at the airport',
    "I'll kill it at the interview tomorrow",
    'smoking is going to kill you',
    "your dad's gonna kill you when he sees this",
    "it's going to kill you, that hill",
    // "i will find you"
    'I will find you a seat near the window',
    "I'll find you the link tomorrow",
    'I will find you a better quote',
    // "should die" / "deserve to die"
    'the noise should die down soon',
    'the hype should die down after launch',
    'old leaves should die back in winter',
    'nobody should die waiting for care',
    'no one should die alone',
    'they did not deserve to die',
    "they didn't deserve to die",
    // "watch your back" / "you are dead"
    'watch your back when lifting heavy boxes',
    'watch your back posture at the desk',
    'you are dead right about that',
    "you're dead on with that analysis",
    'you are dead serious, I can tell',
    // "you will regret"
    'you will regret not buying this deal',
    'you will regret missing this sale',
    'if you skip stretching you will regret it',
    // "get you fired" / "do us a favor" / "waste of space"
    'this song will get you fired up',
    'could you do us a favor and send the report',
    'do us a favor and RSVP by Friday',
    'this sidebar is a waste of space',
    // "white trash" / "shut up" / "jack off"
    'put it in the white trash bag',
    'empty the white trash can in the kitchen',
    'shut up shop for the night',
    'take the jack off the car',
    // Hinglish: "behen ki" is "sister's", "teri maa ki" asks after a mother
    'meri behen ki shaadi hai',
    'meree behen ki shaadi hai',
    'behen ki tabiyat theek nahi hai',
    'uski behen ki',
    'teri maa ki tabiyat kaisi hai',
    // Spanish idioms
    'te voy a matar de risa',
    'te voy a matar a besos',
  ])('"%s"', (text) => {
    expect(verlux.detect(text)).toEqual([]);
  });
});

describe('phrase results', () => {
  it('report the exact input text as `original`', () => {
    const [r] = verlux.detect('you’ll  pay for this!');
    expect(r.matched).toBe('you will pay for this');
    expect(r.original).toBe('you’ll  pay for this');
    expect(r.position).toEqual([0, 20]);
  });

  it('are whitelisted under either spelling', () => {
    expect(verlux.detect("you'll pay for this!", { whitelist: ['you will pay for this'] })).toEqual([]);
    expect(verlux.detect("you'll pay for this!", { whitelist: ["you'll pay for this"] })).toEqual([]);
  });
});

describe('custom phrase context (addPhrases)', () => {
  const base = { language: 'en', severity: 'medium', category: 'other' } as const;
  const phrase = (p: string, extra: Partial<PhraseEntry> = {}): PhraseEntry =>
    ({ phrase: p, words: p.split(' '), ...base, ...extra });

  const withPhrases = (...entries: PhraseEntry[]) => {
    const v = createInstance({ languages: ['en'] });
    v.addPhrases(entries);
    return (text: string) => v.detect(text).filter(r => r.matchType === 'phrase').map(r => r.matched);
  };

  it('notFollowedBy cancels on the next word, case-insensitively', () => {
    const detect = withPhrases(phrase('launch the rockets', { notFollowedBy: ['tomorrow'] }));
    expect(detect('launch the rockets now')).toEqual(['launch the rockets']);
    expect(detect('launch the rockets Tomorrow')).toEqual([]);
  });

  it('notFollowedBy items with several words must match the whole sequence', () => {
    const detect = withPhrases(phrase('launch the rockets', { notFollowedBy: ['at dawn'] }));
    expect(detect('launch the rockets at dawn')).toEqual([]);
    expect(detect('launch the rockets at noon')).toEqual(['launch the rockets']);
  });

  it('punctuation between the phrase and the next word breaks the link', () => {
    const detect = withPhrases(phrase('launch the rockets', { notFollowedBy: ['tomorrow'] }));
    expect(detect('launch the rockets. Tomorrow we rest')).toEqual(['launch the rockets']);
  });

  it('notPrecededBy cancels on the previous word, after contractions are expanded', () => {
    const detect = withPhrases(phrase('launch the rockets', { notPrecededBy: ['not'] }));
    expect(detect('please launch the rockets')).toEqual(['launch the rockets']);
    expect(detect('do not launch the rockets')).toEqual([]);
    expect(detect("don't launch the rockets")).toEqual([]);
  });

  it('atClauseEnd requires the end of the text, punctuation, or a line break', () => {
    const detect = withPhrases(phrase('launch the rockets', { atClauseEnd: true }));
    expect(detect('launch the rockets')).toEqual(['launch the rockets']);
    expect(detect('launch the rockets!')).toEqual(['launch the rockets']);
    expect(detect('launch the rockets, then rest')).toEqual(['launch the rockets']);
    expect(detect('launch the rockets\nnext item')).toEqual(['launch the rockets']);
    expect(detect('launch the rockets 🚀')).toEqual(['launch the rockets']);
    expect(detect('launch the rockets carefully')).toEqual([]);
  });

  it('matches a custom phrase written with a contraction in either spelling', () => {
    const detect = withPhrases(phrase("we'll launch the rockets"));
    expect(detect("we'll launch the rockets")).toEqual(["we'll launch the rockets"]);
    expect(detect('we will launch the rockets')).toEqual(["we'll launch the rockets"]);
  });

  it('matches a custom phrase longer than five words', () => {
    const detect = withPhrases(phrase('the quick brown fox jumps over'));
    expect(detect('the quick brown fox jumps over the dog')).toEqual(['the quick brown fox jumps over']);
  });

  it.each([
    [{ notFollowedBy: 'tomorrow' }, /notFollowedBy/],
    [{ notFollowedBy: [''] }, /notFollowedBy/],
    [{ notPrecededBy: [42] }, /notPrecededBy/],
    [{ atClauseEnd: 'yes' }, /atClauseEnd/],
  ])('rejects malformed context %j', (extra, message) => {
    const v = createInstance();
    expect(() => v.addPhrases([phrase('launch the rockets', extra as Partial<PhraseEntry>)]))
      .toThrow(message);
  });
});
