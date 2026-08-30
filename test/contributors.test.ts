import { describe, expect, it } from 'vitest';
import { buildContributors } from '../src/contributors.js';
import { defaultConfig } from '../src/config.js';
import { parseCommit } from '../src/parser.js';
import { makeCommit } from './helpers.js';

function commit(name: string, email: string, message = 'feat: x') {
  const result = parseCommit(makeCommit({ message, author: { name, email } }));
  if (!result.ok) throw new Error('expected a valid commit');
  return result.commit;
}

describe('buildContributors', () => {
  it('deduplicates by lower-cased email', () => {
    const commits = [
      commit('Ada Lovelace', 'Ada@Example.com'),
      commit('Ada Lovelace', 'ada@example.com'),
    ];
    const contributors = buildContributors(commits, defaultConfig());
    expect(contributors).toHaveLength(1);
    expect(contributors[0]?.name).toBe('Ada Lovelace');
  });

  it('excludes bots matched by default patterns', () => {
    const commits = [
      commit('dependabot[bot]', 'dependabot[bot]@users.noreply.github.com'),
      commit('Grace Hopper', 'grace@example.com'),
      commit('github-actions[bot]', 'github-actions[bot]@github.com'),
    ];
    const contributors = buildContributors(commits, defaultConfig());
    expect(contributors.map((c) => c.name)).toEqual(['Grace Hopper']);
  });

  it('excludes bots matched by a custom pattern', () => {
    const config = { ...defaultConfig(), botPatterns: ['^ci-bot$'] };
    const commits = [commit('ci-bot', 'ci-bot@example.com'), commit('Real Person', 'real@example.com')];
    const contributors = buildContributors(commits, config);
    expect(contributors.map((c) => c.name)).toEqual(['Real Person']);
  });

  it('sorts contributors by name', () => {
    const commits = [commit('Zoe', 'zoe@example.com'), commit('Amy', 'amy@example.com')];
    const contributors = buildContributors(commits, defaultConfig());
    expect(contributors.map((c) => c.name)).toEqual(['Amy', 'Zoe']);
  });

  it('skips commits with a missing author name or email', () => {
    const commits = [commit('', 'noname@example.com'), commit('No Email', '')];
    const contributors = buildContributors(commits, defaultConfig());
    expect(contributors).toEqual([]);
  });

  it('returns an empty list for no commits', () => {
    expect(buildContributors([], defaultConfig())).toEqual([]);
  });
});
