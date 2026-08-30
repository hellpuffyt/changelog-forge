import { describe, expect, it } from 'vitest';
import { generateChangelog } from '../src/engine.js';
import { FixtureGitReader } from '../src/git/FixtureGitReader.js';
import { defaultConfig } from '../src/config.js';
import { parseSemVer } from '../src/semver.js';
import { makeCommit, makeTag } from './helpers.js';

describe('generateChangelog', () => {
  it('auto-detects the range from the previous tag and infers the next version', async () => {
    const reader = new FixtureGitReader({
      commits: [
        makeCommit({ sha: 'c3', shortSha: 'c3', message: 'feat: add export' }),
        makeCommit({ sha: 'c2', shortSha: 'c2', message: 'fix: crash' }),
        makeCommit({ sha: 'c1', shortSha: 'c1', message: 'chore: init' }),
      ],
      tags: [makeTag({ name: 'v1.0.0', sha: 'c1', semver: parseSemVer('1.0.0') })],
    });

    const { data } = await generateChangelog(reader, defaultConfig());
    expect(data.from).toBe('c1');
    expect(data.to).toBe('c3');
    expect(data.bump).toBe('minor');
    expect(data.version).toBe('1.1.0');
  });

  it('respects explicit --from/--to overrides', async () => {
    const reader = new FixtureGitReader({
      commits: [
        makeCommit({ sha: 'c3', shortSha: 'c3', message: 'feat: c' }),
        makeCommit({ sha: 'c2', shortSha: 'c2', message: 'feat: b' }),
        makeCommit({ sha: 'c1', shortSha: 'c1', message: 'feat: a' }),
      ],
    });
    const { parsedCommits } = await generateChangelog(reader, defaultConfig(), { from: 'c2', to: 'c3' });
    expect(parsedCommits.map((c) => c.subject)).toEqual(['c']);
  });

  it('uses an explicit --version, skipping inference', async () => {
    const reader = new FixtureGitReader({
      commits: [makeCommit({ sha: 'c1', shortSha: 'c1', message: 'feat: x' })],
    });
    const { data } = await generateChangelog(reader, defaultConfig(), { version: '9.9.9' });
    expect(data.version).toBe('9.9.9');
  });

  it('reads the whole history when there is no previous tag', async () => {
    const reader = new FixtureGitReader({
      commits: [
        makeCommit({ sha: 'c2', shortSha: 'c2', message: 'feat: b' }),
        makeCommit({ sha: 'c1', shortSha: 'c1', message: 'feat: a' }),
      ],
    });
    const { data } = await generateChangelog(reader, defaultConfig());
    expect(data.from).toBeUndefined();
    expect(data.sections.flatMap((s) => s.groups.flatMap((g) => g.entries))).toHaveLength(2);
  });

  it('collects skipped commits without throwing', async () => {
    const reader = new FixtureGitReader({
      commits: [
        makeCommit({ sha: 'c2', shortSha: 'c2', message: 'not a conventional commit' }),
        makeCommit({ sha: 'c1', shortSha: 'c1', message: 'feat: a' }),
      ],
    });
    const { data } = await generateChangelog(reader, defaultConfig());
    expect(data.skipped).toHaveLength(1);
  });

  it('cancels a commit against its own revert end to end', async () => {
    const reader = new FixtureGitReader({
      commits: [
        makeCommit({
          sha: 'b'.repeat(40),
          shortSha: 'b'.repeat(7),
          message: `revert: feat: add cache\n\nThis reverts commit ${'a'.repeat(40)}.`,
        }),
        makeCommit({ sha: 'a'.repeat(40), shortSha: 'a'.repeat(7), message: 'feat: add cache' }),
      ],
    });
    const { parsedCommits } = await generateChangelog(reader, defaultConfig());
    expect(parsedCommits).toHaveLength(0);
  });

  it('does not infer a version when the bump is "none"', async () => {
    const reader = new FixtureGitReader({
      commits: [
        makeCommit({ sha: 'c1', shortSha: 'c1', message: 'docs: typo' }),
        makeCommit({ sha: 'c0', shortSha: 'c0', message: 'chore: init' }),
      ],
      tags: [makeTag({ name: 'v1.0.0', sha: 'c0', semver: parseSemVer('1.0.0') })],
    });
    const { data } = await generateChangelog(reader, defaultConfig());
    expect(data.bump).toBe('none');
    expect(data.version).toBeUndefined();
  });
});
