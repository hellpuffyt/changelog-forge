import type { RawCommit, TagInfo } from '../src/types.js';

let counter = 0;

export function makeCommit(overrides: Partial<RawCommit> & { message: string }): RawCommit {
  counter += 1;
  const sha = overrides.sha ?? `${counter.toString(16).padStart(40, '0')}`;
  return {
    sha,
    shortSha: overrides.shortSha ?? sha.slice(0, 7),
    author: overrides.author ?? { name: 'Ada Lovelace', email: 'ada@example.com' },
    date: overrides.date ?? `2026-01-${String((counter % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    message: overrides.message,
  };
}

export function makeTag(
  overrides: { name: string; sha: string; createdAt?: string; semver?: TagInfo['semver'] }
): TagInfo {
  return {
    name: overrides.name,
    sha: overrides.sha,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    ...(overrides.semver ? { semver: overrides.semver } : {}),
  };
}

export function resetCounter(): void {
  counter = 0;
}
