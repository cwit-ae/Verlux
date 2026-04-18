/**
 * Fuzzy matching — Levenshtein distance and similarity scoring
 * for catching typos and creative misspellings.
 */

/**
 * Compute Levenshtein edit distance between two strings.
 * Uses optimized single-row DP approach.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for memory efficiency
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;

  // Single-row DP
  let prev = new Array(aLen + 1);
  let curr = new Array(aLen + 1);

  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[aLen];
}

/**
 * Compute similarity ratio between two strings (0-1).
 * 1 = identical, 0 = completely different.
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Quick pre-filter: can these two strings possibly meet the threshold?
 * Avoids expensive Levenshtein calculation for obviously different strings.
 */
export function canMatch(a: string, b: string, threshold: number): boolean {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;

  // Length difference alone can rule out a match
  const lenDiff = Math.abs(a.length - b.length);
  const maxAllowedDistance = Math.floor(maxLen * (1 - threshold));
  if (lenDiff > maxAllowedDistance) return false;

  // Check first character match (most profanity variants keep the first letter)
  if (a.length > 0 && b.length > 0 && a[0] !== b[0]) {
    // If first chars differ, we've already used 1 edit — be stricter
    if (maxAllowedDistance < 2) return false;
  }

  return true;
}

/**
 * Find the best fuzzy match for a word in a set of candidates.
 * Returns the match and its confidence, or null if nothing meets threshold.
 */
export function bestFuzzyMatch(
  word: string,
  candidates: string[],
  threshold: number
): { match: string; confidence: number } | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!canMatch(word, candidate, threshold)) continue;

    const score = similarity(word, candidate);
    if (score >= threshold && score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestMatch === null) return null;
  return { match: bestMatch, confidence: bestScore };
}
