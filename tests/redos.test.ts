import { verlux } from '../src/index';

// Regression guard for CodeQL js/polynomial-redos (alerts #4, #5). A regex
// like /[…]+$/ with no `^` anchor is retried from every start position, so a
// long run of the repeated character followed by anything else costs O(n²).
// At this length the old regexes took several seconds; a linear scan takes
// milliseconds, so the budget below is generous for slow CI runners.
const N = 50_000;
const BUDGET_MS = 1_000;

function timeDetect(input: string): number {
  const start = performance.now();
  verlux.detect(input);
  return performance.now() - start;
}

describe('no polynomial backtracking on long repeated runs', () => {
  it('long run of trailing-boundary punctuation inside a segment', () => {
    expect(timeDetect('x' + '"'.repeat(N) + 'x')).toBeLessThan(BUDGET_MS);
  });

  it('long run of digits inside a code-like token', () => {
    // Letter + digits reads as a code; the trailing `-` is skipped by the code
    // check but not by the edge-digit strip, so `[0-9]+$` fails at every digit.
    expect(timeDetect('z' + '0'.repeat(N) + '-')).toBeLessThan(BUDGET_MS);
  });
});
