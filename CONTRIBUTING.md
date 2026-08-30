# Contributing to changelog-forge

Thanks for considering a contribution.

## Development setup

```bash
npm install
npm run build
npm test
```

## Before opening a pull request

Run the full gate locally — CI runs the same three commands and requires all of them to pass
cleanly:

```bash
npm test
npx tsc --noEmit
npx eslint .
```

`eslint .` must produce zero errors and zero warnings.

## Commit messages

This project dogfoods itself: commits should follow the
[Conventional Commits](https://www.conventionalcommits.org/) format so that
`changelog-forge` can generate its own changelog from this repository's history.

```
type(scope)!: subject

optional body

BREAKING CHANGE: migration note, if applicable
```

Common types: `feat`, `fix`, `perf`, `revert`, `deprecate`, `docs`, `refactor`, `build`,
`chore`, `ci`, `style`, `test`.

## Tests

New behavior needs test coverage in `test/`. Tests are organized to mirror `src/`:

- Pure logic (`parser.ts`, `grouping.ts`, `version.ts`, `revert.ts`, `contributors.ts`,
  `prepend.ts`, `config.ts`, rendering) is unit-tested with the `FixtureGitReader` or plain data
  — no real repository needed.
- `test/git/RealGitReader.test.ts` exercises the real git-backed reader against a temporary
  repository created with `git init`.

Never weaken or delete a test to make a change pass. If a test is wrong, explain why in the PR.

## Reporting issues

Please include the conventional-commit message(s) that produced unexpected output — that's
almost always enough to reproduce a parsing or grouping bug.
