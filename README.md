# changelog-forge

Generate a release changelog from conventional commits, grouped by impact, with breaking
changes surfaced first.

## What

`changelog-forge` reads a git repository's commit history, parses each commit as a
[Conventional Commit](https://www.conventionalcommits.org/), and produces a changelog ordered
by *impact* rather than by commit order: breaking changes first (with their migration notes),
then features, then fixes, then performance improvements, reverts, and deprecations. Noise
types (`chore`, `ci`, `style`, `test`) are excluded by default. It also infers the semver bump
the release implies, and can write Markdown (Keep a Changelog shape) or JSON.

## Why

Most changelog generators emit a flat list of commit subjects in commit order. That buries the
one breaking change under forty `chore:` entries, which defeats the actual purpose of a
changelog: letting a reader decide, in a few seconds, whether it's safe to upgrade. A changelog
that doesn't lead with what breaks isn't doing its job.

## Features

- **Full conventional-commit parsing**: `type(scope)!: subject`, body, and git-trailer-style
  footers, including folded (multi-line) footer values.
- **Both breaking-change notations**: the `!` marker after the type/scope, and a
  `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer — tools that only support one of these
  routinely miss real breaking changes.
- **Impact ordering**: breaking changes surfaced first with migration notes, then features,
  fixes, performance, reverts, deprecations. `chore`/`ci`/`style`/`test` are excluded by
  default but can be included.
- **Scope grouping** within each section, with configurable scope aliases (e.g. `fe`/`ui` both
  folding into `frontend`).
- **Version inference** from the commits themselves: any breaking change → major, else any
  `feat` → minor, else any `fix`/`perf` → patch. The recommended bump is printed in the output.
- **Range selection**: explicit `--from`/`--to` refs, or auto-detection of the previous release
  by **semver ordering**, not tag creation date (which is wrong when tags are pushed out of
  order — e.g. a `1.2.0` hotfix tag pushed after a `1.3.0-rc.1` prerelease tag).
- **Revert cancellation**: a commit and its revert, when both are in the range, cancel out
  instead of both appearing.
- **Link generation** for commit SHAs, PR numbers (`(#123)` in the subject), and issue
  references, from a configurable repository URL.
- **Contributor list**, deduplicated by email, with bots excluded by configurable pattern.
- **Markdown or JSON output**, and `--prepend` to insert a new release into an existing
  `CHANGELOG.md` above previous releases without disturbing them.

## Architecture

Git access sits behind a `GitReader` interface (`src/git/GitReader.ts`) with two
implementations:

- `RealGitReader` — shells out to the system `git` binary against a real repository.
- `FixtureGitReader` — an in-memory reader for tests, given commits and tags directly.

Everything downstream of `GitReader` — conventional-commit parsing (`src/parser.ts`), revert
cancellation (`src/revert.ts`), version inference (`src/version.ts`), impact-ordered grouping
(`src/grouping.ts`), contributor collection (`src/contributors.ts`), link generation
(`src/links.ts`), and rendering (`src/render/`) — is pure logic over plain data, so it is fully
unit-testable with no repository at all. `src/engine.ts` wires it together;
`src/cli.ts` is the command-line entry point.

```
src/
  types.ts             shared data shapes
  semver.ts            semver parsing/comparison/bumping
  parser.ts            conventional-commit parsing
  revert.ts            revert/original commit cancellation
  version.ts           previous-tag detection + bump inference
  grouping.ts          impact ordering + scope grouping
  contributors.ts       contributor list (dedup + bot exclusion)
  links.ts             commit/PR/issue link generation
  config.ts            config loading/merging/defaults
  engine.ts            orchestrates the above into ChangelogData
  prepend.ts           insert a release into an existing CHANGELOG.md
  render/
    markdown.ts        Keep a Changelog-shaped Markdown
    json.ts            JSON output
  git/
    GitReader.ts        interface
    RealGitReader.ts     real `git` implementation
    FixtureGitReader.ts  in-memory implementation for tests
  cli.ts               argument parsing + command-line entry point
```

## Installation

```bash
npm install --save-dev changelog-forge
```

Requires Node.js `^20 || ^22 || >=24` and the `git` binary on `PATH`.

## Usage

Run from inside a git repository (or point `--cwd` at one):

```bash
npx changelog-forge --repo-url https://github.com/owner/repo
```

This auto-detects the previous release tag (by semver, not creation date), reads commits from
there to `HEAD`, and prints a Markdown release section to stdout.

```bash
# Explicit range
npx changelog-forge --from v1.2.0 --to v1.3.0 --repo-url https://github.com/owner/repo

# JSON output
npx changelog-forge --format json --out changelog.json

# Insert into (or create) CHANGELOG.md, above previous releases
npx changelog-forge --repo-url https://github.com/owner/repo --prepend

# Include normally-excluded types
npx changelog-forge --include chore,ci

# Override the inferred version
npx changelog-forge --version 2.0.0
```

### CLI options

| Flag | Description |
| --- | --- |
| `--from <ref>` | Start of the commit range (exclusive). Defaults to the auto-detected previous tag. |
| `--to <ref>` | End of the commit range (inclusive). Defaults to `HEAD`. |
| `--repo-url <url>` | Repository URL used to build commit/PR/issue links. |
| `--config <path>` | Path to a JSON config file. |
| `--prepend [path]` | Insert into an existing changelog file above previous releases. Defaults to `CHANGELOG.md`. |
| `--format <markdown\|json>` | Output format. Defaults to `markdown`. |
| `--out <path>` | Write output to a file instead of stdout. |
| `--cwd <path>` | Git repository directory. Defaults to the current directory. |
| `--include <types>` | Comma-separated types to include even if normally excluded. |
| `--version <semver>` | Explicit release version, overriding inference. |
| `-h`, `--help` | Show help. |

## Configuration

Pass `--config path/to/config.json`:

```json
{
  "repoUrl": "https://github.com/owner/repo",
  "scopeAliases": {
    "fe": "frontend",
    "ui": "frontend"
  },
  "botPatterns": ["\\[bot\\]$", "^dependabot", "^renovate"],
  "excludeTypes": ["chore", "ci", "style", "test"],
  "includeTypes": []
}
```

- `scopeAliases` — maps a raw commit scope to a canonical display scope; commits sharing a
  canonical scope are grouped together.
- `botPatterns` — case-insensitive regular expressions tested against contributor name and
  email; matches are excluded from the contributor list.
- `excludeTypes` — commit types dropped from the output entirely (breaking changes are never
  dropped, even if their type is excluded).
- `includeTypes` — types to keep even if listed in `excludeTypes` (also settable per-run with
  `--include`).

## Examples

Given these commits since the last tag:

```
fix(auth): handle expired session (#12)
feat(api)!: change response envelope

BREAKING CHANGE: responses are now wrapped in a `data` key.
perf(db): add index on user id
```

`changelog-forge` produces:

```markdown
## [2.0.0] - 2026-08-30

_Recommended bump: **major**._

### BREAKING CHANGES

#### api

- change response envelope ([`05cc3de`](https://github.com/owner/repo/commit/05cc3de...))

  responses are now wrapped in a `data` key.

### Performance Improvements

#### db

- add index on user id ([`66bbede`](https://github.com/owner/repo/commit/66bbede...))

### Contributors

- Demo User
```

Note that the `fix(auth)` commit above the tag boundary and the breaking `feat` commit are
ordered by impact, not commit date — breaking changes always lead.

## Output format

**Markdown** follows the [Keep a Changelog](https://keepachangelog.com/) shape: an `## [version]
- date` heading, `### Section` headings in impact order, and `#### scope` subheadings within a
section when commits carry a scope. Unscoped commits in a section are listed first.

**JSON** mirrors the same structure programmatically — see `src/render/json.ts` for the exact
shape (`version`, `bump`, `date`, `from`, `to`, `sections[].groups[].entries[]`, `contributors`,
`skipped`).

## Testing

```bash
npm test          # vitest run — 139 tests
npx tsc --noEmit   # strict type-check
npx eslint .        # zero errors, zero warnings
```

Parsing, grouping, version inference, revert cancellation, and rendering are all tested against
the in-memory `FixtureGitReader` — no repository required. `test/git/RealGitReader.test.ts` and
`test/cli.test.ts` create a real temporary repository with `git init` and exercise the actual
`git` binary end to end.

## Security

- `changelog-forge` only *reads* from the repository it's pointed at (`git log`, `git
  for-each-ref`, `git rev-parse`); it never writes to git history or pushes anything.
- The only file it writes is the output file you specify via `--out` or `--prepend`.
- Config files are parsed as plain JSON (`JSON.parse`), not evaluated as code.
- Report a security issue by opening a private security advisory on the repository rather than
  a public issue.

## License

MIT — see [LICENSE](./LICENSE).
