# Changelog

All notable changes to Verlux are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry names *what* changed and, where the reasoning is not obvious from the change itself, *why* — so future readers can decide whether a release is relevant to them without re-reading the diff.

## [Unreleased]

_No unreleased changes yet._

---

## [1.0.11] — 2026-05-07

### Security

- **Input boundary hardened across `detect`, `score`, `censor`, and `isClean`.** Non-string `text` arguments — numbers, booleans, plain objects, arrays, symbols, BigInts, `null`, and `undefined` — previously crashed inside the matching pipeline with `TypeError: text.trim is not a function`, or, in the case of objects whose duck-typed `trim` returned a length-bearing value, surfaced as `RangeError: Invalid array length` from `unicodeFold`. Each of the four public methods now validates `text` at the API boundary via a single `validateInputText()` helper and throws `TypeError: verlux: text must be a string (got <type>)` before any matcher state is touched. This closes a class of crashes that any HTTP integration piping `req.body.message`-style values directly into Verlux was previously exposed to.
- **Hard 100,000-character cap on `text` inputs.** Previously, a single non-whitespace token of roughly four million or more identical characters caused V8's Irregexp engine to overflow its internal stack inside the normalizer's repetition-collapse pass (`/(.)\1{2,}/g`) — a remote denial-of-service vector reachable from any unguarded `verlux.detect()` caller, for example via an HTTP request body containing `'a'.repeat(5_000_000)`. Inputs exceeding the cap now throw `RangeError: verlux: text exceeds maximum length of 100000 characters` at the API boundary. Realistic moderation inputs (chat messages, support tickets, forum posts) are well under this ceiling; consumers who scan longer documents should chunk the input.
- **Repetition-collapse normalizer rewritten without regex.** The two repetition-collapse passes in `normalize()` and `normalizeVariants()` now run as manual O(n) scans through a single `collapseRuns()` helper rather than as `String.prototype.replace` calls against `/(.)\1{2,}/g` and `/(.)\1+/g`. Together with the input cap, this removes the V8 regex-engine stack-overflow vector at its root, regardless of how the text reaches the normalizer. Newline-like characters (`\n`, `\r`, U+2028, U+2029) are deliberately preserved so the new helper matches the original `(.)`-without-`s`-flag semantics exactly; all 776 existing detection tests pass without modification.
- **`censor()` mask coerced safely to a string.** A non-string `mask` value (for example `verlux.censor(text, { mask: 1234 })`) previously crashed at `mask.repeat(...)` with `TypeError: mask.repeat is not a function`. The mask now silently defaults to `'*'` whenever the supplied value is not a string, matching the documented "configurable mask character" contract.
- **Whitelist entries validated as strings at configuration time.** A `whitelist` array containing a poisoned object whose `toString` throws (`{ toString() { throw new Error('pwn') } }`) previously propagated the arbitrary thrown error out of `detect()` through the defensive `String(w)` coercion in `resolveConfig`. The whitelist array is now validated element-by-element by `validateConfig`, and any non-string entry is rejected with `TypeError: verlux: whitelist[i] must be a string (got <type>)` before configuration is resolved. The defensive `String(w)` coercion has been removed accordingly.
- **Per-call `languages` configuration no longer rebuilds the dictionary index on every call.** Previously, any caller forwarding user-controlled language preferences — for example `verlux.detect(text, { languages: req.body.langs })` — paid the full cost of `buildIndex(...)` on every invocation, measured at approximately 70× CPU amplification on a hot path (1,070 ms versus 15 ms for one thousand calls of an eleven-character input). A cache keyed on the sorted language set now reuses prior builds; cache size is bounded by the powerset of the supported language list and so cannot grow unbounded under adversarial input. Repeat-call latency drops to within noise of the no-config baseline.

### Changed

- `detect`, `score`, `censor`, and `isClean` now throw `TypeError` on non-string `text` inputs. Previously, falsy non-strings such as `null`, `undefined`, `0`, and `false` returned an empty result, while truthy non-strings crashed with cryptic internal errors. Empty and whitespace-only strings continue to short-circuit to the empty result as before. Callers who rely on the prior permissive behavior for nullish inputs should add an explicit `text != null` guard at the call site.

---

## [1.0.10] — 2026-05-06

### Added

- **Project governance and contributor documentation.** Added [`CHANGELOG.md`](./CHANGELOG.md) (this file) following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md) describing the dictionary-submission and pull-request workflow, [`LICENSE`](./LICENSE) (MIT), and [`SECURITY.md`](./SECURITY.md) describing the private vulnerability-disclosure channel. These files codify the contribution and disclosure expectations that the project had been operating under informally.
- **Structured GitHub issue and pull-request templates.** Added [`.github/ISSUE_TEMPLATE/bug_report.yml`](./.github/ISSUE_TEMPLATE/bug_report.yml), [`false_positive.yml`](./.github/ISSUE_TEMPLATE/false_positive.yml), [`missed_detection.yml`](./.github/ISSUE_TEMPLATE/missed_detection.yml), and [`feature_request.yml`](./.github/ISSUE_TEMPLATE/feature_request.yml), together with [`config.yml`](./.github/ISSUE_TEMPLATE/config.yml) routing other questions to GitHub Discussions, and a [`PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md). The four issue templates correspond to the principal classes of report Verlux receives — crashes, false positives, missed detections, and feature proposals — and surface the metadata each class needs (input string, expected versus actual behaviour, language pack, severity tier) without requiring reporters to discover those fields themselves.

### Changed

- **Readme rewritten with expanded coverage of detection capabilities, comparison data, and benchmark methodology.** The substring-collision-resistance and Unicode-obfuscation-resistance sections were elaborated, the comparison against the three most-downloaded npm profanity packages (`bad-words`, `obscenity`, `@2toad/profanity`) was added, and the data-sources / attribution and notice-and-intended-use sections were restructured to match the language now codified in [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`SECURITY.md`](./SECURITY.md).

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
