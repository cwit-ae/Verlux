/**
 * Core matching engine — orchestrates tokenization, normalization,
 * transliteration, fuzzy matching, and phrase detection.
 */

import type {
  DictionaryEntry,
  DetectionResult,
  ResolvedConfig,
  Severity,
  PhraseEntry,
} from '../types.js';
import { normalize, normalizeVariants } from './normalizer.js';
import { tokenize, phraseWindows, Token } from './tokenizer.js';
import { bestFuzzyMatch } from './fuzzy.js';
import { transliterate } from './transliterator.js';
import { AhoCorasick } from './aho-corasick.js';

/**
 * Internal safelist — legitimate English words that are close to profanity
 * but should never be flagged. Prevents fuzzy matching false positives.
 */
const SAFE_WORDS = new Set([
  // Close to "vagina"
  'vaginal', 'vaginally',
  // Close to "penis"
  'penile', 'penal', 'penalty', 'peninsula', 'peninsular',
  // Close to "anal"
  'analysis', 'analyst', 'analytical', 'analogue', 'analog', 'analgesic', 'analgesia',
  'canal', 'banal', 'analog', 'national', 'international', 'finale', 'journal',
  // Close to "boner"
  'owner', 'loner', 'donor',
  // Close to "erotic"
  'neurotic', 'patriotic', 'chaotic', 'exotic', 'robotic', 'hypnotic',
  // Close to "horny"
  'thorny', 'corny',
  // Close to "snatch"
  'match', 'batch', 'catch', 'hatch', 'latch', 'patch', 'thatch',
  // Close to "grope"
  'rope', 'europe', 'trope',
  // Close to "spunk"
  'bunk', 'dunk', 'funk', 'junk', 'punk', 'trunk', 'skunk',
  // Close to "hooker"
  'cooker', 'booker', 'looker',
  // Close to "bloody"
  'blood', 'blooding', 'bloodline',
  // Close to "bugger"
  'bigger', 'digger', 'trigger', 'logger',
  // Close to "tosser"
  'closer', 'loser', 'poser',
  // Close to "wang"
  'twang', 'slang', 'gang', 'bang',
  // Close to "poo"
  'pool', 'poor', 'proof', 'poodle',
  // Close to "bum"
  'bump', 'plumber', 'humble', 'bumble', 'album', 'column',
  // Close to "rape"
  'drape', 'grape', 'scrape', 'grapefruit',
  // Close to "cum"
  'cumulative', 'cumulus', 'succumb',
  // Close to "cock"
  'cockatoo', 'cockle', 'cockney', 'cockerel', 'cockpit', 'cocktail', 'peacock',
  // Close to "ass"
  'assassin', 'assault', 'assay', 'assemble', 'assert', 'assess', 'assign', 'assist', 'associate',
  // Close to "hell"
  'hello', 'shell', 'hellenic',
  // Close to "dick"
  'dickens', 'dickenson', 'dickinson',
  // Close to "fagging" (slur) — one-edit collisions at similarity 0.857-0.875
  'flag', 'flags', 'flagged', 'flagging',
  'frag', 'frags', 'fragged', 'fragging',
  // Close to "shagging" — one-edit collisions at similarity 0.857-0.875
  'sagging', 'sagged', 'sag', 'sags', 'saggy',
  'snag', 'snags', 'snagged', 'snagging',
  'slag', 'slags', 'slagged', 'slagging',
  'stag', 'stags', 'stagging',
  'swag', 'swagging',
  // Close to "shit" — "sheet" is everyday English (bedsheet, spreadsheet, etc.)
  'sheet', 'sheets',
  // Close to "shitter/shitting/shitters/shittings" — one-edit collisions at similarity 0.857-0.875
  'sit', 'sits', 'sitter', 'sitters', 'sitting', 'sittings',
  'skit', 'skits', 'skitter', 'skitters',
  'slit', 'slits', 'slitter', 'slitting',
  'spit', 'spits', 'spitter', 'spitters', 'spitting',
  'shifter', 'shifters', 'shifting', 'shiftings', 'shiftiest',
  'shutting', 'shirting', 'shirtings', 'shirtiest',
  // Close to "fisting" — one-edit collisions (all very common English)
  'fasting', 'fishing', 'fitting', 'foisting', 'phishing',
  // Close to "shagger" — one-edit collisions
  'stagger', 'swagger', 'shaggier',
  // Close to "strangle" — "strange" is among the most common English words
  'strange', 'straggle',
  // Close to "cracker" — "cracked" is very common
  'cracked', 'cranker',
  // Close to "bollocks" — "bullocks" is real (castrated bulls)
  'bullocks', 'ballocks',
  // Close to "bondage" — medical term
  'bandage', 'bandages',
  // Close to "bastard" — "bustard" is a bird; "bastardy" is legal term
  'bustard', 'bustards', 'bastardy',
  // Close to "bullshit" — "bullshot" is a cocktail
  'bullshot',
  // Close to "bugger" — "buggier" is adj form of buggy
  'buggier',
  // Close to "behead" — "bedhead" is a hairstyle
  'bedhead',
  // Close to "groomer" — "groomed" is extremely common
  'groomed',
  // Close to "inferior" — "interior" is very common
  'interior', 'interiors',
  // Close to "revolting" — "revolving" is very common
  'revolving',
  // Close to "scammer" — "scammed" is common
  'scammed',
  // Close to "shitload" — "shipload" is a real word
  'shipload',
  // Close to "tribadism" — "tribalism" is very common
  'tribalism',
  // Close to "blumpkin" — "bumpkin" is common
  'bumpkin', 'bumpkins',
  // Close to "tranny" — "tyranny" is very common
  'tyranny',
  // Close to "fagging" — "fogging" is event/industrial term
  'fogging',
  // Close to "frotting" — many common everyday words
  'fretting', 'fritting', 'fronting', 'frosting', 'frothing',
  // Close to "willies" — "wellies" (Wellington boots), "wallies" (British slang for idiots)
  'wellies', 'wallies', 'willie',
  // Close to "savages" — "salvages" is a business term
  'salvages',
  // Close to "jackass" — "jackals" is an animal
  'jackals',
  // Close to "shithole" — "shothole" is a mining/drilling term
  'shothole',
  // Close to "goatfucker" — "goatsucker" is a bird (nightjar)
  'goatsucker',
  // Close to "sickening" — "slickening" is a geological term
  'slickening',
  // Close to "splooge" — "splodge" is British for splotch
  'splodge',
  // Close to "raghead" — "rawhead" is folklore (goblin)
  'rawhead',
  // Close to "fingering" — "fingerling" is a baby fish / small potato
  'fingerling', 'fingerlings',
  // Close to "shitters" — "slitters" is a cutting tool
  'slitters',
  // Close to "cripple" — the verb form "cripples" is common in business/news
  // ("cripples the economy"). Also "crimple" (to crumple), "crippler" (rare).
  'cripples',
  // Close to "shibari" — "shikari" is Indian English for hunter
  'shikari',
  // Close to "tribadism" — "triadism" is a music-theory term
  'triadism',
  // Close to "tit"
  'titanic', 'titan', 'titrate', 'titbit',
  // Close to "damn"
  'damage', 'damp',
  // Close to "kill"
  'skill', 'kiln', 'kilt', 'killjoy', 'skilled',
  // Medical/educational
  'breast', 'breastplate', 'breaststroke', 'breastfeeding',
  'intercourse', 'erection', 'orgasm', 'organism', 'organist',
  'sexual', 'sexuality', 'sexennial', 'sexagenarian',
  'testicle', 'testicular',
  // Close to "murder" (business context)
  'murmur',
  // Close to "moron"
  'mormon',
  // Close to "stab" (business context)
  'stable', 'stability', 'establish', 'established',
  // Close to "fraud" (legitimate business term - keep it detectable)
  // "fraud" IS flagged intentionally — it's relevant in call center abuse
  // Close to "scam"
  'scanner', 'scanning',
  // Close to "scammer" (one-edit collisions at similarity 0.857)
  'spammer', 'spammers', 'spamming',
  'scamper', 'scampered', 'scampering', 'scampers',
  'slammer', 'slammers',
  'stammer', 'stammered', 'stammering', 'stammers',
  // Close to "shitter" (one-edit collisions at similarity 0.857)
  'shatter', 'shattered', 'shattering', 'shatters',
  'shutter', 'shuttered', 'shuttering', 'shutters',
  'shotter',
  // Close to "twink"
  'twinkle', 'twinkled', 'twinkles', 'twinkling',
  // Close to "loser"
  'closer', 'closure',
  // Close to "fool"
  'pool', 'tool', 'cool', 'spool',
  // Close to "creep"
  'creek',
  // Close to "slaughter"
  'laughter',
  // Close to "lynch"
  'lynchburg', 'lynchpin',
  // Close to "fuck" — common 1-edit and l33t-decode collisions
  'duck', 'ducks', 'ducked', 'ducking', 'duckling', 'ducklings',
  'luck', 'lucks', 'lucky', 'luckily', 'luckier', 'luckiest',
  'muck', 'mucks', 'mucky', 'mucked', 'mucking',
  'puck', 'pucks',
  'buck', 'bucks', 'bucked', 'bucking', 'buckle', 'buckles',
  'tuck', 'tucks', 'tucked', 'tucker', 'tucking',
  'yuck', 'yucks', 'yucky',
  'chuck', 'chucks', 'chucked', 'chucking',
  'pluck', 'plucks', 'plucked', 'plucky', 'plucking',
  'cluck', 'clucks', 'clucked', 'clucking',
  'truck', 'trucks', 'trucked', 'trucker', 'trucking',
  'shuck', 'shucks', 'shucked', 'shucking',
  'stuck', 'struck',
  'fuel', 'fuels', 'fueled', 'fueling', 'fueller',
  'full', 'fully', 'fullness',
  'fund', 'funds', 'funded', 'funder', 'funding',
  'fuse', 'fuses', 'fused', 'fusing', 'fusion',
  'fuzz', 'fuzzy', 'fuzzier',
  // Close to "fucking" — 1-sub at first char, very common -ing words
  'ducking', 'mucking', 'tucking', 'bucking', 'lucking',
  'chucking', 'plucking', 'clucking', 'trucking', 'shucking',
  // Close to "bitch" — 1-sub at first char, common everyday words
  'ditch', 'ditches', 'ditched', 'ditching',
  'pitch', 'pitches', 'pitched', 'pitcher', 'pitchers', 'pitching',
  'hitch', 'hitches', 'hitched', 'hitching', 'hitchhike',
  'witch', 'witches', 'witchy', 'witching', 'witchcraft',
  'stitch', 'stitches', 'stitched', 'stitching',
  'birch', 'birches',
  'fitch',
  // Close to "bitching"/"bitchy" — -ing/-y forms
  'pitchy', 'witchy', 'itchy',
  // Close to "crap" — common 1-edit consonant swaps
  'crab', 'crabs', 'crabby', 'crabbier',
  'trap', 'traps', 'trapped', 'trapper', 'trapping',
  'wrap', 'wraps', 'wrapped', 'wrapper', 'wrapping',
  'carp', 'carps', 'carping',
  'scrap', 'scraps', 'scrapped', 'scrappy', 'scrapping',
  'cramp', 'cramps', 'cramped', 'cramping',
  'chap', 'chaps', 'chapped',
  'clap', 'claps', 'clapped', 'clapping', 'clapper',
  // Close to "crappy" — common -y adjectives
  'snappy', 'sloppy', 'choppy',
  // Close to "piss" — 1-sub neighbours; "pissed/pisser" -> passed/kisser etc.
  'pass', 'passes', 'passed', 'passer', 'passing', 'passport',
  'miss', 'misses', 'missed', 'missing', 'mission',
  'kiss', 'kisses', 'kissed', 'kisser', 'kissing',
  'boss', 'bosses', 'bossed', 'bossing', 'bossy',
  'bass', 'basses',
  'hiss', 'hisses', 'hissed', 'hissing',
  'fuss', 'fussed', 'fussing', 'fussy',
  // Close to "whore" — 1-sub/1-insert neighbours
  'where', 'whose', 'whole', 'while',
  'shore', 'shores', 'shored',
  'snore', 'snores', 'snored', 'snoring',
  'swore',
  'chore', 'chores',
  // ("whored" intentionally NOT safelisted — it is the verb form of "whore")
  // Close to "slut" — 1-sub neighbours; "slot/shut/salt"
  'slot', 'slots', 'slotted', 'slotting',
  'slat', 'slats', 'slatted',
  'shut', 'shuts', 'shutting',
  'salt', 'salts', 'salted', 'salting', 'salty',
  // Close to "slutty" — 1-sub at pos 1
  'snotty', 'spotty', 'slatty',
  // Close to "prick" — 1-sub at first char
  'brick', 'bricks', 'bricked', 'bricking',
  'trick', 'tricks', 'tricked', 'tricky', 'trickster',
  'crick', 'cricks',
  // Close to "wanker" — 1-sub at first char (banker/hanker/tanker)
  'banker', 'bankers', 'banking', 'banked',
  'hanker', 'hankered', 'hankering',
  'tanker', 'tankers',
  'yanker',
  // Close to "fart" — 1-sub at first char (cart/dart/mart/part/tart)
  'cart', 'carts', 'carted', 'carting', 'carter',
  'dart', 'darts', 'darted', 'darting',
  'mart', 'marts',
  'part', 'parts', 'parted', 'parting', 'partly', 'partner',
  'tart', 'tarts', 'tartly',
  'hart', 'harts',
  'wart', 'warts', 'warty',
  // Close to "turd" — 1-sub at last char or first char
  'turf', 'turfs', 'turfy',
  'turn', 'turns', 'turned', 'turning', 'turner',
  'curd', 'curds',
  // Close to "boob" — 1-sub at last char (book/boom/boon/boot)
  'book', 'books', 'booked', 'booking',
  'boom', 'booms', 'boomed', 'booming',
  'boon', 'boons',
  'boot', 'boots', 'booted', 'booting',
  'boor', 'boors', 'boorish',
  // Close to "swine" — 1-sub at first char (spine/shine/twine/whine)
  'spine', 'spines', 'spinal',
  'shine', 'shines', 'shined', 'shining', 'shiny',
  'twine', 'twines', 'twined', 'twining',
  'whine', 'whines', 'whined', 'whining', 'whiny',
  'wine', 'wines',
  'shrine', 'shrines',
  // Close to "dumb" — 1-sub at last char or 1-sub at first
  'dump', 'dumps', 'dumped', 'dumping', 'dumpster',
  'thumb', 'thumbs', 'thumbed',
  'drum', 'drums', 'drummed', 'drumming', 'drummer',
  'numb', 'numbed', 'numbing', 'number',
  'crumb', 'crumbs', 'crumbly',
  // Close to "filth" — 1-sub neighbours (fifth/faith/filch)
  'fifth', 'fifths',
  'faith', 'faiths', 'faithful',
  'filch', 'filched', 'filching',
  // Close to "maggot" — "magnet" is 1-sub g→n? actually 2 edits; safelist anyway
  'magnet', 'magnets', 'magnetic',
  // Close to "vermin" — "vermil" rare; "termini" 2 edits; safelist plurals only
  // (skip — no safe near-neighbours common enough to safelist)
  // Close to "pansy" — "pansies" only; "patsy" is 1-sub n→t
  'patsy', 'patsies', 'pansies',
  // Close to "tramp" — "trump/tramps/tromp" — keep "trump" safelisted (proper noun usage)
  'trump', 'trumps', 'trumped', 'trumping', 'trumpet',
  'tromp', 'tromped',
  // Close to "scum" — "scud/scud-" weather term; "scuff/scull"
  'scud', 'scuds',
  'scuff', 'scuffs', 'scuffed', 'scuffing',
  'scull', 'sculls', 'sculling',
  // Close to "moron" — "matron" 2 edits; "mormon" already; add "macron/marlon"
  'macron', 'macrons',
  // Close to "loser" / "fool" — already covered
  // Close to "creep" — "creel" rare; "crepe" 1-sub p→p... already covered with creek
  'crepe', 'crepes',
  // Close to "smut" — "snug/snub/smug"
  'smug', 'smugly', 'smugness',
  'snug', 'snugly', 'snugger',
  'snub', 'snubs', 'snubbed',
  // Close to "knob" — "snob/knot/know/knew"
  'snob', 'snobs', 'snobby',
  'knot', 'knots', 'knotted', 'knotting',
  // Close to "feck" — "fec" not English; "deck/heck/neck/peck"
  'deck', 'decks', 'decked', 'decking',
  'heck',
  'neck', 'necks', 'necked', 'necking',
  'peck', 'pecks', 'pecked', 'pecking',
  // Close to "puto" (Spanish) — handled in Spanish section; English "puto" rare
  // Close to "cuck" — "cock" already in dict; "buck/duck/luck/muck/puck/tuck" already above
  // Close to "porn" — "pork/porn/pore/born/corn/horn/morn/torn/worn"
  'pork', 'porks', 'porky',
  'pore', 'pores', 'pored', 'poring',
  'born',
  'corn', 'corns', 'corny', 'corner',
  'horn', 'horns', 'horned', 'hornet',
  'morn', 'morns',
  'torn',
  'worn',
  // Close to "rape" — already covered with drape/grape/scrape; add "ripe/rope/rare/race/rage/rate"
  'ripe', 'riper', 'ripest', 'ripen',
  'rage', 'raged', 'rages', 'raging',
  'rare', 'rarer', 'rarely',
  'race', 'races', 'raced', 'racing', 'racer',
  'rate', 'rates', 'rated', 'rating',
  'rave', 'raves', 'raved', 'raving',
  // Close to "rapist" — common: "racist" (different slur, IS flagged elsewhere), "rapids", "tapist"
  'rapids',
  // Close to "molest" — "modest/modesty/forest/locust/honest"
  'modest', 'modestly', 'modesty',
  'forest', 'forests', 'forester',
  'honest', 'honestly', 'honesty',
  // Close to "stab" — already covered with stable/stability/establish; add "stag" (already), "scab"
  'scab', 'scabs', 'scabbed',
  // Close to "kill" — already covered
  // Close to "haji" — "hajj" pilgrimage IS a religious term, leave; add "haiku/hadji-allowed-religious"
  'hajj', 'hajji', 'hadj',  // pilgrim terms — religious, distinct from slur "haji"
  'haiku', 'haikus',
  // Close to "incel" — "uncle/intel/install"
  'uncle', 'uncles',
  'intel',
  // ── Spanish collisions (accent-stripped forms that collide with dictionary) ──
  // "coño" normalizes to "cono" which is also Spanish for "cone"
  'cono', 'conos',
  // "pija" (dick, AR) collides with "pija" meaning posh in some regions; keep flagged (no safe form)
  // "polla" (dick, ES) collides with "pollo" (chicken) — fuzzy threshold already filters this
  'pollo', 'pollos', 'pollito', 'pollita', 'pollera',
  // "culo" (ass) substring of many words — partial match is disabled, these are for fuzzy/raw safety
  'culto', 'oculto', 'circulo', 'círculo', 'ridículo', 'ridiculo', 'vínculo', 'vinculo',
  // "caca" vs "cacao"
  'cacao', 'cacahuete', 'cacatua', 'cacatúa',
  // "pito" (dick, mild) vs "pitón" (python), "pito" is also "whistle"; leave "pito" flagged
  'pitón', 'piton',
  // "tonto" in dict already as low-sev; no collisions worth safelisting
  // "pico" (beak) fuzzy-close to "pito"
  'pico', 'picos',
  // "ano" / "año" — not in dict, no action

  // ── French collisions ──
  // `con` is a common French root; `allowPartialMatch: false` handles exact
  // lookup, but fuzzy matching can still trip on one-edit neighbours. These
  // are the highest-frequency collisions.
  'concert', 'condition', 'conte', 'conté', 'compte', 'conclu', 'conclusion',
  'conjoint', 'connect', 'connaitre', 'connaître', 'conscient', 'conseil',
  'considere', 'considéré', 'consiste', 'constat', 'construit', 'consulter',
  'contact', 'contenu', 'content', 'continent', 'contre', 'contrôle', 'controle',
  'convaincre', 'convenu', 'conversion', 'convoi', 'coton',
  'bacon', 'balcon', 'flacon', 'garçon', 'garcon', 'melon', 'rançon', 'rancon',
  // `pute` collides with `député`, `réputé`, `amputer`, `dispute`, `computer`
  'depute', 'député', 'deputee', 'députée', 'deputes', 'députés',
  'repute', 'réputé', 'reputation', 'réputation',
  'dispute', 'disputee', 'disputée', 'disputer',
  'compute', 'computer',  // English loanword, common in French tech text
  'ampute', 'amputé', 'amputer', 'amputation',
  // `bite` collides with `habite`, `orbite`, `cohabite`, `exhibé`
  'habite', 'habiter', 'habitent', 'habitat', 'habitation',
  'orbite', 'orbital', 'orbiter',
  'cohabite', 'cohabiter', 'cohabitation',
  'exhibe', 'exhibé', 'exhiber', 'exhibition',
  // `cul` is partial-off so no substring issue, but fuzzy near-miss collisions:
  'culte', 'culto', 'culture', 'cultiver', 'cultivé', 'culturel',
  'calcul', 'calculer', 'circuler', 'circulation',
  // `salope` contains `escalope` (veal cutlet)
  'escalope', 'escalopes',
  // `merde` fuzzy-close to `mercredi`, `merci` — safelist those
  'mercredi', 'merci', 'merlé',
  // `pute` fuzzy-close to `pâte` / `pute` / `peut`
  'peut', 'pâte', 'pate',
  // `bite` fuzzy-close to `boite`, `bète`, `bêtise`
  'boite', 'boîte', 'bête', 'bete', 'bêtise', 'betise',
  // `folle` is intentionally NOT in the dict as a word; "grande folle" is a phrase
  'folle', 'folles',  // extra safety against fuzzy collisions with other entries

  // ── German collisions ──
  // `arsch` has no major benign compounds; safelist the fuzzy near-misses
  'marsch', 'marschieren', 'forscher', 'forschung',
  // `hure` fuzzy-close to `uhr`, `fuehr`, `gebuehr`
  'uhr', 'uhren', 'gebühr', 'gebuehr', 'gebühren',
  // `fick` fuzzy-close to `dick` (German: "thick/fat", benign), `pick`, `flick`
  'dick',  // German: "thick/fat" — note English `dick` IS flagged via en.ts
  'flick', 'flicken',  // German: "to patch/mend"
  // `nutte` fuzzy-close to `mutter`, `butter`, `futter`, `stutte`
  'mutter', 'butter', 'futter', 'stute',
  // `möse` fuzzy-close to `möge`, `böse`, `rose`, `dose`
  'möge', 'moege', 'böse', 'boese', 'rose', 'dose',
  // `fotze` fuzzy-close to `trotze`, `glotze`
  'trotz', 'glotze',
  // `vögeln` fuzzy-close to `vogel` (bird, singular) — distinct from `vögeln`
  'vogel', 'voegel', 'vögel', 'vogels',
  // `titten` fuzzy-close to `bitten`, `sitten`, `mitten`
  'bitten', 'sitten', 'mitten',
  // `bumsen` fuzzy-close to `pumpen`, `summen`
  'pumpen', 'summen',
  // `poppen` fuzzy-close to `stoppen`, `hoppen`, `koppen`
  'stoppen', 'stoppt',
  // `wichse` close to `mixe`, `fixe`
  'mixe', 'mixen', 'fixe', 'fixen',
  // `nackt` is NOT in the dict (excluded for FP reasons), but include for safety
  'nackt', 'nackte', 'nackten',
]);

