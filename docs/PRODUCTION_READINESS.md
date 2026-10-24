# Production readiness — changelog-forge

Audit of the `audit/production-readiness` branch. This document records evidence; it does not
award a production-ready label.

## Scope and architecture

CLI + library that reads git history (`src/git/RealGitReader.ts`, `execFile` of the system `git`),
parses Conventional Commits (`parser.ts`), groups by impact with breaking changes first
(`grouping.ts`), infers the semver bump (`version.ts`) and renders Markdown/JSON, optionally
prepending to `CHANGELOG.md` (`prepend.ts`).

## Platforms and prerequisites

Node.js `^20 || ^22 || >=24` and `git` on `PATH`. Verified on macOS (Apple Silicon) with Node
24.19.0 (full gate) and the test suite on Node 20 and 22. CI (default branch) runs on ubuntu only.

## Clean-clone setup (README "Installation")

`git clone`, `npm ci && npm run build`, `npm link` (throwaway npm prefix): all 0. In the clone,
`changelog-forge --repo-url ...` rendered a release section, `--format json --out` wrote the file,
`--to "--output=<file>"` was refused (exit 1, no file written); typecheck/lint 0; 144 tests passed;
tree clean.

Baseline README said `npm install --save-dev changelog-forge`; that npm name belongs to a
**different author's project**.

## Commands executed (CI-equivalent, local)

| Command | Baseline (main @ d6deeb2) | Audit branch |
|---|---|---|
| `npm ci` | 0 | 0 |
| `npx tsc --noEmit` / `npx eslint .` | 0 / 0 | 0 / 0 |
| `npm test` | 0 — 139 passed, 0 failed, 0 skipped | 0 — 144 passed, 0 failed, 0 skipped (Node 24, 20, 22); 2 tests skip on Windows only |
| `npm run build` | 0 | 0 |
| CI inline script (run locally) | — | 0 |
| `npm audit --omit=dev` | 0 (no runtime deps) | 0 |
| `npm audit` (dev) | 5 (3 high, 2 moderate) | 0 (`npm audit fix`, lockfile only) |

## Bugs fixed (regression tests: `test/git/injection.test.ts`; all 5 fail on baseline)

| Bug | Impact | Fix |
|---|---|---|
| `--from`/`--to` passed raw to `git log` / `git rev-parse` | `--to "--output=<file>"` made git write an arbitrary file (reproduced) — input could become any git option | reject revisions starting with `-` or containing whitespace/control chars; `--end-of-options` before revisions; `rev-parse --verify` |
| Repository config honoured by `git log` | `log.showSignature=true` + `gpg.program` in a repo's config ran that program when the tool read history (reproduced with a signed commit) | `-c log.showSignature=false` |
| Entry check without realpath | the npm bin (`npm link`, `.bin`) exited 0 doing nothing | `isEntryPoint` |
| README install via npm | installed a stranger's package | install from source |

## Security review

| Area | Finding | Severity | Status |
|---|---|---|---|
| Command/argument injection into git | see above | High | Fixed |
| Program execution via repo config | gpg.program through log.showSignature | Medium | Fixed for that path; git itself remains a trust boundary for other config (documented) |
| Shell | `execFile`, no shell | Info | Verified |
| Config parsing | `JSON.parse` only | Info | Reviewed |
| File writes | only `--out` / `--prepend` targets | Info | Reviewed |
| Workflow permissions | none declared | Low | `contents: read` added |
| Secrets in tree/history | 3 commits, no hits | Info | none |

## Acceptance checklist

| Item | Expected | Test | Result |
|---|---|---|---|
| Conventional Commit parsing (scopes, `!`, footers, reverts) | per spec | `test/parser.test.ts` | pass |
| Grouping, breaking first | as README | `test/grouping.test.ts`, `test/render/*` | pass |
| Semver bump inference | major/minor/patch | `test/version.test.ts` | pass |
| Real git integration | real temp repos | `test/git/RealGitReader.test.ts`, `test/cli.test.ts` | pass |
| No arbitrary git options from input | refused, nothing written | `test/git/injection.test.ts`, clean clone | pass |
| Prepend keeps previous releases | as README | `test/prepend.test.ts`, `test/cli.test.ts` | pass |

## CI status

Default branch (`main` @ d6deeb2): last run `success`. Audit branch: pending until pushed.

## Limitations

Runs the system `git` in the target repository: other repository-level git configuration is still
honoured by git (only the signature path is disabled), so point it at repositories you trust.
Not published to npm.

## Tested commit

`43a1d5660103c2db5ab3d5bf300fd56ab7458d61` (clean clone), 2026-10-22.

## Classification proposal

**Partially Verified** — verified locally on Node 20/22/24 and from a clean clone; audit-branch CI
not yet run.
