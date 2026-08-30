import type { ParsedCommit } from './types.js';

/**
 * Cancels out a revert commit against the commit it reverts, when both are present in the
 * same commit set — a commit and its revert have no net effect on the release, so neither
 * should appear. A revert commit whose target isn't in the set (reverting something from an
 * earlier release) is left as a visible Reverts entry.
 */
export function cancelReverts(commits: ParsedCommit[]): ParsedCommit[] {
  const bySha = new Map<string, ParsedCommit>();
  const byShortSha = new Map<string, ParsedCommit>();
  for (const commit of commits) {
    bySha.set(commit.raw.sha, commit);
    byShortSha.set(commit.raw.shortSha, commit);
  }

  const cancelled = new Set<ParsedCommit>();
  for (const commit of commits) {
    if (!commit.revertsSha) continue;
    const target =
      bySha.get(commit.revertsSha) ??
      byShortSha.get(commit.revertsSha) ??
      [...bySha.values()].find((c) => c.raw.sha.startsWith(commit.revertsSha ?? '\0'));
    if (target && target !== commit) {
      cancelled.add(commit);
      cancelled.add(target);
    }
  }

  return commits.filter((c) => !cancelled.has(c));
}
