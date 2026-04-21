/**
 * Tokenizer — splits input text into tokens with position tracking,
 * and generates n-gram phrase windows for phrase detection.
 */

export interface Token {
  /** The raw text of the token */
  value: string;
  /** Start index in the original string */
  start: number;
  /** End index (exclusive) in the original string */
  end: number;
}

/**
 * Tokenize input text into individual words, preserving positions.
 * Splits on whitespace and common punctuation boundaries.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  // Match word-like sequences (including numbers and apostrophes within words)
  // Latin Extended block (\u00C0-\u024F) covers Spanish/French/German diacritics:
  // á é í ó ú ü ñ ç à â ê î ô û etc. — keeps accented words as single tokens.
  // Apostrophe segment is bounded (single optional suffix, capped length) to
  // prevent catastrophic backtracking on pathological input like "a''''''…".
  const regex = /[a-zA-Z0-9\u00C0-\u024F\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\u3400-\u4DBF]+(?:['\u2018\u2019][a-zA-Z]{1,20})?/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    tokens.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return mergeSingleLetterRuns(tokens, input);
}

/**
 * Collapse runs of ≥3 consecutive single-letter tokens separated only by
 * whitespace into one synthetic token (e.g. "f u c k" → "fuck"). Catches
 * space-separated obfuscation that survives the normalizer's separator strip
 * because whitespace splits tokens before normalization runs.
 *
 * Guarded by runLength ≥ 3 to avoid merging "I a" or common 2-letter cases.
 * Acronyms like "U S A" merge to "usa" but don't collide with dictionary
 * entries — the dictionary only matches profanity, so non-profane merges are
 * silent no-ops.
 */
function mergeSingleLetterRuns(tokens: Token[], input: string): Token[] {
  const merged: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (isSingleLetterToken(tokens[i])) {
      let j = i + 1;
      while (
        j < tokens.length &&
        isSingleLetterToken(tokens[j]) &&
        isWhitespaceOnlyGap(input, tokens[j - 1].end, tokens[j].start)
      ) {
        j++;
      }
      if (j - i >= 3) {
        merged.push({
          value: tokens.slice(i, j).map(t => t.value).join(''),
          start: tokens[i].start,
          end: tokens[j - 1].end,
        });
        i = j;
        continue;
      }
    }
    merged.push(tokens[i]);
    i++;
  }
  return merged;
}

function isSingleLetterToken(t: Token): boolean {
  return t.value.length === 1 && /^[A-Za-z]$/.test(t.value);
}

function isWhitespaceOnlyGap(input: string, from: number, to: number): boolean {
  if (to <= from) return false;
  for (let k = from; k < to; k++) {
    if (!/\s/.test(input[k])) return false;
  }
  return true;
}

/**
 * Generate n-gram phrase windows from tokens.
 * For phrase detection, we need to check sequences of 2-4 words.
 */
export function phraseWindows(tokens: Token[], maxSize: number = 4): PhraseWindow[] {
  const windows: PhraseWindow[] = [];

  for (let size = 2; size <= Math.min(maxSize, tokens.length); size++) {
    for (let i = 0; i <= tokens.length - size; i++) {
      const slice = tokens.slice(i, i + size);
      windows.push({
        tokens: slice,
        phrase: slice.map(t => t.value).join(' '),
        start: slice[0].start,
        end: slice[slice.length - 1].end,
      });
    }
  }

  return windows;
}

export interface PhraseWindow {
  tokens: Token[];
  phrase: string;
  start: number;
  end: number;
}
