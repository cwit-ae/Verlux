/**
 * Phrase context — what the phrase tier needs beyond raw n-gram windows.
 *
 * 1. Contraction expansion. The tokenizer splits `you'll` into `you` + `ll`
 *    and `didn't` into `didn` + `t`, so a dictionary phrase written in full
 *    ("you will pay for this") never saw its contracted form, and listing
 *    every contraction by hand is how entries like "you'll pay for that" ended
 *    up duplicated. `expandContractions` produces a second token stream with
 *    the contractions spelled out (`you will`, `did not`), which the phrase
 *    tier matches in addition to the raw one. Phrase keys are built through
 *    the same expansion, so one entry covers both spellings.
 *
 * 2. Context constraints. Some phrases are threats or insults in one sentence
 *    and ordinary English in the next, and the only difference is the word
 *    beside them: "the noise should die down", "this song will get you fired
 *    up", "put it in the white trash bag". A `PhraseEntry` can say which
 *    neighbouring words cancel it (`notFollowedBy`, `notPrecededBy`) or that
 *    it only counts at the end of a sentence (`atClauseEnd`), which is the
 *    difference between "you will pay for this!" and "you will pay for this
 *    order on delivery".
 */

import type { PhraseEntry } from '../types.js';
import type { Token } from './tokenizer.js';

/** A token in the expanded stream. Both halves of an expansion share `source`. */
export interface PhraseToken extends Token {
  /** The raw token this was produced from. */
  source: Token;
  /** Whether `value` differs from the source text, i.e. this token was expanded. */
  rewritten: boolean;
}

const APOSTROPHES = new Set(["'", '‘', '’']);

/** `X'll` → `X will`, keyed by the suffix the tokenizer splits off. */
const SUFFIX_EXPANSIONS: ReadonlyMap<string, string> = new Map([
  ['ll', 'will'],
  ['re', 'are'],
  ['ve', 'have'],
  ['d', 'would'],
]);

/**
 * `'s` is "is" only after these. Everywhere else it is usually a possessive
 * (`mom's`), and rewriting that to `mom is` would invent phrases.
 */
const IS_PRONOUNS = new Set([
  'he', 'she', 'it', 'that', 'what', 'who', 'there', 'here', 'where', 'how',
]);

/** `n't` prefixes whose base is not just the prefix minus its `n`. */
const NOT_PREFIXES: ReadonlyMap<string, string> = new Map([
  ['won', 'will'],
  ['can', 'can'],
  ['ain', 'is'],
  ['shan', 'shall'],
]);

/**
 * Informal spellings typed as one word with no apostrophe. Deliberately
 * excludes the ones that are also ordinary words with another meaning in the
 * same position (`ill`, `hell`, `well`, `were`, `its`, `id`, `ur` — the last is
 * both "your" and "you are", and guessing wrong turns "watch ur back" into
 * "watch you are back").
 */
const WORD_EXPANSIONS: ReadonlyMap<string, readonly string[]> = new Map(Object.entries({
  im: ['i', 'am'],
  youll: ['you', 'will'],
  youre: ['you', 'are'],
  youve: ['you', 'have'],
  theyll: ['they', 'will'],
  theyre: ['they', 'are'],
  dont: ['do', 'not'],
  didnt: ['did', 'not'],
  doesnt: ['does', 'not'],
  isnt: ['is', 'not'],
  arent: ['are', 'not'],
  wasnt: ['was', 'not'],
  werent: ['were', 'not'],
  wont: ['will', 'not'],
  cant: ['can', 'not'],
  aint: ['is', 'not'],
  shouldnt: ['should', 'not'],
  wouldnt: ['would', 'not'],
  couldnt: ['could', 'not'],
  gonna: ['going', 'to'],
  wanna: ['want', 'to'],
  gotta: ['got', 'to'],
  imma: ['i', 'am', 'going', 'to'],
  u: ['you'],
  ya: ['you'],
  r: ['are'],
}));

/** Longest key in WORD_EXPANSIONS; longer tokens skip the lookup. */
const MAX_WORD_EXPANSION_LENGTH = Math.max(...[...WORD_EXPANSIONS.keys()].map(k => k.length));
const UPPERCASE_RE = /[A-Z]/;

/**
 * WORD_EXPANSIONS lookup, case-insensitive. Runs on every token of every
 * input, so it avoids allocating a lowercased copy unless the token has a
 * capital in it.
 */
function wordExpansion(value: string): readonly string[] | undefined {
  if (value.length > MAX_WORD_EXPANSION_LENGTH) return undefined;
  return WORD_EXPANSIONS.get(value) ??
    (UPPERCASE_RE.test(value) ? WORD_EXPANSIONS.get(value.toLowerCase()) : undefined);
}

/**
 * The expansion of a contraction pair (`prefix` + apostrophe + `suffix`), or
 * null when the pair is not one we rewrite.
 */
function expandPair(prefix: string, suffix: string): [string, string] | null {
  const p = prefix.toLowerCase();
  const s = suffix.toLowerCase();
  const simple = SUFFIX_EXPANSIONS.get(s);
  if (simple) return [p, simple];
  if (s === 'm' && p === 'i') return [p, 'am'];
  if (s === 's' && IS_PRONOUNS.has(p)) return [p, 'is'];
  if (s === 't' && p.length >= 2 && p.endsWith('n')) {
    return [NOT_PREFIXES.get(p) ?? p.slice(0, -1), 'not'];
  }
  return null;
}

