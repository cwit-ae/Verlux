# Contributing to Verlux

Thank you for considering a contribution to Verlux. This project is an offline, dictionary-based profanity and abusive-language detection library, and we welcome help in every part of it — dictionary curation, language coverage, detection-pipeline improvements, documentation, benchmarks, and bug reports.

This document explains how to report problems, propose changes, and get a pull request merged.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Reporting Issues](#reporting-issues)
- [Proposing a Change](#proposing-a-change)
- [Development Setup](#development-setup)
- [Tests and Benchmarks](#tests-and-benchmarks)
- [Dictionary Contributions](#dictionary-contributions)
- [Pull Request Checklist](#pull-request-checklist)
- [Security Disclosures](#security-disclosures)
- [License](#license)

---

## Code of Conduct

Participation in this project is governed by the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). In short: be respectful, be patient, and assume good faith. Verlux exists to fight abuse — please do not bring abusive behaviour into the issue tracker, pull requests, or discussion threads. Reporting channels and enforcement guidelines are documented in [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

---

## Ways to Contribute

You do not need to be a TypeScript expert to help. Useful contributions include:

- **Reporting a missed detection** — a sentence the package should have flagged and did not.
- **Reporting a false positive** — a sentence the package flagged that it should not have.
- **Proposing dictionary entries** for a supported language, together with category, severity, and (where relevant) common obfuscated variants.
- **Proposing a new language pack** (see [Dictionary Contributions](#dictionary-contributions)).
- **Improving the detection pipeline** — tokenizer, normalizer, fuzzy matcher, transliteration tables, phrase index, deduplication.
- **Improving documentation, benchmarks, or examples.**
- **Filing reproductions for performance regressions.**

If you are not sure whether something is in scope, open a discussion-style issue first and ask.

---

## Reporting Issues

Please use the [issue tracker](https://github.com/cwit-ae/verlux/issues) and pick the template that best matches what you are reporting:

- **Bug report** — for crashes, incorrect detections, performance regressions, type-definition issues.
- **False positive** — for benign inputs being flagged as profane.
- **Missed detection** — for profane inputs not being flagged.
- **Feature request** — for new capabilities, languages, or APIs.

A good issue includes:

1. The exact input string (escaped if it contains unusual characters).
2. The result you observed (`detect()` / `score()` / `isClean()` output).
3. The result you expected, and why.
4. The Verlux version (`npm ls verlux`) and Node.js version (`node -v`).
5. The configuration you passed, if any (`fuzzyThreshold`, `minSeverity`, `whitelist`, etc.).

For dictionary issues, please be specific about which language pack the term belongs to, and — if you are reporting a slur — please include a short explanation of why you believe the term is or is not abusive in the relevant linguistic or cultural context. We re-classify every dictionary contribution under our own `severity`, `category`, and `allowPartialMatch` schema, but reviewer context speeds the process considerably.

---

## Proposing a Change

For anything beyond a one-line fix, please open an issue first to confirm direction before opening a pull request. Larger changes — new language packs, pipeline-stage rewrites, public-API additions — should start as a short proposal so we can agree on scope, semantics, and test coverage before implementation begins.

For small, self-contained changes (typo fixes, additional regression tests, narrow bug fixes), a pull request directly is fine.

---

## Development Setup

Verlux requires Node.js 18 or later.

```bash
git clone https://github.com/cwit-ae/Verlux.git
cd Verlux
npm install
npm run build
npm test
```

The repository contains:

- [`src/`](./src) — TypeScript source, including the detection pipeline and per-language dictionaries.
- [`tests/`](./tests) — Jest test suites, including the false-positive regression corpus.
- [`scripts/`](./scripts) — benchmark and maintenance scripts.
- [`dist/`](./dist) — compiled output (generated; do not edit by hand).

Useful scripts:

| Command            | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `npm run build`    | Compile both ESM and CJS output and emit `.d.ts` declarations.     |
| `npm test`         | Run the full Jest test suite.                                      |
| `npm run test:watch` | Re-run tests on file changes during development.                 |
| `npm run lint`     | Type-check the project without emitting output.                    |

---

## Tests and Benchmarks

Every change should keep the test suite green:

```bash
npm test
```

The suite includes (among other things):

- An end-to-end coverage benchmark mirroring the HateCheck taxonomy.
- A 468-input substring-collision regression corpus ([`tests/false-positives.test.ts`](./tests/false-positives.test.ts)).
- Per-language tokenizer, normalizer, and dictionary tests.

If your change touches the dictionary or the detection pipeline, please:

1. Add at least one regression test that fails without your change and passes with it.
2. Re-run the benchmark (`node scripts/benchmark.mjs` after `npm run build`) and report the precision/recall numbers in the pull-request description if they shift.

---

## Dictionary Contributions

Dictionary changes are held to a higher review bar than code changes, because a bad entry can affect every downstream user.

When proposing a new entry, please include:

- The **canonical form** of the term (the spelling people most commonly use).
- The **language code** it belongs to (`en`, `hi-latn`, `es`, `fr`, `de`).
- A proposed **`severity`** (`low` / `medium` / `high`) and **`category`** (`slur` / `sexual` / `insult` / `hate` / `threat` / `drug` / `other`).
- Whether **`allowPartialMatch`** should be `true` or `false`, with a one-line justification (short or high-collision roots typically need `false`).
- Common **obfuscated, transliterated, or accent-stripped variants** that should also match.
- A **safelist note** if the term has known benign collisions, so they can be added to the per-language false-positive corpus.

Dictionary entries derived from third-party sources must be **MIT-commercial-compatible**. Sources licensed under non-commercial, share-alike, or research-only terms cannot be incorporated, even though Verlux itself is freely distributed on npm.

---

## Pull Request Checklist

Before requesting review, please confirm:

- [ ] The change is scoped to a single concern.
- [ ] `npm test` passes locally.
- [ ] `npm run lint` passes locally.
- [ ] New or changed behaviour is covered by at least one test.
- [ ] If the dictionary changed, the false-positive corpus was re-run and is still green.
- [ ] If the public API changed, the README and inline TypeScript types were updated together.
- [ ] If the change is user-visible, a one-line entry was added to the changelog (or the pull-request description states why one is not needed).
- [ ] The pull-request description explains *why* the change matters, not only *what* it does.

---

## Security Disclosures

If you believe you have found a security issue — for example, an input that causes the detection pipeline to crash, hang, or consume unbounded memory — please **do not** open a public issue. Instead, contact the maintainers privately via the email listed on the npm page for `verlux`, or open a GitHub Security Advisory at <https://github.com/cwit-ae/Verlux/security/advisories>.

We aim to acknowledge security reports within five business days.

---

## License

By contributing to Verlux, you agree that your contribution will be licensed under the [MIT License](./LICENSE) under which the project is distributed.