const SEVERITY_ORDER: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

interface DictionaryIndex {
  /** word/normalized/alias → entry (fast O(1) lookup) */
  wordMap: Map<string, DictionaryEntry>;
  /** All dictionary words grouped by first char + length for fuzzy pre-filter */
  fuzzyIndex: Map<string, string[]>;
  /** Phrase entries for multi-word detection */
  phrases: PhraseEntry[];
  /** All canonical words (for fuzzy matching) */
  allWords: string[];
  /** Aho-Corasick automaton over allowPartialMatch words (all languages) —
   *  O(n + z) multi-pattern scan regardless of dictionary size. */
  partialAutomaton: AhoCorasick<DictionaryEntry>;
  /** Whether any partial-match patterns exist (skip scan if empty). */
  hasPartialPatterns: boolean;
}

/**
 * Build an optimized index from dictionary entries for fast lookup.
 */
export function buildIndex(entries: DictionaryEntry[], phrases: PhraseEntry[] = []): DictionaryIndex {
  const wordMap = new Map<string, DictionaryEntry>();
  const fuzzyIndex = new Map<string, string[]>();
  const allWords: string[] = [];
  const partialAutomaton = new AhoCorasick<DictionaryEntry>();
  const seenPartialKeys = new Set<string>();

  for (const entry of entries) {
    const canonical = entry.word.toLowerCase();
    wordMap.set(canonical, entry);
    allWords.push(canonical);

    // Index normalized forms
    for (const norm of entry.normalized) {
      const n = norm.toLowerCase();
      if (!wordMap.has(n)) {
        wordMap.set(n, entry);
      }
    }

    // Index aliases
    for (const alias of entry.aliases) {
      const a = alias.toLowerCase();
      if (!wordMap.has(a)) {
        wordMap.set(a, entry);
      }
    }

    // Build fuzzy pre-filter index: group by first char
    const key = canonical[0] ?? '';
    let bucket = fuzzyIndex.get(key);
    if (!bucket) {
      bucket = [];
      fuzzyIndex.set(key, bucket);
    }
    bucket.push(canonical);

    // Build Aho-Corasick index for partial-match words. We index the
    // NORMALIZED form (accents stripped, l33t decoded) because input is
    // always normalized before scanning — this keeps the alphabet consistent
    // and avoids double-matching accented vs. plain spellings.
    if (entry.allowPartialMatch) {
      const normCanonical = normalize(canonical);
      if (normCanonical.length >= 3 && !seenPartialKeys.has(normCanonical)) {
        seenPartialKeys.add(normCanonical);
        partialAutomaton.add(normCanonical, entry);
      }
    }
  }

  partialAutomaton.build();

  return {
    wordMap,
    fuzzyIndex,
    phrases,
    allWords,
    partialAutomaton,
    hasPartialPatterns: seenPartialKeys.size > 0,
  };
}

