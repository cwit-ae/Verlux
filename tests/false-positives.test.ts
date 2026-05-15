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

  // Words starting with "cl" — previously collided with "dick" because the
  // normalizer applied a `cl → d` l33t substitution unconditionally, turning
  // "click" into "dick" after normalization.
  const clWords = [
    'click', 'clicks', 'clicked', 'clicking', 'clicker',
    'double click', 'click here',
  ];

  // Pure-digit tokens: SINGLE_MAP would decode "422" → "azz" (ass alias),
  // "1337" → "ieet", etc. Digit-only obfuscation isn't readable as profanity
  // to humans, so the normalizer skips l33t decoding for all-digit tokens.
  const numericStrings = [
    '422', '1337', '404', '200', '500', '42',
    '0000', '9999', 'HTTP 422', 'status 500',
  ];

  // Fuzzy-match collisions at similarity 0.857 (one edit in a 7-char word).
  // These are legitimate English words that sit one edit away from a
  // dictionary entry and must be caught by the internal safelist.
  const fuzzyCollisions = [
    // near "scammer"
    'spammer', 'scamper', 'slammer', 'stammer',
    'spammers', 'scampered', 'scampering',
    // near "shitter"
    'shatter', 'shutter', 'shotter',
    'shattered', 'shattering', 'shuttered',
    // near "twink"
    'twinkle', 'twinkled', 'twinkles', 'twinkling',
    // near "fagging" (one edit, similarity 0.857-0.875)
    'flag', 'flags', 'flagged', 'flagging',
    'frag', 'frags', 'fragged', 'fragging',
    // near "shagging" (one edit, similarity 0.857-0.875)
    'sag', 'sags', 'sagged', 'sagging', 'saggy',
    'snag', 'snags', 'snagged', 'snagging',
    'slag', 'slags', 'slagged', 'slagging',
    'stag', 'stags',
    'swag',
    // near "shit" — "sheet" is everyday English (bedsheet, spreadsheet)
    'sheet', 'sheets',
    // near "shitter"/"shitting" (one edit, similarity 0.857-0.875)
    'sit', 'sits', 'sitter', 'sitters', 'sitting', 'sittings',
    'skit', 'skits', 'skitter', 'skitters',
    'slit', 'slits', 'slitter', 'slitting',
    'spit', 'spits', 'spitter', 'spitters', 'spitting',
    'shifter', 'shifters', 'shifting', 'shutting',
    // near "fisting" (common everyday words)
    'fasting', 'fishing', 'fitting', 'foisting', 'phishing',
    // near "shagger"
    'stagger', 'swagger',
    // near "strangle"
    'strange', 'straggle',
    // near "cracker"
    'cracked',
    // near "bollocks"
    'bullocks',
    // near "bondage"
    'bandage', 'bandages',
    // near "bastard"
    'bustard', 'bastardy',
    // near "bullshit"
    'bullshot',
    // near "bugger"
    'buggier',
    // near "behead"
    'bedhead',
    // near "groomer"
    'groomed',
    // near "inferior"
    'interior', 'interiors',
    // near "revolting"
    'revolving',
    // near "scammer"
    'scammed',
    // near "shitload"
    'shipload',
    // near "tribadism"
    'tribalism',
    // near "blumpkin"
    'bumpkin',
    // near "tranny"
    'tyranny',
    // near "fagging"
    'fogging',
    // near "frotting"
    'fretting', 'fronting', 'frosting', 'frothing',
    // near "willies"
    'wellies', 'wallies',
    // near "savages"
    'salvages',
    // near "jackass"
    'jackals',
    // near "fingering" — "fingerling" is a baby fish / small potato
    'fingerling', 'fingerlings',
    // near "shitters" — "slitters" is a cutting tool
    'slitters',
    // near "cripple" — "cripples" (verb) is common in news/business
    'cripples',
    // near "shibari"
    'shikari',
    // near "tribadism"
    'triadism',
    // near "fuck" — 1-sub at first char, plus fu- words
    'duck', 'ducks', 'ducking', 'duckling',
    'luck', 'lucky', 'luckily',
    'muck', 'mucky', 'mucking',
    'buck', 'bucks', 'buckle',
    'tuck', 'tucker', 'tucking',
    'yuck', 'yucky',
    'chuck', 'chucking',
    'pluck', 'plucky',
    'cluck', 'clucking',
    'truck', 'trucker', 'trucking',
    'shuck', 'shucks',
    'stuck', 'struck',
    'fuel', 'fuels', 'fueled',
    'full', 'fully',
    'fund', 'funds', 'funded', 'funding',
    'fuse', 'fused', 'fusion',
    'fuzz', 'fuzzy',
    // near "fucking" — -ing forms
    'ducking', 'mucking', 'tucking', 'chucking', 'plucking', 'trucking',
    // near "bitch" — 1-sub at first char
    'ditch', 'pitch', 'hitch', 'witch', 'stitch', 'birch',
    'ditches', 'pitcher', 'witches', 'stitches',
    'pitching', 'hitching', 'witching', 'stitching',
    'pitchy', 'itchy',
    // near "crap" — 1-sub consonant swaps
    'crab', 'crabs', 'crabby',
    'trap', 'traps', 'trapped', 'trapping',
    'wrap', 'wraps', 'wrapper', 'wrapping',
    'carp', 'carps',
    'scrap', 'scrappy', 'scrapping',
    'cramp', 'cramps', 'cramped',
    'chap', 'chaps',
    'snappy', 'sloppy', 'choppy',
    // near "piss" — 1-sub neighbours
    'pass', 'passed', 'passing', 'passport',
    'miss', 'missed', 'missing', 'mission',
    'kiss', 'kissed', 'kisser', 'kissing',
    'boss', 'bossy',
    'bass',
    'hiss', 'hissed', 'hissing',
    'fuss', 'fussy',
    // near "whore" — 1-sub/1-insert neighbours
    'where', 'whose', 'whole', 'while',
    'shore', 'shored',
    'snore', 'snoring',
    'swore',
    'chore', 'chores',
    // near "slut" — 1-sub neighbours
    'slot', 'slots', 'slotted',
    'slat', 'slats',
    'shut',
    'salt', 'salted', 'salty',
    'snotty', 'spotty',
    // near "prick" — 1-sub at first char
    'brick', 'bricks',
    'trick', 'tricks', 'tricky', 'trickster',
    'crick',
    // near "wanker" — 1-sub at first char
    'banker', 'banking',
    'hanker', 'hankering',
    'tanker', 'tankers',
    // near "fart" — 1-sub at first char
    'cart', 'carts', 'carting',
    'dart', 'darts',
    'mart',
    'part', 'parts', 'parted', 'parting', 'partner',
    'tart', 'tarts',
    'hart',
    'wart', 'warts',
    // near "turd" — 1-sub neighbours
    'turf', 'turn', 'turned', 'turning',
    'curd', 'curds',
    // near "boob" — 1-sub at last char
    'book', 'booked', 'booking',
    'boom', 'booming',
    'boon',
    'boot', 'boots', 'booting',
    'boor', 'boorish',
    // near "swine" — 1-sub at first char
    'spine', 'spinal',
    'shine', 'shining', 'shiny',
    'twine',
    'whine', 'whining', 'whiny',
    'wine', 'wines',
    'shrine',
    // near "dumb" — 1-sub neighbours
    'dump', 'dumped', 'dumping', 'dumpster',
    'thumb', 'thumbs',
    'drum', 'drummer', 'drumming',
    'numb', 'number',
    'crumb', 'crumbs',
    // near "filth" — 1-sub neighbours
    'fifth', 'faith', 'faithful',
    'filch', 'filched',
    // near "porn" — 1-sub at last char
    'pork', 'porky',
    'pore', 'pored',
    'born', 'corn', 'corner', 'horn', 'hornet',
    'morn', 'torn', 'worn',
    // near "rape" — 1-sub at last char
    'ripe', 'ripen',
    'rage', 'raged', 'raging',
    'rare', 'rarer', 'rarely',
    'race', 'racing', 'racer',
    'rate', 'rated', 'rating',
    'rave', 'raves', 'raving',
    'rapids',
    // near "molest" — 1-sub at first char
    'modest', 'modesty',
    'forest', 'forests',
    'honest', 'honestly',
    // near "pansy" — 1-sub neighbours
    'patsy', 'pansies',
    // near "tramp" — 1-sub at last char
    'trump', 'trumped', 'trumpet',
    'tromp',
    // near "scum" — 1-sub at last char
    'scud', 'scuff', 'scuffed', 'scull',
    // near "smut" — 1-sub neighbours
    'smug', 'snug', 'snub',
    // near "knob" — 1-sub neighbours
    'snob', 'knot', 'knots', 'knotted',
    // near "feck" — 1-sub at first char
    'deck', 'decked',
    'heck',
    'neck', 'necks',
    'peck', 'pecks',
    // near "haji" — distinguish religious pilgrim terms from slur
    'hajj', 'hajji', 'hadj',
    'haiku',
    // near "incel" — 1-sub neighbours
    'uncle', 'uncles',
    'intel',
    // near "toolbag" — ubiquitous UI term (1-sub r↔g, similarity 0.857)
    'toolbar', 'toolbars',
    // benign English words surfaced by scripts/audit-fuzzy-fp.js, each one
    // edit from a dictionary entry (similarity ≥ 0.85)
    'aspirate',     // near "asspirate" — medical/phonetics
    'creatin', 'creatine', // near "cretin" — the supplement
    'pargasite',    // near "parasite" — an amphibole mineral
    'parakite',     // near "parasite" — kiting term
    'belled',       // near "bellend" — fitted with a bell
    'pithead',      // near "pinhead" — top of a mine shaft
    'revoting',     // near "revolting" — to vote again
    'conchie',      // near "coochie" — conscientious objector
    'silkening',    // near "sickening" — making silky
    'inferiors',    // near "inferior" — benign noun plural
    'eradiate',     // near "eradicate" — archaic "to radiate"
    'revulsive',    // near "repulsive" — a counterirritant
    'despicably',   // near "despicable" — benign adverb form
    'degenerated',  // near "degenerate" — "the situation degenerated"
  ];

  const allInnocentWords = [
    ...assWords, ...cockWords, ...cumWords, ...hellWords, ...buttWords,
    ...titWords, ...penWords, ...analWords, ...organWords, ...properNames,
    ...miscWords, ...ukPlaceNames, ...fuzzyCollisions, ...clWords,
    ...numericStrings,
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
