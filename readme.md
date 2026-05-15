<p align="center">
  <a href="https://www.npmjs.com/package/verlux"><img src="https://img.shields.io/npm/v/verlux?style=flat-square&color=1a1a2e" alt="npm version" /></a>
  <a href="https://github.com/cwit-ae/Verlux/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/cwit-ae/Verlux/ci.yml?branch=main&style=flat-square&color=1a1a2e&label=CI" alt="CI status" /></a>
  <a href="https://github.com/cwit-ae/Verlux/actions/workflows/codeql.yml"><img src="https://img.shields.io/github/actions/workflow/status/cwit-ae/Verlux/codeql.yml?branch=main&style=flat-square&color=1a1a2e&label=CodeQL" alt="CodeQL status" /></a>
  <a href="https://www.npmjs.com/package/verlux"><img src="https://img.shields.io/npm/dm/verlux?style=flat-square&color=1a1a2e" alt="npm downloads" /></a>
  <a href="https://bundlephobia.com/package/verlux"><img src="https://img.shields.io/bundlephobia/minzip/verlux?style=flat-square&color=1a1a2e&label=min%2Bgzip" alt="bundle size" /></a>
  <img src="https://img.shields.io/badge/zero-dependencies-1a1a2e?style=flat-square" alt="zero dependencies" />
  <img src="https://img.shields.io/npm/l/verlux?style=flat-square&color=1a1a2e" alt="license" />
</p>

<h1 align="center">Verlux</h1>

<p align="center">
  <strong>Profanity and abusive-language detection across English, Hinglish, Spanish, French, and German — every loaded language scanned simultaneously in a single pass, with no per-call language hint required, including inputs that mix multiple languages within one sentence.</strong>
</p>

<p align="center">
  Fuzzy matching, transliteration, and phrase detection. Designed for content moderation, trust and safety workflows, and customer communication platforms.<br/>
  Zero runtime dependencies. Fully offline. Resilient to common obfuscation techniques.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#comparison-with-other-npm-packages">Comparison</a> ·
  <a href="#api-reference">API</a> ·
  <a href="#results--testing-our-dataset">Benchmarks</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

<p align="center">
  <strong>Why Verlux</strong>
</p>

- **Five languages, one call.** English, Hinglish, Spanish, French, and German are scanned in the same pass with no per-call language hint required — including inputs that mix multiple languages in a single sentence.
- **Severity, category, and toxicity score per match.** Every detection carries a `severity` (`low` / `medium` / `high`) and a `category` (`slur`, `sexual`, `insult`, `hate`, `threat`, `drug`, `other`), and `score()` returns a normalized toxicity score with a complete category breakdown — suitable for moderation queues and call-centre dashboards.
- **Cross-script Unicode obfuscation resistance.** Cyrillic and Greek look-alike codepoints (`fuсk` with a Cyrillic `с`), fullwidth forms (`ｆｕｃｋ`), mathematical-alphanumeric variants (`𝐟𝐮𝐜𝐤`), ligatures, zero-width / invisible characters, and combining-mark overlays (`f̸u̸c̸k̸`) are all folded to canonical ASCII before matching — and result positions are mapped back to the original input so highlighters, censors, and downstream tooling keep working unchanged.
- **Zero dependencies, fully offline, ~150 µs per sentence.** A 2 MB memory footprint and a 3 ms cold start. Substring-collision-resistant against a 468-input regression corpus.

```ts
import { verlux } from "verlux";

verlux.detect("<English + Spanish + Hinglish abuse in one sentence>");
// → three matches, three languages, one call

verlux.score("<abusive input>").toxicity; // 0.42
verlux.isClean("hello world");            // true
verlux.censor("<abusive input>");         // "**** you"
```

---

## Table of Contents

