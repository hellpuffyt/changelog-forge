import { describe, expect, it } from 'vitest';
import { cancelReverts } from '../src/revert.js';
import { parseCommit } from '../src/parser.js';
import { makeCommit } from './helpers.js';

function commit(sha: string, message: string) {
  const result = parseCommit(makeCommit({ sha, shortSha: sha.slice(0, 7), message }));
  if (!result.ok) throw new Error(`expected a valid commit: ${message}`);
  return result.commit;
}

describe('cancelReverts', () => {
  it('cancels a commit and its revert when both are present', () => {
    const original = commit('a'.repeat(40), 'feat: add experimental cache');
    const revert = commit(
      'b'.repeat(40),
      `revert: feat: add experimental cache\n\nThis reverts commit ${'a'.repeat(40)}.`
    );
    const other = commit('c'.repeat(40), 'fix: unrelated fix');

    const result = cancelReverts([revert, original, other]);
    expect(result).toEqual([other]);
  });

  it('matches a revert by short sha', () => {
    const original = commit('a'.repeat(40), 'feat: add thing');
    const revert = commit(
      'b'.repeat(40),
      `revert: feat: add thing\n\nThis reverts commit ${'a'.repeat(40).slice(0, 7)}.`
    );
    const result = cancelReverts([original, revert]);
    expect(result).toEqual([]);
  });

  it('keeps a revert commit whose target is not in the set', () => {
    const revert = commit(
      'b'.repeat(40),
      `revert: feat: something from an earlier release\n\nThis reverts commit ${'f'.repeat(40)}.`
    );
    const result = cancelReverts([revert]);
    expect(result).toEqual([revert]);
  });

  it('leaves non-revert commits untouched', () => {
    const commits = [commit('a'.repeat(40), 'feat: a'), commit('b'.repeat(40), 'fix: b')];
    expect(cancelReverts(commits)).toEqual(commits);
  });

  it('handles an empty list', () => {
    expect(cancelReverts([])).toEqual([]);
  });

  it('does not cancel a revert commit against itself', () => {
    const sha = 'a'.repeat(40);
    const selfReferential = commit(sha, `revert: feat: x\n\nThis reverts commit ${sha}.`);
    const result = cancelReverts([selfReferential]);
    expect(result).toEqual([selfReferential]);
  });
});
