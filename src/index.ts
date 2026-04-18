/**
 * Verlux — Intelligent multilingual profanity detection.
 *
 * @example
 * ```ts
 * import { verlux } from 'verlux';
 *
 * const results = verlux.detect('some text here');
 * console.log(results);
 *
 * const isClean = verlux.isClean('hello world');
 * console.log(isClean); // true
 *
 * const censored = verlux.censor('what the fuck');
 * console.log(censored); // "what the ****"
 * ```
 */

import type {
  VerluxConfig,
  ResolvedConfig,
  DetectionResult,
  Severity,
  DictionaryEntry,
  PhraseEntry,
  ToxicityScore,
} from './types.js';
import { buildIndex, detect } from './engine/matcher.js';
import { getWords, getPhrases, availableLanguages } from './dictionaries/index.js';
import { tokenize } from './engine/tokenizer.js';

// Re-export types for consumers
export type {
  VerluxConfig,
  DetectionResult,
  DictionaryEntry,
  PhraseEntry,
  Severity,
  ToxicityScore,
};
export type { Category } from './types.js';

/** Default configuration */
const DEFAULTS: ResolvedConfig = {
  languages: null,
  fuzzyMatch: true,
  fuzzyThreshold: 0.85,
  phraseDetection: true,
  transliteration: true,
  minSeverity: 'low',
  whitelist: new Set(),
};

const VALID_SEVERITIES: readonly Severity[] = ['low', 'medium', 'high'];
const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'slur', 'sexual', 'insult', 'hate', 'threat', 'drug', 'other',
]);

function validateConfig(config: VerluxConfig): void {
  if (config.fuzzyThreshold !== undefined) {
    const t = config.fuzzyThreshold;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 1) {
      throw new TypeError(
        `verlux: fuzzyThreshold must be a finite number between 0 and 1 (got ${String(t)})`
      );
    }
  }
  if (config.minSeverity !== undefined && !VALID_SEVERITIES.includes(config.minSeverity)) {
    throw new TypeError(
      `verlux: minSeverity must be one of ${VALID_SEVERITIES.join(', ')} (got ${String(config.minSeverity)})`
    );
  }
  if (config.languages !== undefined && config.languages !== null) {
    if (!Array.isArray(config.languages)) {
      throw new TypeError('verlux: languages must be an array of strings or null');
    }
  }
  if (config.whitelist !== undefined && !Array.isArray(config.whitelist)) {
    throw new TypeError('verlux: whitelist must be an array of strings');
  }
}

function resolveConfig(config?: VerluxConfig): ResolvedConfig {
  if (!config) return { ...DEFAULTS, whitelist: new Set() };
  validateConfig(config);
  return {
    languages: config.languages ?? null,
    fuzzyMatch: config.fuzzyMatch ?? DEFAULTS.fuzzyMatch,
    fuzzyThreshold: config.fuzzyThreshold ?? DEFAULTS.fuzzyThreshold,
    phraseDetection: config.phraseDetection ?? DEFAULTS.phraseDetection,
    transliteration: config.transliteration ?? DEFAULTS.transliteration,
    minSeverity: config.minSeverity ?? DEFAULTS.minSeverity,
    // Whitelist is always lowercased — matching is case-insensitive.
    whitelist: new Set((config.whitelist ?? []).map(w => String(w).toLowerCase())),
  };
}

function validateDictionaryEntry(entry: DictionaryEntry, i: number): void {
  if (!entry || typeof entry !== 'object') {
    throw new TypeError(`verlux: dictionary entry at index ${i} is not an object`);
  }
  if (typeof entry.word !== 'string' || entry.word.length === 0) {
    throw new TypeError(`verlux: dictionary entry at index ${i} has invalid "word"`);
  }
  if (typeof entry.language !== 'string' || entry.language.length === 0) {
    throw new TypeError(`verlux: dictionary entry "${entry.word}" has invalid "language"`);
  }
  if (!VALID_SEVERITIES.includes(entry.severity)) {
    throw new TypeError(
      `verlux: dictionary entry "${entry.word}" has invalid severity "${String(entry.severity)}"`
    );
  }
  if (!VALID_CATEGORIES.has(entry.category)) {
    throw new TypeError(
      `verlux: dictionary entry "${entry.word}" has invalid category "${String(entry.category)}"`
    );
  }
  if (!Array.isArray(entry.normalized)) {
    throw new TypeError(`verlux: dictionary entry "${entry.word}" has invalid "normalized"`);
  }
  if (!Array.isArray(entry.aliases)) {
    throw new TypeError(`verlux: dictionary entry "${entry.word}" has invalid "aliases"`);
  }
  if (typeof entry.allowPartialMatch !== 'boolean') {
    throw new TypeError(`verlux: dictionary entry "${entry.word}" has invalid "allowPartialMatch"`);
  }
}

function validatePhraseEntry(entry: PhraseEntry, i: number): void {
  if (!entry || typeof entry !== 'object') {
    throw new TypeError(`verlux: phrase entry at index ${i} is not an object`);
  }
  if (typeof entry.phrase !== 'string' || entry.phrase.length === 0) {
    throw new TypeError(`verlux: phrase entry at index ${i} has invalid "phrase"`);
  }
  if (!Array.isArray(entry.words) || entry.words.length === 0) {
    throw new TypeError(`verlux: phrase entry "${entry.phrase}" has invalid "words"`);
  }
  if (typeof entry.language !== 'string' || entry.language.length === 0) {
    throw new TypeError(`verlux: phrase entry "${entry.phrase}" has invalid "language"`);
  }
  if (!VALID_SEVERITIES.includes(entry.severity)) {
    throw new TypeError(
      `verlux: phrase entry "${entry.phrase}" has invalid severity "${String(entry.severity)}"`
    );
  }
  if (!VALID_CATEGORIES.has(entry.category)) {
    throw new TypeError(
      `verlux: phrase entry "${entry.phrase}" has invalid category "${String(entry.category)}"`
    );
  }
}