/**
 * Main detection function. Takes text and returns all detected profanity.
 */
export function detect(
  input: string,
  index: DictionaryIndex,
  config: ResolvedConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  const tokens = tokenize(input);

  // Phase 1: Single-word detection (clean tokens)
  for (const token of tokens) {
    // Skip tokens embedded in snake_case identifiers (e.g. `fk` inside
    // `fk_company_modules`). An adjacent underscore in the raw input signals
    // that this "word" is an identifier part, not natural language.
    if (isInsideSnakeCase(token, input)) continue;
    const result = matchToken(token, index, config);
    if (result) {
      results.push(result);
    }
  }

  // Phase 1.5: Raw segment detection (handles obfuscated words like @$$hole, f.u.c.k)
  // Split by whitespace only, normalize each segment, and check
  const rawSegments = getRawSegments(input);
  for (const segment of rawSegments) {
    // Skip if already matched by a token in this position range
    if (results.some(r => r.position[0] <= segment.start && r.position[1] >= segment.end)) {
      continue;
    }
    // Skip snake_case identifiers — the strip-non-alphanumeric variant would
    // otherwise collapse `fk_company_modules` to `fkcompanymodules`. We keep
    // single-letter obfuscation (`f_u_c_k`) detectable by only skipping when
    // at least one `_`-separated piece is multi-char.
    if (isSnakeCaseIdentifier(segment.value)) continue;
    const result = matchRawSegment(segment, index, config);
    if (result) {
      results.push(result);
    }
  }

  // Phase 2: Phrase detection
  if (config.phraseDetection && index.phrases.length > 0) {
    const phraseResults = matchPhrases(tokens, index, config);
    results.push(...phraseResults);
  }

  // Deduplicate overlapping results (keep highest confidence)
  return deduplicateResults(results);
}

