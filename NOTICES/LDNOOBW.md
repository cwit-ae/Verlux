# LDNOOBW — Attribution Notice

The English, French, and German dictionaries in this package
incorporate terms sourced from the **List of Dirty, Naughty, Obscene
and Otherwise Bad Words (LDNOOBW)** project, originally published by
Shutterstock and maintained at
[`LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words`](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words).

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

- The raw `en`, `fr`, and `de` word lists were consulted.
- Every consumed term was **independently re-classified** under this
  project's `severity` / `category` / `allowPartialMatch` schema.
- Terms with known substring-collision risk were **deliberately
  excluded** to preserve the package's zero-substring-collision
  invariant enforced by
  [`tests/false-positives.test.ts`](../tests/false-positives.test.ts),
  [`tests/french.test.ts`](../tests/french.test.ts), and
  [`tests/german.test.ts`](../tests/german.test.ts):
    - **English**: `anal`, `anus`, `butt`, `sex`, `nude`, `intercourse`,
      `hardcore`.
    - **French**: `baiser` (also "to kiss"), `péter` (also "to break"),
      `tapette` (also "flyswatter"), `ménage à trois`, `folle` (also
      "crazy fem."), `déconner`, `gueule` alone, `meuf` (neutral slang).
    - **German**: `nackt` (neutral "naked"), `orgasmus`/`penis`/`porno`
      (clinical or mainstream loanwords), `rosette` (decorative shape),
      `schiesser` (ambiguous with `Schießer` = shooter), `mufti`
      (Islamic religious title), `nippel`.
- Context-dependent English phrases (`how to kill`, `how to murder`,
  `white power`, `barely legal`) were excluded to avoid flagging
  legitimate technical, literary, and legal content.
- LDNOOBW-sourced additions are marked in-source:
    - `LDNOOBW-SOURCED ADDITIONS` block in
      [`src/dictionaries/en.ts`](../src/dictionaries/en.ts).
    - The entirety of
      [`src/dictionaries/fr.ts`](../src/dictionaries/fr.ts) is
      LDNOOBW-sourced (curated + supplemented with common French
      phrases not present in the upstream list).
    - The entirety of
      [`src/dictionaries/de.ts`](../src/dictionaries/de.ts) is
      LDNOOBW-sourced (curated + supplemented with common German
      phrases not present in the upstream list).

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
