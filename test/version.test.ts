import { describe, expect, it } from 'vitest';
import { findPreviousTag, inferBump } from '../src/version.js';
import { parseSemVer } from '../src/semver.js';
import { parseCommit } from '../src/parser.js';
import { makeCommit, makeTag } from './helpers.js';

function commit(message: string) {
  const result = parseCommit(makeCommit({ message }));
  if (!result.ok) throw new Error(`expected a valid commit: ${message}`);
  return result.commit;
}

describe('inferBump', () => {
  it('infers major when any commit is breaking', () => {
    const commits = [commit('fix: small fix'), commit('feat!: big change')];
    expect(inferBump(commits)).toBe('major');
  });

  it('infers minor when there is a feat but no breaking change', () => {
    const commits = [commit('fix: small fix'), commit('feat: new thing')];
    expect(inferBump(commits)).toBe('minor');
  });

  it('infers patch when there are only fixes or perf commits', () => {
    expect(inferBump([commit('fix: a'), commit('fix: b')])).toBe('patch');
    expect(inferBump([commit('perf: faster loop')])).toBe('patch');
  });

  it('infers none when there is nothing release-worthy', () => {
    expect(inferBump([commit('docs: typo'), commit('chore: bump deps')])).toBe('none');
  });

  it('infers none for an empty commit list', () => {
    expect(inferBump([])).toBe('none');
  });

  it('a single breaking commit outranks many feats and fixes', () => {
    const commits = [
      commit('feat: a'),
      commit('feat: b'),
      commit('fix: c'),
      commit('chore!: drop legacy build'),
    ];
    expect(inferBump(commits)).toBe('major');
  });
});

describe('findPreviousTag', () => {
  it('picks the highest semver tag, not the most recently created one', () => {
    // Tags pushed out of order: 1.2.0 was created (pushed) AFTER 1.3.0-rc.1, but 1.3.0-rc.1
    // has higher semver precedence... except prereleases sort below releases, so the highest
    // *release* here is 1.2.0. Use a clearer disagreement: an old 2.0.0 tag re-pushed last.
    const tags = [
      makeTag({ name: '1.0.0', sha: 'a', createdAt: '2026-01-01T00:00:00Z', semver: parseSemVer('1.0.0') }),
      makeTag({ name: '2.0.0', sha: 'b', createdAt: '2026-01-02T00:00:00Z', semver: parseSemVer('2.0.0') }),
      // 1.5.0 is created LAST (most recent date) but has lower semver precedence than 2.0.0.
      makeTag({ name: '1.5.0', sha: 'c', createdAt: '2026-06-01T00:00:00Z', semver: parseSemVer('1.5.0') }),
    ];
    const previous = findPreviousTag(tags);
    // Creation-date ordering would pick 1.5.0 (newest date); semver ordering must pick 2.0.0.
    expect(previous?.name).toBe('2.0.0');
  });

  it('ignores non-semver tags', () => {
    const tags = [
      makeTag({ name: 'nightly', sha: 'a' }),
      makeTag({ name: '1.4.0', sha: 'b', semver: parseSemVer('1.4.0') }),
    ];
    expect(findPreviousTag(tags)?.name).toBe('1.4.0');
  });

  it('returns undefined when there are no semver tags', () => {
    expect(findPreviousTag([makeTag({ name: 'nightly', sha: 'a' })])).toBeUndefined();
    expect(findPreviousTag([])).toBeUndefined();
  });

  it('prefers a release over a higher-numbered prerelease at the same version', () => {
    const tags = [
      makeTag({ name: '1.0.0-rc.5', sha: 'a', semver: parseSemVer('1.0.0-rc.5') }),
      makeTag({ name: '1.0.0', sha: 'b', semver: parseSemVer('1.0.0') }),
    ];
    expect(findPreviousTag(tags)?.name).toBe('1.0.0');
  });
});