interface RawSegment {
  value: string;
  start: number;
  end: number;
}

function isInsideSnakeCase(token: Token, input: string): boolean {
  return input[token.start - 1] === '_' || input[token.end] === '_';
}

function isSnakeCaseIdentifier(segment: string): boolean {
  if (!segment.includes('_')) return false;
  const parts = segment.split('_').filter(Boolean);
  return parts.length > 1 && parts.some(p => p.length >= 2);
}

/**
 * Split input by whitespace into raw segments (preserving all chars including symbols).
 */
function getRawSegments(input: string): RawSegment[] {
  const segments: RawSegment[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    segments.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return segments;
}

/**
 * Try to match a raw segment (may contain l33t chars, separators, etc.)
 * by normalizing it first and then checking the dictionary.
 */
function matchRawSegment(
  segment: RawSegment,
  index: DictionaryIndex,
  config: ResolvedConfig
): DetectionResult | null {
  const raw = segment.value;

  // Check internal safelist
  if (SAFE_WORDS.has(raw.toLowerCase())) return null;

  // Check raw text directly (catches aliases like 's**t', 'f**k' before normalization strips them)
  const rawLower = raw.toLowerCase();
  if (!config.whitelist.has(rawLower)) {
    const rawEntry = index.wordMap.get(rawLower);
    if (rawEntry && passesFilters(rawEntry, config)) {
      return {
        original: raw,
        matched: rawEntry.word,
        language: rawEntry.language,
        severity: rawEntry.severity,
        category: rawEntry.category,
        position: [segment.start, segment.end],
        matchType: 'exact',
        confidence: 1.0,
      };
    }
  }

  // Normalize the full raw segment (this handles @$$hole → asshole, f.u.c.k → fuck)
  const variants = normalizeVariants(raw);

  for (const variant of variants) {
    if (config.whitelist.has(variant)) return null;

    const entry = index.wordMap.get(variant);
    if (entry && passesFilters(entry, config)) {
      return {
        original: raw,
        matched: entry.word,
        language: entry.language,
        severity: entry.severity,
        category: entry.category,
        position: [segment.start, segment.end],
        matchType: 'normalized',
        confidence: 0.9,
      };
    }

    // Also try partial matching via Aho-Corasick: single linear scan finds
    // any allowPartialMatch word embedded in the variant, regardless of
    // dictionary size. O(variant.length + matches).
    if (variant.length >= 4 && index.hasPartialPatterns) {
      const acHits = index.partialAutomaton.search(variant);
      for (const hit of acHits) {
        const wordEntry = hit.value;
        if (!passesFilters(wordEntry, config)) continue;
        if (hit.pattern === variant) continue; // exact match — already handled above
        return {
          original: raw,
          matched: wordEntry.word,
          language: wordEntry.language,
          severity: wordEntry.severity,
          category: wordEntry.category,
          position: [segment.start, segment.end],
          matchType: 'normalized',
          confidence: 0.8,
        };
      }
    }
  }

  // Try fuzzy on normalized form
  if (config.fuzzyMatch) {
    const normalized = normalize(raw);
    if (normalized.length >= 3) {
      const firstChar = normalized[0] ?? '';
      const candidates = getFuzzyCandidates(firstChar, normalized.length, index);
      const fuzzyResult = bestFuzzyMatch(normalized, candidates, config.fuzzyThreshold);
      if (fuzzyResult) {
        const entry = index.wordMap.get(fuzzyResult.match);
        if (entry && passesFilters(entry, config)) {
          return {
            original: raw,
            matched: entry.word,
            language: entry.language,
            severity: entry.severity,
            category: entry.category,
            position: [segment.start, segment.end],
            matchType: 'fuzzy',
            confidence: fuzzyResult.confidence,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Try to match a single token against the dictionary.
 * Goes through the tiered lookup: exact → normalized → alias → fuzzy.
 */
function matchToken(
  token: Token,
  index: DictionaryIndex,
  config: ResolvedConfig
): DetectionResult | null {
  const raw = token.value.toLowerCase();

  // Check whitelist and internal safelist
  if (config.whitelist.has(raw)) return null;
  if (SAFE_WORDS.has(raw)) return null;

  // Tier 1: Exact match
  const exactEntry = index.wordMap.get(raw);
  if (exactEntry && passesFilters(exactEntry, config)) {
    return buildResult(token, exactEntry, 'exact', 1.0);
  }

  // Tier 2: Normalized match
  const variants = normalizeVariants(token.value);
  for (const variant of variants) {
    if (config.whitelist.has(variant)) return null;
    const normEntry = index.wordMap.get(variant);
    if (normEntry && passesFilters(normEntry, config)) {
      return buildResult(token, normEntry, 'normalized', 0.95);
    }
  }

  // Tier 2.5: Transliteration match
  if (config.transliteration) {
    const translit = transliterate(token.value);
    for (const t of translit) {
      const tNorm = normalize(t);
      const tEntry = index.wordMap.get(tNorm);
      if (tEntry && passesFilters(tEntry, config)) {
        return buildResult(token, tEntry, 'normalized', 0.9);
      }
    }
  }

  // Tier 2.75: Partial/substring match via Aho-Corasick. One linear scan
  // finds any allowPartialMatch word that occurs inside the variant.
  // Catches "fuuuucking" → variant "fucking" contains "fuck".
  if (index.hasPartialPatterns) {
    const allVariants = normalizeVariants(token.value);
    for (const variant of allVariants) {
      if (variant.length < 4) continue;
      const acHits = index.partialAutomaton.search(variant);
      for (const hit of acHits) {
        const wordEntry = hit.value;
        if (!passesFilters(wordEntry, config)) continue;
        if (hit.pattern === variant) continue; // exact case already covered
        return buildResult(token, wordEntry, 'normalized', 0.85);
      }
    }
  }
  const normalizedRaw = normalize(raw);

  // Tier 3: Fuzzy match
  if (config.fuzzyMatch && raw.length >= 3) {
    // Pre-filter: only check words starting with the same letter or within edit distance
    const firstChar = normalizedRaw[0] ?? '';
    const candidates = getFuzzyCandidates(firstChar, raw.length, index);

    const fuzzyResult = bestFuzzyMatch(normalizedRaw, candidates, config.fuzzyThreshold);
    if (fuzzyResult) {
      const entry = index.wordMap.get(fuzzyResult.match);
      if (entry && passesFilters(entry, config)) {
        // Partial-match guard would go here, but the tokenizer already splits on
        // word boundaries — a token is never a substring of a larger word.
        return buildResult(token, entry, 'fuzzy', fuzzyResult.confidence);
      }
    }
  }

  return null;
}

/**
 * Match multi-word phrases against the phrase dictionary.
 */
function matchPhrases(
  tokens: Token[],
  index: DictionaryIndex,
  config: ResolvedConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  const windows = phraseWindows(tokens, 5);

  for (const window of windows) {
    const normalizedPhrase = normalize(window.phrase);

    for (const phraseEntry of index.phrases) {
      // Language filter
      if (config.languages && !config.languages.includes(phraseEntry.language)) continue;

      // Severity filter
      if (SEVERITY_ORDER[phraseEntry.severity] < SEVERITY_ORDER[config.minSeverity]) continue;

      const normalizedTarget = normalize(phraseEntry.phrase);
      if (normalizedPhrase === normalizedTarget) {
        results.push({
          original: window.phrase,
          matched: phraseEntry.phrase,
          language: phraseEntry.language,
          severity: phraseEntry.severity,
          category: phraseEntry.category,
          position: [window.start, window.end],
          matchType: 'phrase',
          confidence: 1.0,
        });
      }
    }
  }

  return results;
}

/**
 * Get fuzzy matching candidates, pre-filtered by first character and length.
 */
function getFuzzyCandidates(
  firstChar: string,
  wordLength: number,
  index: DictionaryIndex
): string[] {
  const candidates: string[] = [];

  // Get words starting with the same letter
  const sameStart = index.fuzzyIndex.get(firstChar) ?? [];
  for (const word of sameStart) {
    // Only consider words within reasonable length range
    if (Math.abs(word.length - wordLength) <= 2) {
      candidates.push(word);
    }
  }

  // Also check adjacent letters (for first-char typos), but be more strict on length
  const charCode = firstChar.charCodeAt(0);
  for (const offset of [-1, 1]) {
    const adjacentChar = String.fromCharCode(charCode + offset);
    const adjacent = index.fuzzyIndex.get(adjacentChar) ?? [];
    for (const word of adjacent) {
      if (Math.abs(word.length - wordLength) <= 1) {
        candidates.push(word);
      }
    }
  }

  return candidates;
}

function passesFilters(entry: DictionaryEntry, config: ResolvedConfig): boolean {
  // Language filter
  if (config.languages && !config.languages.includes(entry.language)) return false;
  // Severity filter
  if (SEVERITY_ORDER[entry.severity] < SEVERITY_ORDER[config.minSeverity]) return false;
  return true;
}

function buildResult(
  token: Token,
  entry: DictionaryEntry,
  matchType: DetectionResult['matchType'],
  confidence: number
): DetectionResult {
  return {
    original: token.value,
    matched: entry.word,
    language: entry.language,
    severity: entry.severity,
    category: entry.category,
    position: [token.start, token.end],
    matchType,
    confidence,
  };
}

/**
 * Remove overlapping detections, keeping the one with highest confidence.
 */
function deduplicateResults(results: DetectionResult[]): DetectionResult[] {
  if (results.length <= 1) return results;

  // Sort by start position asc, then by confidence desc, then by match length desc.
  // The length tiebreaker ensures a phrase like "chinga tu madre" beats the
  // embedded word "chinga" when both report confidence 1.0.
  results.sort((a, b) => {
    if (a.position[0] !== b.position[0]) return a.position[0] - b.position[0];
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (b.position[1] - b.position[0]) - (a.position[1] - a.position[0]);
  });

  const deduped: DetectionResult[] = [];
  let lastEnd = -1;

  for (const result of results) {
    // If this result overlaps with the previous one, skip it (we keep the first = highest confidence)
    if (result.position[0] < lastEnd) continue;
    deduped.push(result);
    lastEnd = result.position[1];
  }

  return deduped;
}