function rawToken(t: Token): PhraseToken {
  return { value: t.value, start: t.start, end: t.end, source: t, rewritten: false };
}

/**
 * The token stream with contractions spelled out. Returns the same tokens
 * (wrapped) when nothing was expanded; check `rewritten` to tell.
 *
 * A pair is only rewritten when the two tokens are separated by exactly one
 * apostrophe in the input — `I m` with a space is not `I'm`.
 */
export function expandContractions(tokens: readonly Token[], input: string): PhraseToken[] {
  const out: PhraseToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (next && next.start === t.end + 1 && APOSTROPHES.has(input[t.end])) {
      const pair = expandPair(t.value, next.value);
      if (pair) {
        out.push({
          value: pair[0], start: t.start, end: t.end, source: t,
          rewritten: pair[0] !== t.value.toLowerCase(),
        });
        out.push({ value: pair[1], start: next.start, end: next.end, source: next, rewritten: true });
        i++;
        continue;
      }
    }
    const words = wordExpansion(t.value);
    if (words) {
      for (const w of words) {
        out.push({ value: w, start: t.start, end: t.end, source: t, rewritten: true });
      }
      continue;
    }
    out.push(rawToken(t));
  }
  return out;
}

/** A `PhraseEntry`'s context constraints, resolved to comparison keys once. */
export interface CompiledPhraseContext {
  /** Word sequences that cancel the match when they come right after it. */
  notFollowedBy: string[][];
  /** Word sequences that cancel the match when they come right before it. */
  notPrecededBy: string[][];
  atClauseEnd: boolean;
}

/** Whether an entry declares any context constraint at all. */
export function hasPhraseContext(entry: PhraseEntry): boolean {
  return Boolean(
    entry.atClauseEnd ||
    (entry.notFollowedBy && entry.notFollowedBy.length > 0) ||
    (entry.notPrecededBy && entry.notPrecededBy.length > 0)
  );
}

/**
 * Resolve an entry's constraints into comparison keys. Each constraint string
 * goes through the same tokenize-and-expand path as the input, so a
 * constraint written `"don't"` compares equal to input `dont` and `do not`.
 */
export function compilePhraseContext(
  entry: PhraseEntry,
  tokenize: (s: string) => Token[],
  wordKey: (word: string) => string
): CompiledPhraseContext {
  const compile = (list: readonly string[] | undefined): string[][] =>
    (list ?? [])
      .map(s => expandContractions(tokenize(s), s).map(t => wordKey(t.value)))
      .filter(seq => seq.length > 0);
  return {
    notFollowedBy: compile(entry.notFollowedBy),
    notPrecededBy: compile(entry.notPrecededBy),
    atClauseEnd: entry.atClauseEnd === true,
  };
}

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const JOINING_GAP_RE = /^[\s'‘’]*$/;

/**
 * Whether two neighbouring stream tokens belong to the same run of words.
 * Punctuation between them ends the run, so "you should die. Down with it"
 * is not "should die down".
 */
function joined(a: PhraseToken, b: PhraseToken, input: string): boolean {
  if (a.source === b.source) return true;
  return JOINING_GAP_RE.test(input.slice(a.end, b.start));
}

/** Whether the phrase is the last thing in its sentence or clause. */
function endsClause(stream: readonly PhraseToken[], last: number, input: string): boolean {
  const next = stream[last + 1];
  // A window that stops inside an expansion (`gonna` → `going` | `to`) is
  // followed by the rest of that word.
  if (next && next.source === stream[last].source) return false;
  for (let k = stream[last].end; k < input.length; k++) {
    const ch = input[k];
    if (ch === '\n' || ch === '\r') return true;
    if (ch === ' ' || ch === '\t') continue;
    return !WORD_CHAR_RE.test(ch);
  }
  return true;
}

function followedBy(
  stream: readonly PhraseToken[], last: number, seq: readonly string[],
  input: string, wordKey: (w: string) => string
): boolean {
  for (let k = 0; k < seq.length; k++) {
    const prev = stream[last + k];
    const tok = stream[last + k + 1];
    if (!tok || !joined(prev, tok, input) || wordKey(tok.value) !== seq[k]) return false;
  }
  return true;
}

function precededBy(
  stream: readonly PhraseToken[], first: number, seq: readonly string[],
  input: string, wordKey: (w: string) => string
): boolean {
  for (let k = 0; k < seq.length; k++) {
    const next = stream[first - k];
    const tok = stream[first - k - 1];
    if (!tok || !joined(tok, next, input) || wordKey(tok.value) !== seq[seq.length - 1 - k]) {
      return false;
    }
  }
  return true;
}

/**
 * Whether a phrase match spanning `stream[first..last]` is cancelled by its
 * context.
 */
export function violatesPhraseContext(
  ctx: CompiledPhraseContext,
  stream: readonly PhraseToken[],
  first: number,
  last: number,
  input: string,
  wordKey: (word: string) => string
): boolean {
  if (ctx.atClauseEnd && !endsClause(stream, last, input)) return true;
  for (const seq of ctx.notFollowedBy) {
    if (followedBy(stream, last, seq, input, wordKey)) return true;
  }
  for (const seq of ctx.notPrecededBy) {
    if (precededBy(stream, first, seq, input, wordKey)) return true;
  }
  return false;
}
