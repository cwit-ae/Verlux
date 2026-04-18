/**
 * Dictionary registry — loads and indexes all language dictionaries.
 */

import type { DictionaryEntry, PhraseEntry, Severity } from '../types.js';
import { EN_WORDS, EN_PHRASES } from './en.js';
import { HI_LATN_WORDS, HI_LATN_PHRASES } from './hi-latn.js';
import { ES_WORDS, ES_PHRASES } from './es.js';

export interface LanguagePack {
  code: string;
  name: string;
  words: DictionaryEntry[];
  phrases: PhraseEntry[];
}

const VALID_SEVERITIES: ReadonlySet<Severity> = new Set<Severity>(['low', 'medium', 'high']);
const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'slur', 'sexual', 'insult', 'hate', 'threat', 'drug', 'other',
]);

// Run at module load: catches dictionary typos (bad severity, missing fields)
// at startup rather than at detection time, so errors point at the source.
function assertValidPack(pack: LanguagePack): void {
  pack.words.forEach((w, i) => {
    if (typeof w.word !== 'string' || !w.word) {
      throw new TypeError(`[verlux/${pack.code}] word at index ${i} missing "word"`);
    }
    if (!VALID_SEVERITIES.has(w.severity)) {
      throw new TypeError(`[verlux/${pack.code}] "${w.word}" invalid severity "${String(w.severity)}"`);
    }
    if (!VALID_CATEGORIES.has(w.category)) {
      throw new TypeError(`[verlux/${pack.code}] "${w.word}" invalid category "${String(w.category)}"`);
    }
    if (!Array.isArray(w.normalized) || !Array.isArray(w.aliases)) {
      throw new TypeError(`[verlux/${pack.code}] "${w.word}" malformed normalized/aliases`);
    }
    if (typeof w.allowPartialMatch !== 'boolean') {
      throw new TypeError(`[verlux/${pack.code}] "${w.word}" missing allowPartialMatch`);
    }
  });
  pack.phrases.forEach((p, i) => {
    if (typeof p.phrase !== 'string' || !p.phrase) {
      throw new TypeError(`[verlux/${pack.code}] phrase at index ${i} missing "phrase"`);
    }
    if (!VALID_SEVERITIES.has(p.severity)) {
      throw new TypeError(`[verlux/${pack.code}] phrase "${p.phrase}" invalid severity`);
    }
    if (!VALID_CATEGORIES.has(p.category)) {
      throw new TypeError(`[verlux/${pack.code}] phrase "${p.phrase}" invalid category`);
    }
    if (!Array.isArray(p.words) || p.words.length === 0) {
      throw new TypeError(`[verlux/${pack.code}] phrase "${p.phrase}" missing words array`);
    }
  });
}

/** All available language packs */
const LANGUAGE_PACKS: LanguagePack[] = [
  { code: 'en', name: 'English', words: EN_WORDS, phrases: EN_PHRASES },
  { code: 'hi-latn', name: 'Hinglish', words: HI_LATN_WORDS, phrases: HI_LATN_PHRASES },
  { code: 'es', name: 'Spanish', words: ES_WORDS, phrases: ES_PHRASES },
];

LANGUAGE_PACKS.forEach(assertValidPack);

/** Map of language code → pack for quick lookup */
const PACK_MAP = new Map<string, LanguagePack>(
  LANGUAGE_PACKS.map(p => [p.code, p])
);

/**
 * Get all available language codes.
 */
export function availableLanguages(): string[] {
  return LANGUAGE_PACKS.map(p => p.code);
}

/**
 * Get words for specific languages (or all if none specified).
 */
export function getWords(languages?: string[] | null): DictionaryEntry[] {
  if (!languages) {
    return LANGUAGE_PACKS.flatMap(p => p.words);
  }
  return languages
    .map(code => PACK_MAP.get(code))
    .filter((p): p is LanguagePack => p !== undefined)
    .flatMap(p => p.words);
}

/**
 * Get phrases for specific languages (or all if none specified).
 */
export function getPhrases(languages?: string[] | null): PhraseEntry[] {
  if (!languages) {
    return LANGUAGE_PACKS.flatMap(p => p.phrases);
  }
  return languages
    .map(code => PACK_MAP.get(code))
    .filter((p): p is LanguagePack => p !== undefined)
    .flatMap(p => p.phrases);
}
