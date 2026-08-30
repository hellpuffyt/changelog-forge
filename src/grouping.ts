import type { CommitSection, ParsedCommit, ScopeGroup, Section } from './types.js';
import type { ForgeConfig } from './types.js';
import { effectiveExcludedTypes, resolveScope } from './config.js';

/** Impact order: what breaks, first — then what's new, then fixes, then everything else. */
export const SECTION_ORDER: CommitSection[] = [
  'breaking',
  'feat',
  'fix',
  'perf',
  'revert',
  'deprecate',
  'other',
];

export const SECTION_TITLES: Record<CommitSection, string> = {
  breaking: 'BREAKING CHANGES',
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance Improvements',
  revert: 'Reverts',
  deprecate: 'Deprecations',
  other: 'Other Changes',
};

/**
 * Filters out excluded types (chore/ci/style/test by default), then buckets the remaining
 * commits into impact-ordered sections, grouped by canonical scope within each section.
 * Breaking commits are surfaced only in the BREAKING CHANGES section, never duplicated below.
 */
export function buildSections(commits: ParsedCommit[], config: ForgeConfig): Section[] {
  const excluded = effectiveExcludedTypes(config);
  const filtered = commits.filter((c) => c.breaking || !excluded.has(c.type));

  const bySection = new Map<CommitSection, ParsedCommit[]>();
  for (const commit of filtered) {
    const list = bySection.get(commit.section) ?? [];
    list.push(commit);
    bySection.set(commit.section, list);
  }

  const sections: Section[] = [];
  for (const id of SECTION_ORDER) {
    const commitsInSection = bySection.get(id);
    if (!commitsInSection || commitsInSection.length === 0) continue;
    sections.push({ id, title: SECTION_TITLES[id], groups: groupByScope(commitsInSection, config) });
  }
  return sections;
}

function groupByScope(commits: ParsedCommit[], config: ForgeConfig): ScopeGroup[] {
  const withCanonicalScope = commits.map((commit) => ({
    commit,
    canonicalScope: resolveScope(config, commit.scope),
  }));

  const unscoped = withCanonicalScope.filter((c) => !c.canonicalScope);
  const scoped = withCanonicalScope.filter((c) => c.canonicalScope);

  const byScope = new Map<string, ParsedCommit[]>();
  for (const { commit, canonicalScope } of scoped) {
    if (!canonicalScope) continue;
    const list = byScope.get(canonicalScope) ?? [];
    list.push(commit);
    byScope.set(canonicalScope, list);
  }

  const groups: ScopeGroup[] = [];
  if (unscoped.length > 0) {
    groups.push({ entries: unscoped.map((c) => ({ commit: c.commit })) });
  }
  for (const scope of [...byScope.keys()].sort((a, b) => a.localeCompare(b))) {
    const scopeCommits = byScope.get(scope) ?? [];
    groups.push({ scope, entries: scopeCommits.map((commit) => ({ commit })) });
  }
  return groups;
}
