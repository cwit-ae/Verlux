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
