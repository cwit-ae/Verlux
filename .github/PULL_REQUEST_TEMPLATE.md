<!--
Thank you for contributing to Verlux. Please fill in the sections below.
For larger changes, please open an issue first so we can agree on direction.
-->

## Summary

<!-- One or two sentences describing what this pull request does and why. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Dictionary entry — addition, removal, or re-classification
- [ ] New language pack
- [ ] Documentation
- [ ] Performance / refactor
- [ ] Other:

## Motivation

<!-- The "why". What problem does this solve? Link to any related issue. -->

Closes #

## Testing

- [ ] `npm test` passes locally
- [ ] `npm run lint` passes locally
- [ ] New behaviour is covered by at least one test
- [ ] If the dictionary changed, the false-positive regression corpus is still green
- [ ] If detection logic changed, `node scripts/benchmark.mjs` was re-run and the precision / recall numbers are reported below

## Benchmark impact

<!-- Optional. Required for pipeline or dictionary changes. -->

| Metric    | Before | After |
| --------- | ------ | ----- |
| Precision |        |       |
| Recall    |        |       |
| F1        |        |       |

## Checklist

- [ ] My change is scoped to a single concern
- [ ] Public API changes are reflected in the README and TypeScript types
- [ ] User-visible changes have a one-line changelog entry (or a note explaining why one is not needed)
- [ ] I have read the [Contributing guide](../CONTRIBUTING.md)