/**
 * Create a Verlux instance. Can be used with default or custom config.
 */
function createInstance(defaultConfig?: VerluxConfig) {
  const baseConfig = resolveConfig(defaultConfig);

  // Pre-build index for the configured languages
  const words = getWords(baseConfig.languages);
  const phrases = getPhrases(baseConfig.languages);
  let index = buildIndex(words, phrases);

  return {
    /**
     * Detect all profane words/phrases in the input text.
     * Returns an array of detection results with position, severity, category, etc.
     */
    detect(text: string, config?: VerluxConfig): DetectionResult[] {
      if (!text || text.trim().length === 0) return [];

      const resolved = config ? resolveConfig(config) : baseConfig;

      // If per-call config specifies different languages, rebuild index
      if (config?.languages) {
        const callWords = getWords(resolved.languages);
        const callPhrases = getPhrases(resolved.languages);
        const callIndex = buildIndex(callWords, callPhrases);
        return detect(text, callIndex, resolved);
      }

      return detect(text, index, resolved);
    },

    /**
     * Check if text contains any profanity.
     * Returns true if the text is clean (no profanity detected).
     */
    isClean(text: string, config?: VerluxConfig): boolean {
      return this.detect(text, config).length === 0;
    },

    /**
     * Censor profane words in the text, replacing them with a mask character.
     */
    censor(text: string, config?: VerluxConfig & { mask?: string }): string {
      const mask = config?.mask ?? '*';
      const results = this.detect(text, config);

      if (results.length === 0) return text;

      // Sort by position descending so we can replace from end to start
      // without messing up indices
      const sorted = [...results].sort((a, b) => b.position[0] - a.position[0]);

      let censored = text;
      for (const result of sorted) {
        const [start, end] = result.position;
        const replacement = mask.repeat(end - start);
        censored = censored.slice(0, start) + replacement + censored.slice(end);
      }

      return censored;
    },

    /**
     * Get list of available language codes.
     */
    languages(): string[] {
      return availableLanguages();
    },

    /**
     * Create a new instance with a different default configuration.
     */
    configure(config: VerluxConfig) {
      return createInstance(config);
    },

    /**
     * Add custom words to the dictionary at runtime.
     * Throws TypeError if any entry is malformed.
     */
    addWords(entries: DictionaryEntry[]): void {
      if (!Array.isArray(entries)) {
        throw new TypeError('verlux: addWords expects an array of DictionaryEntry');
      }
      entries.forEach(validateDictionaryEntry);
      const allWords = [...words, ...entries];
      index = buildIndex(allWords, phrases);
    },

    /**
     * Add custom phrases to the dictionary at runtime.
     * Throws TypeError if any entry is malformed.
     */
    addPhrases(entries: PhraseEntry[]): void {
      if (!Array.isArray(entries)) {
        throw new TypeError('verlux: addPhrases expects an array of PhraseEntry');
      }
      entries.forEach(validatePhraseEntry);
      const allPhrases = [...phrases, ...entries];
      index = buildIndex(words, allPhrases);
    },

    /**
     * Get a toxicity score for the text.
     * Returns a 0-1 score with category breakdown, repetition detection, and all matches.
     */
    score(text: string, config?: VerluxConfig): ToxicityScore {
      if (!text || text.trim().length === 0) {
        return {
          toxicity: 0,
          categories: {},
          severities: { low: 0, medium: 0, high: 0 },
          repetitionSpam: false,
          uniqueMatches: 0,
          totalMatches: 0,
          detections: [],
        };
      }

      const detections = this.detect(text, config);
      const tokens = tokenize(text);
      const tokenCount = Math.max(tokens.length, 1);

      // Category counts
      const categories: Record<string, number> = {};
      const severities: Record<Severity, number> = { low: 0, medium: 0, high: 0 };
      const matchedWords = new Set<string>();

      for (const d of detections) {
        categories[d.category] = (categories[d.category] || 0) + 1;
        severities[d.severity]++;
        matchedWords.add(d.matched);
      }

      // Repetition spam detection — same word/token appearing 3+ times
      const tokenFreq: Record<string, number> = {};
      for (const t of tokens) {
        const w = t.value.toLowerCase();
        tokenFreq[w] = (tokenFreq[w] || 0) + 1;
      }
      const repetitionSpam = Object.entries(tokenFreq).some(
        ([word, count]) => count >= 3 && matchedWords.has(word)
      );

      // Toxicity score calculation
      // Weighted: high=1.0, medium=0.6, low=0.3
      const severityWeights: Record<Severity, number> = { low: 0.3, medium: 0.6, high: 1.0 };
      let weightedSum = 0;
      for (const d of detections) {
        weightedSum += severityWeights[d.severity] * d.confidence;
      }

      // Normalize: ratio of weighted abuse to token count, capped at 1
      let toxicity = Math.min(weightedSum / tokenCount, 1);

      // Boost for repetition spam
      if (repetitionSpam) {
        toxicity = Math.min(toxicity * 1.5, 1);
      }

      // Round to 2 decimal places
      toxicity = Math.round(toxicity * 100) / 100;

      return {
        toxicity,
        categories,
        severities,
        repetitionSpam,
        uniqueMatches: matchedWords.size,
        totalMatches: detections.length,
        detections,
      };
    },
  };
}

/** Default Verlux instance — ready to use out of the box */
export const verlux = createInstance();

/** Named export for creating custom instances */
export { createInstance };

/** Default export */
export default verlux;
