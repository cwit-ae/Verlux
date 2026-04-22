# LDNOOBW — Attribution Notice

A subset of the English dictionary in this package incorporates terms
sourced from the **List of Dirty, Naughty, Obscene and Otherwise Bad
Words (LDNOOBW)** project, originally published by Shutterstock and
maintained at [`LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words`](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words).

## License

LDNOOBW is distributed under the
**Creative Commons Attribution 4.0 International License (CC-BY-4.0)**.
The full, verbatim license text is redistributed alongside this notice
at [`./LDNOOBW-LICENSE`](./LDNOOBW-LICENSE), as required by §3(a) of
the license.

A human-readable summary is available at
<https://creativecommons.org/licenses/by/4.0/>.

## Attribution

> Portions of the English dictionary contained in this package are
> derived from *List of Dirty, Naughty, Obscene and Otherwise Bad Words*
> by Shutterstock, Inc. and subsequent LDNOOBW contributors, licensed
> under CC-BY-4.0. No endorsement is claimed or implied.

## Scope of reuse

- Only the raw `en` word list was consulted.
- Every consumed term was **independently re-classified** under this
  project's `severity` / `category` / `allowPartialMatch` schema.
- Terms with known substring-collision risk (for example
  `anal`, `anus`, `butt`, `sex`, `nude`, `intercourse`, `hardcore`)
  were **deliberately excluded** to preserve the 0 / 126 substring-
  collision invariant enforced by
  [`tests/false-positives.test.ts`](../tests/false-positives.test.ts).
- Context-dependent phrases (`how to kill`, `how to murder`,
  `white power`, `barely legal`) were excluded to avoid flagging
  legitimate technical, literary, and legal content.
- The only terms incorporated from LDNOOBW that do not already appear
  in upstream MIT-licensed sources are listed in the
  `LDNOOBW-SOURCED ADDITIONS` block of
  [`src/dictionaries/en.ts`](../src/dictionaries/en.ts).

## Modifications

- Re-classification into structured schema (severity / category /
  partial-match gating / normalized forms / aliases).
- Filtering for substring-collision safety.
- Addition of inflectional aliases (for example plural and gerund
  forms) not present in the upstream flat list.
- Per CC-BY-4.0 §3(a)(1)(B), these modifications are declared here.

## No warranty

LDNOOBW and this package are both distributed "AS IS" without warranty
of any kind. See the full license text and the top-level
[`LICENSE`](../LICENSE) for details.
