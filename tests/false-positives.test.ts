/**
 * False positive tests — the Scunthorpe problem.
 * These words contain profane substrings but MUST NOT be flagged.
 */
import { verlux } from '../src/index';

describe('False Positives — Innocent Words', () => {
  // Words containing "ass"
  const assWords = [
    'class', 'classic', 'classical', 'classification', 'classified', 'classroom',
    'classmate', 'glass', 'glasses', 'pass', 'passing', 'passion', 'passionate',
    'compass', 'assembly', 'assemble', 'assistant', 'assistance', 'assisted',
    'assistantship', 'assessment', 'assign', 'assignment', 'assert', 'bass',
    'embassy', 'passport', 'passcode', 'passage', 'passenger', 'associate',
    'association', 'assumption', 'assure', 'asset', 'assets', 'Assam',
  ];

  // Words containing "cock"
  const cockWords = [
    'cocktail', 'cocktails', 'cockpit', 'peacock', 'peacocks',
    'shuttlecock', 'weathercock', 'haycock', 'cockburn',
  ];

  // Words containing "cum"
  const cumWords = [
    'document', 'documentary', 'documented', 'accommodation',
    'accumulate', 'succumb', 'circumstance', 'circumstantial', 'cumulative',
  ];

  // Words containing "hell"
  const hellWords = ['hellenic', 'shell', 'shells', 'Shell'];

  // Words containing "butt"
  const buttWords = ['butter', 'butterfly', 'buttress', 'button', 'buttons', 'buttoneer'];

  // Words containing "tit"
  const titWords = ['titmouse', 'titmice'];

  // Words containing "pen" (from penis)
  const penWords = ['penal', 'penalty', 'penalties', 'peninsula', 'peninsular'];

  // Words containing "anal"
  const analWords = ['analysis', 'analog', 'canal', 'canals'];

  // Words containing "organ" (from orgasm)
  const organWords = ['organism', 'organisms'];

  // Proper names that overlap with profanity
  const properNames = ['Dickson', 'Gay', 'Penistone', 'Scunthorpe'];

  // UK place names — Scunthorpe problem (profane substrings inside real places)
  const ukPlaceNames = [
    'Bitchfield', 'Wetwang', 'Scratchy Bottom', 'Sandy Balls', 'Crapstone',
    'Bell End', 'Nob End', 'Cockermouth', 'Fingringhoe', 'Brown Willy',
    'River Piddle', 'Pratts Bottom', 'Muff', 'Ugley', 'Brokenwind',
    'Essex', 'Sussex', 'Middlesex',
  ];

  // Educational / medical contexts
  const medicalContexts = [
    'sex education', 'sexual health', 'breast cancer',
    'breastfeeding', 'intercourse statistics', 'erection angle',
  ];

  // Other words
  const miscWords = [
    'astronaut', 'astute', 'Scaffold',
  ];

  const allInnocentWords = [
    ...assWords, ...cockWords, ...cumWords, ...hellWords, ...buttWords,
    ...titWords, ...penWords, ...analWords, ...organWords, ...properNames,
    ...miscWords, ...ukPlaceNames,
  ];

  it.each(allInnocentWords)('should NOT flag "%s"', (word) => {
    const results = verlux.detect(word);
    expect(results).toHaveLength(0);
  });

  // Medical/educational phrases
  it.each(medicalContexts)('should NOT flag medical context: "%s"', (phrase) => {
    const results = verlux.detect(phrase);
    expect(results).toHaveLength(0);
  });

  // Verify the ACTUAL profanity still gets caught
  const realProfanity = [
    'fuck', 'fucking', 'fucked', 'shit', 'shitty', 'bullshit',
    'asshole', 'bitch', 'bitches', 'cunt', 'nigger', 'faggot',
    'bhenchod', 'bc', 'madarchod', 'mc', 'chutiya', 'gandu',
  ];

  it.each(realProfanity)('should CATCH actual profanity: "%s"', (word) => {
    const results = verlux.detect(word);
    expect(results.length).toBeGreaterThan(0);
  });
});