- [Overview](#overview)
- [Comparison with Other npm Packages](#comparison-with-other-npm-packages)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Detection Pipeline](#detection-pipeline)
- [Results — Testing Our Dataset](#results--testing-our-dataset)
- [Dictionary Coverage](#dictionary-coverage)
- [Supported Languages](#supported-languages)
- [Use Cases](#use-cases)
- [Contributing](#contributing)
- [Data Sources and Attribution](#data-sources-and-attribution)
- [Notice and Intended Use](#notice-and-intended-use)
- [Limitations](#limitations)
- [Legal Notices](#legal-notices)
- [License](#license)

---

## Overview

Verlux scans every loaded language pack in a single pass, surfacing matches across English, Hinglish, Spanish, French, and German — including inputs that mix several languages within one sentence — with no per-call language hint required. The `languages` configuration option exists only for the inverse case: applications that wish to *narrow* detection to a subset of loaded packs (for example, an English-only forum that wants to ignore Spanish profanity). The default is to detect everything that has been loaded.

Beyond multilingual coverage, dictionary-based profanity filters typically fail in two directions. Overly aggressive filters flag innocuous text such as _Scunthorpe_, _assistant_, or _classic_. Naïve filters miss common obfuscations such as punctuation-separated, leet-substituted, or character-repeated variants of profane terms. Verlux is designed to address both failure modes within a single, deterministic, offline pipeline.

| Challenge                                                                   | How Verlux addresses it                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Leetspeak substitutions (digits or symbols replacing letters)               | Character-class normalizer that decodes standard leet substitutions prior to lookup     |
| Separated characters (terms broken up by punctuation, brackets, or slashes) | Separator stripping across punctuation, brackets, slashes, and pipes                    |
| Character repetition (letters repeated for emphasis)                        | Aggressive repetition collapse with generated spelling variants                         |
| Cross-script confusables (Cyrillic/Greek codepoints visually impersonating Latin, e.g. `fuсk` with U+0441) | Curated confusable-fold table that maps the full Cyrillic and Greek look-alike sets to their Latin equivalents prior to tokenization |
| Unicode compatibility forms (fullwidth `Ｆｕｃｋ`, mathematical alphanumeric `𝐟𝐮𝐜𝐤`, ligatures `ﬁ`) | NFKC compatibility decomposition applied per codepoint, with surrogate-pair-safe index mapping back to the original input |
| Invisible / zero-width Unicode (zero-width space, joiners, BOM, soft hyphen, etc.) | Single-pass strip across a curated invisible-character range covering the common abuse vectors |
| Combining-mark overlays (base letter plus strikethrough or overlay codepoint, e.g. `f̸u̸c̸k̸`) | Orphan combining marks are dropped before tokenization so the base letters fuse into a single token, while Devanagari, Arabic, and Hebrew combining marks (which carry meaning) are preserved |
| The _Scunthorpe_ problem (substring false positives)                        | Per-entry `allowPartialMatch` flag combined with an internal safelist of innocent terms; reduces substring false positives but does not eliminate them in every case |
| Hindi and Urdu written in Latin script (Hinglish)                           | Devanagari-to-Latin transliteration and phonetic variant generation                     |
| English contractions and Romance-language elisions                          | Apostrophe-aware tokenizer that splits forms such as `he'll`, `won't`, and `bitch's` so that the meaningful word — not its apostrophe-stripped fold — is matched against the dictionary |
| Spanish diacritics (accented and accent-stripped forms of the same term)    | Accent-stripping normalizer paired with dual-form dictionary entries                    |
| Multi-word phrase detection                                                 | N-gram windowing that captures common multi-word abusive expressions                    |
| Mixed-language input                                                        | Automatic detection across every loaded dictionary, with no language hint required      |
| Business-safe vocabulary                                                    | Includes safelists and phrase rules for common benign business expressions; uncovered idioms can be added at integration time via `whitelist` |

---

## Comparison with Other npm Packages

The table below compares Verlux against the three most-downloaded npm profanity-detection packages — `bad-words`, `obscenity`, and `@2toad/profanity` — based on each package's README, npm metadata, and source repository as of 2026-04-30. A cell reads ✅ where the capability is documented and shipped out of the box, ⚠️ where it is partial or requires per-call configuration, ❌ where the package's public API or return types confirm the feature is absent, and "not documented" where upstream materials do not address the capability either way.

| Capability                                                         | **Verlux**                  | `bad-words`                              | `obscenity`                                  | `@2toad/profanity`                                            |
| ------------------------------------------------------------------ | --------------------------- | ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Approximate weekly downloads (npm)                                 | —                           | 205k                                     | 131k                                         | 125k                                                          |
| Languages shipped out of the box                                   | 5 (en, hi-latn, es, fr, de) | 1 (en)                                   | 1 (en)                                       | 12 (native script)                                            |
| Detects multiple languages in one call without enumerating them    | ✅                          | n/a (single language)                    | n/a (single language)                        | ❌ caller must pass an explicit language array on every call |
| Romanized Hindi (Hinglish) wordlist shipped                        | ✅                          | ❌                                       | ❌                                           | ❌ (Devanagari list only)                                    |
| Devanagari → Latin transliteration in the detection pipeline       | ✅                          | ❌                                       | ❌                                           | ❌                                                            |
| Obfuscation handling (leet, separator stripping, repetition collapse) | ✅                       | ⚠️ basic symbol substitution only        | ✅                                           | not documented                                                |
| Cross-script Unicode confusable folding (Cyrillic / Greek look-alikes, fullwidth, mathematical alphanumeric, ligatures, invisibles, combining-mark overlays) | ✅ | not documented                           | not documented                               | not documented                                                |
| Levenshtein-based fuzzy matching                                   | ✅                          | ❌                                       | ❌ (uses regex variant patterns instead)     | ❌                                                            |
| Multi-word phrase detection documented                             | ✅                          | not documented                           | ✅                                           | not documented                                                |
| Returns severity tier per match (low / medium / high)              | ✅                          | ❌                                       | ❌                                           | ❌                                                            |
| Returns category per match (slur, sexual, threat, …)               | ✅                          | ❌                                       | ❌                                           | ❌                                                            |
| Returns toxicity score with category breakdown                     | ✅                          | ❌                                       | ❌                                           | ❌                                                            |
| Runtime dependencies                                               | 0                           | 1                                        | 0                                            | 0                                                             |
| First-class TypeScript types                                       | ✅                          | ✅                                       | ✅                                           | ✅                                                            |

`@2toad/profanity` ships substantially more native-script wordlists than any other package in this set (12 versus Verlux's 5) and is the only other package here that supports more than one language out of the box; its matches do not carry severity or category metadata, however, and the caller must enumerate the desired languages on every call. `obscenity` provides comparable obfuscation handling for English and is widely used for English-only deployments; its `MatchPayload` return type does not include severity or category. `bad-words` is English-only and oriented toward simple censoring rather than analytical moderation. Relative to this set, Verlux's distinguishing properties are: automatic multi-language scanning without a per-call hint, romanized-Hindi (Hinglish) coverage with Devanagari transliteration, severity- and category-tagged matches with a derived toxicity score, and Levenshtein-based fuzzy matching.

> Comparisons are derived from each package's published documentation, npm metadata, and source repository as of the date noted above. ❌ reflects features whose absence is confirmed by the public API or return types; "not documented" reflects capabilities that upstream materials do not address either way and that we have not independently verified to be present or absent. Consumers are encouraged to re-verify against the latest upstream releases before relying on these figures.

---

## Installation

```bash
npm install verlux
```

Verlux requires Node.js 18 or later and is published as both CommonJS and ES Module builds with bundled TypeScript declarations.

---

## Quick Start

> For readability, code examples throughout this document use placeholder strings such as `<abusive input>`, `<obfuscated slur>`, or `<multilingual abuse>` in place of actual offensive vocabulary. In production, the corresponding inputs would be real user-submitted text.

```ts
import { verlux } from "verlux";

// Mixed-language input — every loaded language scanned in one call, no hint required
const results = verlux.detect("<English + Spanish + Hinglish abuse>");
// [
//   { matched: '<term>', language: 'en',      ... },
//   { matched: '<term>', language: 'es',      ... },
//   { matched: '<term>', language: 'hi-latn', ... }
// ]

// Single-language input works the same way — no configuration required
verlux.detect("<obfuscated abusive input>");
// [
//   { matched: '<canonical term>', severity: 'high',   category: 'sexual', ... },
//   { matched: '<canonical term>', severity: 'medium', category: 'insult', ... }
// ]

// Spanish with or without diacritics, including multi-word phrases
verlux.detect("<Spanish phrase + accent-stripped term>");
// [
//   { matched: '<phrase>', matchType: 'phrase',     language: 'es', ... },
//   { matched: '<term>',   matchType: 'normalized', language: 'es', ... }
// ]

// Check whether a message is clean
verlux.isClean("hello world"); // true
verlux.isClean("<abusive input>"); // false

// Censor detected terms
verlux.censor("<clean text + abusive term + clean text>");
// "<clean text> **** <clean text>"

// Obtain a toxicity score with a full category breakdown
const score = verlux.score("<several abusive terms>");
// { toxicity: 0.32, categories: { insult: 2 }, severities: { high: 1, medium: 1, low: 0 }, ... }
```

---

## API Reference

### `verlux.detect(text, config?)`

Returns an array of `DetectionResult` objects describing every abusive word or phrase found in the input.

```ts
interface DetectionResult {
  original: string; // Original text as it appeared
  matched: string; // Dictionary word it matched against
  language: string; // 'en' | 'hi-latn' | 'es'
  severity: "low" | "medium" | "high";
  category: "slur" | "sexual" | "insult" | "hate" | "threat" | "drug" | "other";
  position: [number, number]; // Start and end indices in the input
  matchType: "exact" | "normalized" | "alias" | "fuzzy" | "phrase";
  confidence: number; // 0–1
}
```

### `verlux.score(text, config?)`

Returns a toxicity score with a complete breakdown. Suitable for call-centre dashboards and moderation queues.

```ts
const result = verlux.score("<abusive input>");

result.toxicity; // 0.42 on a 0–1 scale
result.categories; // { insult: 2, sexual: 1, threat: 1 }
result.severities; // { high: 2, medium: 0, low: 2 }
result.repetitionSpam; // false
result.uniqueMatches; // 4
result.totalMatches; // 4
result.detections; // Full DetectionResult[]
```

Scoring is weighted by severity (`high = 1.0`, `medium = 0.6`, `low = 0.3`), normalised against token count, and multiplied by 1.5 when repetition spam is detected (capped at 1.0).

### `verlux.isClean(text, config?)`

Returns `true` when no profanity is detected.

### `verlux.censor(text, config?)`

Replaces detected profanity with a configurable mask character.

```ts
verlux.censor("<abusive input>", { mask: "#" }); // "#### you"
```

### `verlux.configure(config)`

Creates a new Verlux instance with custom defaults.

```ts
const strict = verlux.configure({
  fuzzyThreshold: 0.95,
  minSeverity: "high",
  languages: ["en"],
});
```

### `verlux.addWords(entries)` and `verlux.addPhrases(entries)`

Extend the dictionary at runtime with validated entries.

```ts
verlux.addWords([
  {
    word: "<custom term>",
    normalized: ["<leet variant>"],
    language: "en",
    severity: "high",
    category: "slur",
    allowPartialMatch: false,
    aliases: ["<abbreviation>"],
  },
]);
```

---

## Configuration

```ts
interface VerluxConfig {
  languages?: string[]; // Restrict detection to specific languages (default: all loaded)
  fuzzyMatch?: boolean; // Enable fuzzy matching (default: true)
  fuzzyThreshold?: number; // 0–1 similarity threshold (default: 0.85)
  phraseDetection?: boolean; // Enable phrase detection (default: true)
  transliteration?: boolean; // Enable transliteration (default: true)
  minSeverity?: Severity; // Minimum severity to report (default: 'low')
  whitelist?: string[]; // Words to never flag (case-insensitive)
}
```

Whitelists are useful for reconciling proper nouns that collide with dictionary entries. For example, a personal name that happens to share its spelling with a dictionary term can be exempted from flagging on a per-application basis:

```ts
verlux.detect("<sentence containing a proper noun>", {
  whitelist: ["<proper noun>"],
});
// [] — no results
```

---

## Detection Pipeline

Every input passes through a tiered matching system, ordered from fastest to most computationally expensive. All tiers query a single unified index built from every loaded language pack, so detection runs across English, Hinglish, Spanish, French, and German simultaneously without any per-call language hint.

```
Input Text
    |
    v
[0] Unicode Fold      ── per-codepoint pass that maps Cyrillic and Greek confusables
    |                    to Latin, applies NFKC compatibility decomposition (fullwidth,
    |                    mathematical alphanumeric, ligatures), strips invisible / zero-width
    |                    codepoints, and drops orphan combining marks (e.g. strikethrough
    |                    overlays). An index map is recorded so result positions map back
    |                    to the original input. Pure-ASCII input takes a fast path and skips
    |                    the per-codepoint loop entirely.
    |
    v
[1] Tokenize          ── produces word tokens with character positions; English
                         contractions (`he'll`, `won't`, `bitch's`) and Romance
                         elisions (`d'enculé`, `qu'il`) are split at the apostrophe
                         so that match positions point at the meaningful word
    |
    v
[2] Exact Match       ── O(1) hash lookup across all languages; catches the large majority of abuse
    |  miss
    v
[3] Normalized Match  ── applies leet decoding, accent stripping (for example, á becomes a,
    |                    ñ becomes n), repetition collapse, and separator removal
    |  miss
    v
[4] Transliteration   ── maps Devanagari script into Latin and generates Hinglish spelling variants
    |  miss
    v
[5] Partial Match     ── Aho–Corasick scan in O(n + z), where n is input length and z is match count
    |  miss             (scan cost is independent of dictionary size)
    v
[6] Fuzzy Match       ── Levenshtein distance with length-based pre-filtering
    |
    v
[7] Phrase Detection  ── N-gram windowing over 2- to 5-word spans
    |
    v
[8] Deduplicate       ── removes overlapping matches, retaining the highest-confidence result
```

---

## Results — Testing Our Dataset

The figures below were produced by evaluating **our dataset** against an internally curated test corpus. The corpus is reproduced in full at [`scripts/benchmark.mjs`](./scripts/benchmark.mjs) and can be re-executed at any time with `node scripts/benchmark.mjs` (after `npm run build`).

### Coverage Evaluation

We evaluated our dataset against a 90-sample test corpus structured to mirror the [HateCheck](https://github.com/paul-rottger/hatecheck-data) functional-test taxonomy (Röttger et al., 2021) — derogation, dehumanisation, and threat — extended with Hinglish, Spanish, obfuscation, and multilingual-in-one-utterance test cases that HateCheck does not cover. The corpus comprises 48 hateful and 42 clean sentences spread across English, Hinglish, and Spanish.

| Metric          | Value |
| --------------- | ----- |
| Precision       | 97.9% |
| Recall          | 97.9% |
| F1 Score        | 97.9% |
| Accuracy        | 97.8% |
| False Positives | 1     |

<details>
<summary>Confusion matrix</summary>

|                  | Predicted Hateful | Predicted Clean |
| ---------------- | ----------------- | --------------- |
| Actually Hateful | 47 (TP)           | 1 (FN)          |
| Actually Clean   | 1 (FP)            | 41 (TN)         |

**Detected by our dataset:** explicit slurs in three languages, identity-targeted pejoratives, dehumanising vocabulary, explicit threats of violence, self-harm incitement, leet- and separator-obfuscated profanity, Hinglish abuse, Spanish and Latin American slang with and without diacritics, and multilingual abuse mixed within a single utterance.

**The single false negative** is a passive-voice threat constructed entirely from a non-canonical inflection of a dictionary entry — illustrating the inherent limit of any dictionary-based system when the surface form drifts beyond enumerated variants.

**The single false positive** is a benign business idiom that happens to contain a verb listed in the threat category. Such collisions are an unavoidable trade-off for a dictionary that takes incitement vocabulary seriously; they can be neutralised in production by adding the offending term to a per-application `whitelist`.

**Not detected (by design):** context-dependent constructions that rely on no explicit profanity — that is, sentences whose hateful meaning is carried entirely by benign vocabulary arranged in a pejorative way. Detecting such constructions requires sentiment-aware machine-learning models and is out of scope for this package.

</details>

### Substring-Collision Resistance

In addition to the end-to-end benchmark above, our dataset is regression-tested against a dedicated corpus of 485 innocent inputs whose surface forms contain a profane substring — the classical _Scunthorpe_ problem. The corpus is reproduced in [`tests/false-positives.test.ts`](./tests/false-positives.test.ts) and runs as part of the standard Jest suite. Specific vocabulary is not reproduced here.

| Category                                                                 | Items tested | False positives |
| ------------------------------------------------------------------------ | ------------ | --------------- |
| Common words containing a short profane substring                        | 37           | 0               |
| Compound words colliding with a sexual term                              | 9            | 0               |
| Latinate words colliding with a short profane substring                  | 9            | 0               |
| Everyday words colliding with a mild expletive substring                 | 4            | 0               |
| Words sharing a substring with an anatomical term                        | 19           | 0               |
| Place names containing a profane substring (classical _Scunthorpe_ case) | 18           | 0               |
| Proper names that overlap with dictionary entries                        | 7            | 0               |
| Medical and educational terminology                                      | 6            | 0               |
| Fuzzy-match near-collisions (one edit away from a dictionary entry)      | 365          | 0               |
| **Total**                                                                | **485**      | **0**           |

> **Scope.** This corpus measures resistance to _substring-overlap_ false positives only — that is, inputs that incidentally contain profane characters within an unrelated word. It does **not** measure resistance to _exact-word_ collisions, where a dictionary entry appears verbatim inside an idiomatic, technical, or otherwise benign sentence (for example, the verb _"murder"_ inside the business idiom _"let us murder the competition"_, which is the single false positive recorded in the coverage benchmark above). Such exact-word collisions are an inherent property of any dictionary that takes incitement vocabulary seriously and are intended to be neutralised at integration time via the per-instance [`whitelist`](#configuration) configuration option.

### Unicode Obfuscation Resistance

A separate test suite in [`tests/unicode-obfuscation.test.ts`](./tests/unicode-obfuscation.test.ts) exercises the cross-script and Unicode-compatibility folds against the canonical attack classes. Specific vocabulary is not reproduced in this table; the suite runs as part of the standard `npm test` invocation.

| Class                                                                               | Folded as                                                            | Detection                                                                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Cyrillic look-alikes (U+0430–U+04FF subset, e.g. `fuсk`, `аss`, `bitсh`)            | Per-codepoint confusable map → Latin                                 | ✅ matches and reports the canonical Latin term                                      |
| Greek look-alikes (U+0370–U+03CF subset, e.g. `cοck`, `pοrn`)                       | Per-codepoint confusable map → Latin                                 | ✅ matches and reports the canonical Latin term                                      |
| Fullwidth Latin (U+FF21–U+FF5A, e.g. `ｆｕｃｋ`, `Ａｓｓ`)                              | NFKC compatibility decomposition                                     | ✅ matches; original positions preserved                                             |
| Mathematical alphanumeric (U+1D400–U+1D7FF, e.g. `𝐟𝐮𝐜𝐤`, `𝑓𝑢𝑐𝑘`, `𝖿𝗎𝖼𝗄`)            | NFKC, with surrogate-pair-safe index mapping                         | ✅ matches; UTF-16 surrogate pairs round-trip to original positions                  |
| Ligatures (e.g. `ﬁ` → `fi`)                                                          | NFKC compatibility decomposition                                     | ✅ matches; index map records the one-to-many expansion                              |
| Invisible / zero-width (zero-width space, joiners, BOM, soft hyphen, …)             | Stripped before tokenization                                          | ✅ matches; original characters discarded from the folded view                       |
| Combining-mark overlays (base letter + U+0338 strikethrough, stacked diacritics)    | Orphan combining marks dropped before tokenization                   | ✅ matches; base letters fuse into a single token                                    |
| Legitimate non-Latin text (Russian, Greek, mixed diacritic-bearing words)           | Folded to Latin where applicable; not surfaced unless it forms an entry | ✅ does **not** flag; clean inputs round-trip unchanged                              |
| Precomposed Latin diacritics (Spanish `cabrón`, French `connard`, German `arschloch`) | Preserved by the normalizer (single codepoints, not base + mark)    | ✅ matches against accent-aware dictionary entries; benign diacritics untouched      |

After every fold, result `position` indices are mapped back through a `[folded → original]` index map so `original`, `position`, and `verlux.censor()` continue to operate on the input as the user typed it — including across surrogate pairs and one-to-many NFKC expansions. Pure-ASCII input takes a fast path that skips the per-codepoint loop entirely.

### Performance

Measured on commodity developer hardware with the full multi-language index loaded.

| Metric                        | Value                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| Average latency per sentence  | Approximately 150 µs (under one millisecond)                        |
| Throughput                    | Approximately 6,500 or more operations per second                   |
| Phrase-match complexity       | O(W) per call via a pre-normalized phrase index built once at startup, where W is the number of n-gram windows |
| Partial-match scan complexity | O(n + z) via Aho–Corasick automaton, independent of dictionary size |
| Cold start                    | Approximately 3 ms                                                  |
| Memory footprint              | Approximately 2 MB                                                  |
| Runtime dependencies          | 0                                                                   |
| Test suite                    | 776 tests passing                                                   |

> **Disclaimer.** All figures above are reported on the datasets, hardware, and Node.js versions available at the time of publication. They are provided for informational purposes only and do not constitute a guarantee of performance or accuracy for any specific production workload. Consumers are strongly encouraged to validate Verlux against their own representative data before relying on it in critical systems.

---

## Dictionary Coverage

**Total:** 5 languages — 746 words and 127 phrases across English, Hinglish, Spanish, French, and German. The tables below describe the dictionary at the category level only. Specific vocabulary is deliberately omitted from this document; the authoritative wordlists reside under [`src/dictionaries/`](./src/dictionaries).

### English — 523 words, 75 phrases

| Category                         | Entries | Scope                                                                                                         |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| Racial and ethnic slurs          | 45+     | Pejorative terms targeting Black, Asian, Hispanic, Arab, Jewish, White, Native, Romani, and Aboriginal groups |
| Homophobic and transphobic terms | 12      | Pejoratives targeting LGBTQ+ individuals                                                                      |
| Ableist terms                    | 6       | Pejoratives targeting people with disabilities                                                                |
| Sexual and anatomical terms      | 55+     | Commonly used sexual and anatomical profanity, incorporated in part from the Google Profanity Words list      |
| General insults                  | 30+     | Everyday profanity and insults in common English usage                                                        |
| Sexist and misogynistic terms    | 8       | Pejoratives targeting women                                                                                   |
| Call-centre abuse vocabulary     | 21      | Terms frequently encountered in customer-support complaint data                                               |
| Dehumanising vocabulary          | 12      | Language that frames people as vermin, refuse, or non-human                                                   |
| Hate and ideology terms          | 10      | Extremist-ideology references and related symbols                                                             |
| Threats and violence             | 13      | Explicit verbs of physical harm                                                                               |
| Online harassment vocabulary     | 10      | Imageboard- and forum-derived pejoratives                                                                     |
| Self-harm references             | 5       | Direct references and common abbreviations, with complementary phrase detection                               |
| Explicit-content terms           | 15+     | Vocabulary used to describe pornographic or non-consensual content                                            |
| Drug references                  | 4       | Commonly misused substance names                                                                              |
| Phrases                          | 71      | Multi-word expressions including violent threats, hate-ideology slogans, and incitements to self-harm         |

### Hinglish (Hindi–Latin script) — 32 words, 13 phrases

Covers the most frequently used Hindi and Urdu invective written in Roman script, with extensive coverage of spelling variants. The category includes familial insults, pejoratives directed at women, generic invective, and anatomical crudities, each entered together with its common romanisation alternatives. Specific vocabulary is not reproduced here.

### Spanish — 80 words, 17 phrases

Covers peninsular (Spain) Spanish and major Latin American variants, including Mexico, Argentina, Uruguay, Colombia, and Chile. Handles all relevant diacritics (`ñ`, `á`, `é`, `í`, `ó`, `ú`, `ü`, `ç`), so accented and accent-stripped inputs both match. The category includes anatomical crudities, blasphemy, familial insults, homophobic pejoratives, and region-specific slang, together with multi-word phrases of the same types. Specific vocabulary is not reproduced here.

### French — 54 words, 13 phrases

Covers metropolitan French invective and Franco-Arabic (banlieue) slang. Accented forms (`é`, `è`, `ê`, `à`, `ç`, `ï`, `ô`) and their accent-stripped counterparts both match after normalisation. Grammatical elisions (such as apostrophe-prefixed contractions) are handled at tokenisation so that the core word is surfaced regardless of the elision prefix. Short high-collision roots are gated with `allowPartialMatch: false` and backed by a French-specific false-positive safelist that covers common benign substring overlaps. The category includes standard profanity, anatomical crudities, sexual slang, homophobic and racial slurs, and familial insults, together with multi-word phrases of the same types. Specific vocabulary is not reproduced here.

### German — 57 words, 9 phrases

Covers standard High German invective. Handles all umlauts (`ä`, `ö`, `ü`, `ß`) in three input forms simultaneously — canonical, accent-stripped, and ASCII digraph — and every umlaut-bearing entry lists all three. Clinical and mainstream-loanword terms are deliberately excluded, and ambiguous noun-pair collisions (where a profane form sits one edit away from an unrelated benign noun) are preserved by the normalizer and exercised in regression tests. The category includes racial and xenophobic slurs (with coverage of terms targeting Turkish, Arabic, and Black communities), homophobic pejoratives, sexual and scatological invective, and common imperative insult phrases. Specific vocabulary is not reproduced here.

---

## Supported Languages

| Code      | Language                          | Status  |
| --------- | --------------------------------- | ------- |
| `en`      | English                           | Shipped |
| `hi-latn` | Hinglish (Hindi in Latin script)  | Shipped |
| `es`      | Spanish (Spain and Latin America) | Shipped |
| `fr`      | French                            | Shipped |
| `de`      | German                            | Shipped |
| `zh`      | Chinese (Mandarin)                | Planned |
| `ur-latn` | Urdu (Roman script)               | Planned |
| `pa-latn` | Punjabi (Roman script)            | Planned |
| `bn`      | Bengali                           | Planned |
| `ta`      | Tamil                             | Planned |

---

## Use Cases

### Call-centre and customer support

Detect agent- or customer-directed abuse in live chat and email. Severity levels enable tiered escalation:

```ts
const result = verlux.score(customerMessage);

if (result.severities.high > 0) {
  // Immediate escalation to supervisor
} else if (result.toxicity > 0.3) {
  // Flag for human review
} else if (result.repetitionSpam) {
  // Spam warning
}
```

### Chat and forum moderation

```ts
app.post("/message", (req, res) => {
  if (!verlux.isClean(req.body.text)) {
    return res
      .status(400)
      .json({ error: "Message contains inappropriate language" });
  }
  // proceed
});
```

### Multilingual support channels

No per-message language tagging is required. A single `detect()` call covers English, Spanish, Hinglish, French, and German in the same input:

```ts
verlux.detect("<mixed English + Spanish + Hinglish abuse>");
// → three matches, three languages, one call
```

### Content filtering with censoring

```ts
const safe = verlux.censor(userComment);
// Display the censored version to end users
```

---

## Contributing

Verlux is open to contributions of every shape — bug reports, false-positive and missed-detection submissions, dictionary additions, new language packs, pipeline improvements, and documentation. Community involvement is what keeps the dictionary current and the false-positive corpus honest.

| If you want to …                                                  | Start here                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Report a bug** (crash, wrong type, performance regression)      | Open a [Bug report](https://github.com/cwit-ae/Verlux/issues/new?template=bug_report.yml).              |
| **Report a false positive** (benign input flagged as abusive)     | Open a [False positive](https://github.com/cwit-ae/Verlux/issues/new?template=false_positive.yml).      |
| **Report a missed detection** (abusive input that was not caught) | Open a [Missed detection](https://github.com/cwit-ae/Verlux/issues/new?template=missed_detection.yml).  |
| **Propose a new feature, language pack, or API change**           | Open a [Feature request](https://github.com/cwit-ae/Verlux/issues/new?template=feature_request.yml).    |
| **Ask a question or open a discussion**                           | Use [GitHub Discussions](https://github.com/cwit-ae/Verlux/discussions).                                |
| **Disclose a security issue privately**                           | File a [Security advisory](https://github.com/cwit-ae/Verlux/security/advisories/new).                  |
| **Submit a pull request**                                         | Read the [Contributing guide](./CONTRIBUTING.md), then open a PR. The repository ships a PR template.   |

Dictionary contributions are reviewed against the same `severity`, `category`, and `allowPartialMatch` schema described in [Configuration](#configuration), and every accepted entry is exercised against the [substring-collision corpus](#substring-collision-resistance) before being merged. Sources must be MIT-commercial-compatible — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full submission guidelines.

---

## Data Sources and Attribution

Dictionary entries are informed by vocabulary published in peer-reviewed hate-speech research datasets and permissively licensed open-source profanity libraries. Every imported term has been independently re-classified under Verlux's `severity`, `category`, and `allowPartialMatch` schema, and every imported term has been evaluated against the internal false-positive corpus prior to inclusion.

- **HateCheck** — Röttger et al., 2021. Functional tests for hate speech detection models. ([GitHub](https://github.com/paul-rottger/hatecheck-data))
- **Slur Corpus** — Kurrek et al., 2020. Taxonomy for online slur usage. ([GitHub](https://github.com/networkdynamics/slur-corpus))
- **obscenity** — jo3-l, MIT-licensed. English profanity dataset, originally derived from [cuss](https://github.com/words/cuss) © Titus Wormer. ([GitHub](https://github.com/jo3-l/obscenity))
- **leo-profanity** — jojoee, MIT-licensed. Derivative of the Shutterstock _List of Dirty, Naughty, Obscene and Otherwise Bad Words_. ([GitHub](https://github.com/jojoee/leo-profanity))
- **LDNOOBW** — direct source, CC-BY-4.0. The canonical _List of Dirty, Naughty, Obscene and Otherwise Bad Words_ originally published by Shutterstock. A curated subset of terms not otherwise covered is incorporated directly; attribution, license, and scope of reuse are recorded in [`NOTICES/LDNOOBW.md`](./NOTICES/LDNOOBW.md). ([GitHub](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words))
- **Google Profanity Words** — Coffee & Fun, MIT-licensed. 962-word English profanity list. ([GitHub](https://github.com/coffee-and-fun/google-profanity-words))
- Catalog: [hatespeechdata.com](https://hatespeechdata.com/)

The full upstream licence texts, together with notices describing the scope of reuse, are redistributed under [`NOTICES/`](./NOTICES). If you believe any attribution is missing or incorrect, please open an issue so we can remedy it promptly.

---

## Notice and Intended Use

Verlux ships with a curated lexicon of profane, offensive, hateful, and sexually explicit terms in multiple languages. These terms are included **solely to enable automated detection and moderation** of such language in user-generated content.

The presence of any term in this package:

- does **not** reflect the views, opinions, or endorsements of the authors, maintainers, contributors, Clear Wave Information Technologies (CWIT), or any affiliated entity;
- does **not** constitute advocacy for, or glorification of, any group, ideology, slur, or act referenced by the listed terms;
- is **not** intended to be surfaced, displayed, or read by end users.

**Intended uses** include (but are not limited to): content moderation pipelines, abuse and harassment detection, chat filtering, call-centre quality assurance, trust-and-safety tooling, academic research, and regulatory compliance workflows.

**Prohibited uses** include any application that targets, harasses, surveils, or discriminates against individuals or protected groups; any use that violates applicable laws (including anti-discrimination, privacy, and data-protection law); and any attempt to reverse-engineer the dictionary to generate, propagate, or amplify abusive content.

By installing or using this package, you acknowledge that you have read this notice and agree to use Verlux in a lawful and responsible manner.

---

## Limitations

Verlux is a **dictionary-based** detection system. It is designed to catch explicit abuse reliably and deterministically, and it has inherent limitations that users must account for when designing downstream moderation workflows:

- **Sentiment-based hate is out of scope.** Statements whose pejorative meaning is carried entirely by benign vocabulary will not be flagged.
- **Sarcasm is out of scope.** Utterances whose hostile intent depends on tone or context rather than explicit vocabulary require contextual understanding that dictionary matching cannot provide.
- **Coded language and evolving slang require ongoing dictionary maintenance.** Dog-whistles and newly coined terms will not be detected until they are added to the dictionary.
- **The system is context-blind.** Benign idioms that superficially overlap with violent or abusive vocabulary are handled by a combination of safelists and phrase rules, but no dictionary system can reason about speaker intent.

For full-spectrum content moderation, we recommend combining Verlux (fast, offline, deterministic, with strong substring-collision resistance and a small, well-characterised exact-word collision surface that is mitigable via `whitelist`) with a machine-learning-based sentiment or classification layer.

---

## Legal Notices

### Disclaimer of Warranties

VERLUX IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, COMPLETENESS, OR UNINTERRUPTED AVAILABILITY. THE AUTHORS AND COPYRIGHT HOLDERS MAKE NO REPRESENTATION THAT THE DICTIONARY, DETECTION PIPELINE, OR ANY BENCHMARK FIGURE REPORTED IN THIS DOCUMENT IS SUITABLE FOR ANY PARTICULAR USE CASE, JURISDICTION, OR REGULATORY REGIME.

### Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE AUTHORS, COPYRIGHT HOLDERS, CONTRIBUTORS, OR AFFILIATED ENTITIES BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY — WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE — ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE, INCLUDING BUT NOT LIMITED TO DAMAGES ARISING FROM FAILED DETECTIONS, FALSE POSITIVES, CONTENT MODERATION OUTCOMES, OR RELIANCE ON DICTIONARY ENTRIES OR BENCHMARK FIGURES.

### Compliance and Acceptable Use

Users are solely responsible for ensuring that their use of Verlux complies with all applicable laws and regulations in their jurisdiction — including, without limitation, data-protection, privacy, anti-discrimination, consumer-protection, and platform-liability law. Verlux is a tool and not a substitute for human judgement; any automated moderation decision that materially affects a user should be reviewable by a human operator where law or policy so requires.

### Content Notice

This repository necessarily contains vocabulary that is profane, hateful, sexually explicit, or otherwise offensive. Contributors and reviewers should be aware of this when browsing source files under [`src/dictionaries/`](./src/dictionaries). Every such term is included exclusively for the purpose of enabling automated detection and does not reflect the views of the authors, maintainers, contributors, Clear Wave Information Technologies (CWIT), or any affiliated entity.

### Trademarks

All product names, logos, and brands referenced in this document (including _HateCheck_, _Google_, _Shutterstock_, and any third-party library names) are the property of their respective owners. Use of these names does not imply endorsement by or affiliation with those owners.

### Reporting Concerns

If you believe any dictionary entry is miscategorised, missing attribution, or otherwise problematic, please open an issue at the project's [issue tracker](https://github.com/cwit-ae/verlux/issues). Security concerns should be reported privately to the maintainers rather than filed as public issues.

---

## License

Verlux is released under the [MIT License](./LICENSE). Dictionary data derived from upstream MIT-licensed projects is redistributed under the terms of those upstream licences, the full texts of which are included in [`NOTICES/`](./NOTICES).

---

<p align="center">
  <sub>Built with precision. Designed for responsible moderation. Continuously regression-tested against an internal substring-collision corpus.</sub>
</p>
