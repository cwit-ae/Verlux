# Third-Party Notices

Portions of the English profanity dictionary in this package are derived from
the following upstream projects. Each project's original license text is
included in this directory.

| Source | Upstream | License | Used For |
|---|---|---|---|
| `obscenity` | [jo3-l/obscenity](https://github.com/jo3-l/obscenity) | MIT | English word list (originally sourced by obscenity from [cuss](https://github.com/words/cuss) © Titus Wormer) |
| `leo-profanity` | [jojoee/leo-profanity](https://github.com/jojoee/leo-profanity) | MIT | English word list (derivative of the Shutterstock LDNOOBW list) |
| `google-profanity-words` | [coffee-and-fun/google-profanity-words](https://github.com/coffee-and-fun/google-profanity-words) | MIT | English word list |
| `LDNOOBW` | [LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) | CC-BY-4.0 | English word list (direct, attribution-required; see [`LDNOOBW.md`](./LDNOOBW.md)) |

## How this package uses the upstream data

- Only the raw word lists were consumed.
- Every imported term has been re-classified under this project's
  `severity` / `category` / `allowPartialMatch` schema.
- Many entries were dropped or tightened to preserve the project's
  zero-false-positive invariant.
- LDNOOBW terms that overlap with everyday vocabulary (e.g.
  `anal`, `butt`, `sex`, `intercourse`, `hardcore`) were deliberately
  excluded to preserve substring-collision safety.
- New LDNOOBW-sourced entries live in the `LDNOOBW-SOURCED ADDITIONS`
  block in [`src/dictionaries/en.ts`](../src/dictionaries/en.ts);
  non-LDNOOBW extensions live in the `EXTENDED DICTIONARY (v1.1)` block
  in the same file.

## Upstream licenses

- [`obscenity-LICENSE`](./obscenity-LICENSE)
- [`leo-profanity-LICENSE`](./leo-profanity-LICENSE)
- [`google-profanity-words-LICENSE`](./google-profanity-words-LICENSE)
- [`LDNOOBW-LICENSE`](./LDNOOBW-LICENSE) (CC-BY-4.0 — attribution
  required; see [`LDNOOBW.md`](./LDNOOBW.md) for the full notice)
