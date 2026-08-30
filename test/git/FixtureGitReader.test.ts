import { describe, expect, it } from 'vitest';
import { FixtureGitReader } from '../../src/git/FixtureGitReader.js';
import { makeCommit, makeTag } from '../helpers.js';

describe('FixtureGitReader', () => {
  const c1 = makeCommit({ sha: 'c1', shortSha: 'c1', message: 'feat: three' });
  const c2 = makeCommit({ sha: 'c2', shortSha: 'c2', message: 'feat: two' });
  const c3 = makeCommit({ sha: 'c3', shortSha: 'c3', message: 'feat: one' });
  // Newest first, matching `git log` order.
  const reader = new FixtureGitReader({
    commits: [c1, c2, c3],
    tags: [makeTag({ name: 'v1.0.0', sha: 'c3' })],
  });

  it('resolves HEAD to the newest commit', async () => {
    expect(await reader.resolveRef('HEAD')).toBe('c1');
  });

  it('resolves a tag name to its sha', async () => {
    expect(await reader.resolveRef('v1.0.0')).toBe('c3');
  });

  it('returns commits in the given range, exclusive of "from"', async () => {
    const commits = await reader.getCommits({ from: 'c3', to: 'c1' });
    expect(commits.map((c) => c.sha)).toEqual(['c1', 'c2']);
  });

  it('returns all commits down to the root when "from" is omitted', async () => {
    const commits = await reader.getCommits({ to: 'c1' });
    expect(commits.map((c) => c.sha)).toEqual(['c1', 'c2', 'c3']);
  });

  it('lists tags', async () => {
    const tags = await reader.listTags();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.name).toBe('v1.0.0');
  });

  it('throws for an unknown ref', async () => {
    await expect(reader.getCommits({ to: 'does-not-exist' })).rejects.toThrow();
    await expect(reader.resolveRef('does-not-exist')).rejects.toThrow();
  });
});
