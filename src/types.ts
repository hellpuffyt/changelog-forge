/** A single commit as read from git (or a fixture), before conventional-commit parsing. */
export interface RawCommit {
  /** Full commit SHA. */
  sha: string;
  /** Abbreviated SHA (7+ chars), used for display. */
  shortSha: string;
  author: {
    name: string;
    email: string;
  };
  /** ISO 8601 commit date. */
  date: string;
  /** Full raw commit message (subject + body + footers), exactly as `git log --format=%B` returns it. */
  message: string;
}

export interface TagInfo {
  name: string;
  sha: string;
  /** ISO 8601 tag/commit creation date. Present for both annotated and lightweight tags. */
  createdAt: string;
  /** Parsed semver, or undefined if the tag name is not a valid (optionally `v`-prefixed) semver. */
  semver?: SemVer;
}

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  raw: string;
}

export type CommitSection =
  | 'breaking'
  | 'feat'
  | 'fix'
  | 'perf'
  | 'revert'
  | 'deprecate'
  | 'other';

export interface Footer {
  key: string;
  value: string;
}

/** A commit that was successfully parsed as a conventional commit. */
export interface ParsedCommit {
  raw: RawCommit;
  type: string;
  /** Raw scope as written in the commit, or undefined if none. */
  scope?: string;
  /** Scope after alias resolution, or undefined if none. */
  canonicalScope?: string;
  /** True if `!` marker was present or a BREAKING CHANGE footer was found. */
  breaking: boolean;
  /** Migration note text taken from the BREAKING CHANGE/BREAKING-CHANGE footer, if any. */
  breakingNote?: string;
  subject: string;
  body?: string;
  footers: Footer[];
  section: CommitSection;
  /** SHA referenced by a `This reverts commit <sha>` line, if this is a revert commit. */
  revertsSha?: string;
  /** PR numbers referenced as `(#123)` in the subject. */
  prNumbers: number[];
  /** Issue numbers referenced anywhere in the body/footers as `#123`. */
  issueNumbers: number[];
}

/** A commit string that failed conventional-commit parsing (skipped from output, never crashes). */
export interface SkippedCommit {
  raw: RawCommit;
  reason: string;
}

export type VersionBump = 'major' | 'minor' | 'patch' | 'none';

export interface Contributor {
  name: string;
  email: string;
}

export interface GroupedEntry {
  commit: ParsedCommit;
}

export interface ScopeGroup {
  /** Canonical scope name, or undefined for the unscoped bucket. */
  scope?: string;
  entries: GroupedEntry[];
}

export interface Section {
  id: CommitSection;
  title: string;
  groups: ScopeGroup[];
}

export interface ChangelogData {
  version?: string;
  bump: VersionBump;
  date: string;
  from?: string;
  to: string;
  sections: Section[];
  contributors: Contributor[];
  skipped: SkippedCommit[];
  repoUrl?: string;
}

export interface ScopeAliasMap {
  [rawScope: string]: string;
}

export interface ForgeConfig {
  repoUrl?: string;
  scopeAliases: ScopeAliasMap;
  botPatterns: string[];
  /** Commit types excluded from output by default. */
  excludeTypes: string[];
  /** Types to force-include even if present in excludeTypes (used by --include). */
  includeTypes: string[];
}
