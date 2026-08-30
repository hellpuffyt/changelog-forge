import type { RawCommit, TagInfo } from '../types.js';

export interface CommitRange {
  /** Exclusive lower bound (a ref/sha), or undefined to read from the root commit. */
  from?: string;
  /** Inclusive upper bound (a ref/sha). */
  to: string;
}

/**
 * Everything the changelog logic needs from git, behind an interface so parsing/grouping/
 * ordering/version-inference can be unit-tested with no repository at all.
 */
export interface GitReader {
  /** Lists all tags in the repository. */
  listTags(): Promise<TagInfo[]>;
  /** Lists commits in `range`, newest first, as `git log` would order them. */
  getCommits(range: CommitRange): Promise<RawCommit[]>;
  /** Resolves a ref (branch, tag, sha, HEAD) to a full commit sha. */
  resolveRef(ref: string): Promise<string>;
}
