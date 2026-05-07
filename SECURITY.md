# Security Policy

## Supported Versions

Verlux is on a single active major version. We provide security updates for the latest minor release on the `1.x` line.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

If you are running an older minor version, please upgrade to the latest `1.x` release before opening a security report — the issue may already be resolved.

## Reporting a Vulnerability

**Please do not file public issues for security vulnerabilities.** Public issues are indexed by search engines and notify every repository watcher, which can give an attacker time to exploit the issue before users have updated.

Use one of the following private channels instead:

1. **Preferred — GitHub Security Advisories:** open a draft advisory at <https://github.com/cwit-ae/Verlux/security/advisories/new>. Only the maintainers see the report. GitHub provides a private fork for coordinated patch development.
2. Email the maintainers privately. Refer to the maintainer contact listed on the [npm page for `verlux`](https://www.npmjs.com/package/verlux).

When you submit a report, please include — as much as is practical:

- A clear description of the issue and the impact you believe it has.
- Steps to reproduce, including the exact input string, configuration, and Verlux + Node.js versions.
- A minimal proof-of-concept (a few lines of TypeScript or JavaScript).
- Whether you have disclosed the issue elsewhere, and if so, where.

## Scope

The following are in scope and welcomed as security reports:

- Inputs that cause `verlux.detect`, `verlux.score`, `verlux.isClean`, or `verlux.censor` to crash, throw an uncaught error, or hang.
- Inputs that cause unbounded CPU or memory consumption (regex catastrophic backtracking, allocation amplification, or pathological fuzzy / Aho–Corasick paths).
- Bypasses of the detection pipeline that allow a known dictionary entry to evade detection through Unicode obfuscation, leet decoding, separator stripping, or any other normalization stage that the public README documents as resistant to that obfuscation class.
- Any vulnerability in the published package's build output (`dist/`) that does not exist in the source.

The following are **out of scope** and should be filed as ordinary GitHub issues using the [missed-detection](.github/ISSUE_TEMPLATE/missed_detection.yml) or [false-positive](.github/ISSUE_TEMPLATE/false_positive.yml) templates instead:

- Coverage gaps in the dictionary (a slur or pejorative we do not yet ship).
- False positives on benign inputs.
- Sentiment-based or sarcasm-based hate-speech misses, which are explicitly outside the scope of a dictionary system (see the [Limitations](./readme.md#limitations) section of the README).
- Issues in transitive dependencies of consumers (Verlux itself ships zero runtime dependencies).

## Disclosure Process

Once a report is submitted:

1. We aim to **acknowledge receipt within five business days**.
2. We work with the reporter to confirm the issue and agree on a remediation plan.
3. A fix is developed and tested in a private branch. For fixes that require dictionary or pipeline changes, we run the full Jest suite and the substring-collision regression corpus before release.
4. A patched version is published to npm. The release notes credit the reporter (with their permission) and link to the advisory.
5. The advisory is published publicly once users have had a reasonable window to upgrade.

We do not currently operate a paid bug-bounty programme. Reporters are credited in the release notes and the published advisory unless they prefer to remain anonymous.

## Coordinated Disclosure Expectations

We ask that reporters give us a reasonable opportunity to remediate before any public disclosure — typically 90 days from acknowledgement, shorter for clearly low-risk issues, longer if the fix requires substantial pipeline rework. If you intend to disclose publicly, please tell us in advance so the release and advisory can be coordinated with your timeline.

Thank you for helping keep Verlux and its users safe.
