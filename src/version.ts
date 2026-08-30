import type { ParsedCommit, TagInfo, VersionBump } from './types.js';
import { compareSemVer } from './semver.js';

/**
 * Finds the "previous release" tag by semver ordering rather than by tag/creation date.
 * When tags are pushed out of order (e.g. a 1.2.0 hotfix tag created after 1.3.0-rc.1 was
 * already pushed), creation-date ordering picks the wrong baseline; semver ordering doesn't.
 */
export function findPreviousTag(tags: TagInfo[]): TagInfo | undefined {
  const semverTags = tags.filter((t): t is TagInfo & { semver: NonNullable<TagInfo['semver']> } =>
    Boolean(t.semver)
  );
  if (semverTags.length === 0) return undefined;
  return [...semverTags].sort((a, b) => compareSemVer(b.semver, a.semver))[0];
}

/** Infers the conventional-commits version bump implied by a set of parsed commits. */
export function inferBump(commits: ParsedCommit[]): VersionBump {
  let hasFeat = false;
  let hasFixOrPerf = false;
  for (const commit of commits) {
    if (commit.breaking) return 'major';
    if (commit.section === 'feat') hasFeat = true;
    if (commit.section === 'fix' || commit.section === 'perf') hasFixOrPerf = true;
  }
  if (hasFeat) return 'minor';
  if (hasFixOrPerf) return 'patch';
  return 'none';
}
