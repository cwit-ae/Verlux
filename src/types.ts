/** Severity level of a profane word */
export type Severity = 'low' | 'medium' | 'high';

/** Category of abuse */
export type Category =
  | 'slur'
  | 'sexual'
  | 'insult'
  | 'hate'
  | 'threat'
  | 'drug'
  | 'other';

/** A single entry in a profanity dictionary */
export interface DictionaryEntry {
  /** The canonical form of the word */
  word: string;
  /** Pre-computed normalized/variant forms for fast lookup */
  normalized: string[];
  /** Language code (e.g., 'en', 'hi-latn') */
  language: string;
  /** How severe this word is */
  severity: Severity;
  /** What category of abuse */
  category: Category;
  /** Whether to match this word inside other words (false = whole word only) */
  allowPartialMatch: boolean;
  /** Known aliases, slang spellings, abbreviations */
  aliases: string[];
}

/** A detected profanity match in the input text */
export interface DetectionResult {
  /** The original text as it appeared in the input */
  original: string;
  /** The dictionary word it matched against */
  matched: string;
  /** Language of the matched word */
  language: string;
  /** Severity level */
  severity: Severity;
  /** Category of abuse */
  category: Category;
  /** Start and end character indices in the original input */
  position: [start: number, end: number];
  /** How the match was found */
  matchType: 'exact' | 'normalized' | 'alias' | 'fuzzy' | 'phrase';
  /** Confidence score 0-1 (1 = exact match, lower = fuzzy) */
  confidence: number;
}

/** Configuration options for detection */
export interface VerluxConfig {
  /** Languages to check against (default: all loaded) */
  languages?: string[];
  /** Enable fuzzy matching (default: true) */
  fuzzyMatch?: boolean;
  /** Fuzzy match threshold 0-1 (default: 0.85) */
  fuzzyThreshold?: number;
  /** Enable phrase detection (default: true) */
  phraseDetection?: boolean;
  /** Enable transliteration (default: true) */
  transliteration?: boolean;
  /** Minimum severity to report (default: 'low') */
  minSeverity?: Severity;
  /** Whitelist of words to never flag. Entries are lowercased — matching is always case-insensitive. */
  whitelist?: string[];
}

/** Internal resolved config with all defaults applied */
export interface ResolvedConfig {
  languages: string[] | null;
  fuzzyMatch: boolean;
  fuzzyThreshold: number;
  phraseDetection: boolean;
  transliteration: boolean;
  minSeverity: Severity;
  whitelist: Set<string>;
}

/** Toxicity score breakdown */
export interface ToxicityScore {
  /** Overall toxicity 0-1 (0 = clean, 1 = extremely toxic) */
  toxicity: number;
  /** Breakdown by category */
  categories: Record<string, number>;
  /** Breakdown by severity */
  severities: Record<Severity, number>;
  /** Whether repetition spam was detected */
  repetitionSpam: boolean;
  /** Number of unique abusive words found */
  uniqueMatches: number;
  /** Total matches including duplicates */
  totalMatches: number;
  /** Full detection results */
  detections: DetectionResult[];
}

/** A phrase entry (multi-word) in the dictionary */
export interface PhraseEntry {
  /** The full phrase */
  phrase: string;
  /** Individual words in the phrase */
  words: string[];
  /** Language code */
  language: string;
  /** Severity */
  severity: Severity;
  /** Category */
  category: Category;
  /**
   * Words that cancel the match when they come right after the phrase, for
   * phrases that are harmless with one continuation and abusive with another
   * ("should die" vs "the noise should die down"). An item with several words
   * ("and back") must match that whole sequence. Punctuation between the
   * phrase and the next word breaks the link.
   */
  notFollowedBy?: string[];
  /** Words that cancel the match when they come right before the phrase. */
  notPrecededBy?: string[];
  /**
   * Only match when the phrase ends its sentence or clause — followed by the
   * end of the text, a line break, or punctuation, not by another word.
   * Separates "you will pay for this!" from "you will pay for this order".
   */
  atClauseEnd?: boolean;
}
