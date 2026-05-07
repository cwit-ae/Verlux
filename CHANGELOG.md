# Changelog

All notable changes to Verlux are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry names *what* changed and, where the reasoning is not obvious from the change itself, *why* — so future readers can decide whether a release is relevant to them without re-reading the diff.

## [Unreleased]

_No unreleased changes yet._

---

## [1.0.9] — 2026-05-05

### Added

- Substantial expansion of the English dictionary, including additional fuzzy-matching variants and category coverage. The expansion is paired with parallel updates to the matcher and tokenizer so that the new entries interact correctly with separator stripping, repetition collapse, and the substring-collision safelist.
- Tokenizer and matcher refinements that improve handling of edge inputs (snake_case identifiers, mixed punctuation runs) so that incidental occurrences of dictionary forms inside identifiers or code-like text no longer surface as detections.

### Changed

- Hinglish dictionary tweaks for spelling-variant coverage on common romanizations.

### CI

- `github/codeql-action` bumped from 4.35.2 to 4.35.3 ([#32](https://github.com/cwit-ae/Verlux/pull/32)).

---

## [1.0.8] — 2026-04-30

### Added

- **Unicode obfuscation handling.** A new front-of-pipeline `unicodeFold()` pass folds Cyrillic and Greek codepoints that visually impersonate Latin letters (for example `fuсk` written with Cyrillic U+0441 in place of Latin `c`), applies NFKC compatibility decomposition for fullwidth (`Ｆｕｃｋ`), mathematical-alphanumeric (`𝐟𝐮𝐜𝐤`), and ligature (`ﬁ`) forms, strips invisible / zero-width codepoints, and drops orphan combining marks (for example the strikethrough overlay in `f̸u̸c̸k̸`) before tokenization. Result `position` indices are mapped back through the fold's index map so `original`, position ranges, and `verlux.censor()` continue to operate on the input as the user typed it — including across UTF-16 surrogate pairs and one-to-many NFKC expansions. Pure-ASCII input takes a fast path that skips the per-codepoint loop entirely.
- A dedicated 296-line test suite at [`tests/unicode-obfuscation.test.ts`](./tests/unicode-obfuscation.test.ts) covering Cyrillic / Greek confusables, fullwidth and mathematical-alphanumeric NFKC folds, surrogate-pair-safe position mapping, combining-mark obfuscation (single overlays and stacked diacritics), preservation of legitimate precomposed Latin diacritics in Spanish / French / German entries, and non-flagging of legitimate Russian and Greek text that happens to fold to Latin letters but does not form a dictionary entry.

### Added (English dictionary)

- Additional safe-word entries to harden the substring-collision corpus against newly identified near-collisions surfaced during obfuscation testing.

---

## [1.0.7] — 2026-04-29

### Added

- New fuzzy-matching variants in the English dictionary, broadening coverage of common misspellings without lowering the global fuzzy threshold.
- Additional English safe words, paired with regression tests in the false-positive corpus.

---

## [1.0.6] — 2026-04-24

### Changed

- Substring-collision matcher hardened with additional internal safelist coverage. Matched by an expansion of the false-positive regression corpus so the new safelist entries are exercised on every test run.

---

## [1.0.5] — 2026-04-24

### Changed

- Safe-words list expanded to cover additional near-collisions identified during regression testing — reduces false positives on benign inputs whose surface forms incidentally contain a profane substring (the classical _Scunthorpe_ class of failures).

---

## [1.0.4] — 2026-04-24

### Fixed

- Skip l33t decoding for pure-digit tokens. Previously, single-character substitutions in the leet table (for example `4 → a`, `2 → z`) would decode pure-digit tokens such as `"422"` or `"1337"` into hallucinated dictionary matches. Pure-digit tokens now bypass the leet decode path entirely, eliminating an entire class of false positives on numeric input (timestamps, identifiers, version numbers, ZIP codes).

---

## [1.0.3] — 2026-04-22

### Added

- **French language pack** — 632-line dictionary covering metropolitan French invective and Franco-Arabic (banlieue) slang, with apostrophe-aware tokenization for grammatical elisions (so the meaningful word is matched regardless of the elision prefix), accent-aware matching for standard accented forms (`é`, `è`, `ê`, `à`, `ç`, `ï`, `ô`), and a French-specific false-positive safelist for short high-collision roots gated with `allowPartialMatch: false`.
- **German language pack** — 623-line dictionary covering standard High German invective with full umlaut handling. Every umlaut-bearing entry is listed in three input forms — canonical (`ä`, `ö`, `ü`, `ß`), accent-stripped (`a`, `o`, `u`, `ss`), and ASCII digraph (`ae`, `oe`, `ue`, `ss`) — so all three render forms are matched after normalization.
- Tokenizer and matcher updates required to thread the new language packs through the existing detection pipeline.
- Per-language test suites: [`tests/french.test.ts`](./tests/french.test.ts) (142 lines) and [`tests/german.test.ts`](./tests/german.test.ts) (135 lines).

### Changed

- English dictionary updated alongside the new language packs (+106 lines), primarily to extend safe-word coverage where the new packs introduced additional collision surface.

---

## [1.0.2] — 2026-04-21

### Changed

- npm publish workflow switched to OIDC trusted publishing (no long-lived npm token in CI) ([#11](https://github.com/cwit-ae/Verlux/pull/11)).
- npm version upgraded inside the publish workflow so OIDC trusted publishing succeeds on Node 22+ runners ([#12](https://github.com/cwit-ae/Verlux/pull/12), [#13](https://github.com/cwit-ae/Verlux/pull/13)).

### Fixed

- Publish workflow compatibility on Node 24 runners ([#15](https://github.com/cwit-ae/Verlux/pull/15)).

---

## [1.0.1] — 2026-04-21

### Added

- README badges for CI status, CodeQL status, and weekly downloads ([#8](https://github.com/cwit-ae/Verlux/pull/8)).
- Dependabot configuration for the npm and GitHub Actions ecosystems ([#1](https://github.com/cwit-ae/Verlux/pull/1)).
- CodeQL workflow scaffolding for static-analysis security scanning ([#6](https://github.com/cwit-ae/Verlux/pull/6), [#7](https://github.com/cwit-ae/Verlux/pull/7)).

### Fixed

- Indentation correction in word-rendering output and removal of an unused import in the test files ([#9](https://github.com/cwit-ae/Verlux/pull/9)).

---

## [1.0.0] — 2026-04-21

### Added

- Initial public release.
- Detection pipeline with tokenization, exact match, normalized match (leet decoding, accent stripping, repetition collapse, separator stripping), Devanagari-to-Latin transliteration, Aho–Corasick partial-match scan, Levenshtein-based fuzzy match, n-gram phrase detection, and overlap deduplication.
- Three language packs out of the box: English, Hinglish (Hindi in Latin script), and Spanish (peninsular and major Latin American variants).
- Public API: `verlux.detect`, `verlux.score`, `verlux.isClean`, `verlux.censor`, `verlux.configure`, `verlux.addWords`, `verlux.addPhrases`.
- Severity (`low` / `medium` / `high`) and category (`slur`, `sexual`, `insult`, `hate`, `threat`, `drug`, `other`) metadata on every detection.
- Toxicity scoring weighted by severity, normalized against token count, with a repetition-spam multiplier.
- ESM and CommonJS dual builds with bundled TypeScript declarations. Zero runtime dependencies. Node.js ≥ 18 supported.

[Unreleased]: https://github.com/cwit-ae/Verlux/compare/v1.0.9...HEAD
[1.0.9]: https://github.com/cwit-ae/Verlux/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/cwit-ae/Verlux/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/cwit-ae/Verlux/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/cwit-ae/Verlux/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/cwit-ae/Verlux/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/cwit-ae/Verlux/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/cwit-ae/Verlux/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/cwit-ae/Verlux/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/cwit-ae/Verlux/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/cwit-ae/Verlux/releases/tag/v1.0.0
