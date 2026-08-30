import type { RawCommit, TagInfo } from '../types.js';
import type { CommitRange, GitReader } from './GitReader.js';

/**
 * An in-memory GitReader for tests: commits and tags are supplied directly, newest-first,
 * so parsing/grouping/ordering/version-inference logic can be exercised without a real repo.
 */
export class FixtureGitReader implements GitReader {
  private readonly commits: RawCommit[];
  private readonly tags: TagInfo[];

  constructor(options: { commits: RawCommit[]; tags?: TagInfo[] }) {
    this.commits = options.commits;
    this.tags = options.tags ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listTags(): Promise<TagInfo[]> {
    return [...this.tags];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getCommits(range: CommitRange): Promise<RawCommit[]> {
    const toIndex = this.indexOf(range.to);
    if (toIndex === -1) {
      throw new Error(`FixtureGitReader: unknown ref "${range.to}"`);
    }
    const fromIndex = range.from ? this.indexOf(range.from) : this.commits.length;
    if (range.from && fromIndex === -1) {
      throw new Error(`FixtureGitReader: unknown ref "${range.from}"`);
    }
    // Commits are stored newest-first; "from" is exclusive and older than "to".
    return this.commits.slice(toIndex, fromIndex);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async resolveRef(ref: string): Promise<string> {
    if (ref === 'HEAD') {
      const first = this.commits[0];
      if (!first) throw new Error('FixtureGitReader: no commits');
      return first.sha;
    }
    const tag = this.tags.find((t) => t.name === ref);
    if (tag) return tag.sha;
    const commit = this.commits.find((c) => c.sha === ref || c.shortSha === ref);
    if (commit) return commit.sha;
    throw new Error(`FixtureGitReader: unknown ref "${ref}"`);
  }

  private indexOf(ref: string): number {
    if (ref === 'HEAD') return this.commits.length > 0 ? 0 : -1;
    const tag = this.tags.find((t) => t.name === ref);
    const sha = tag ? tag.sha : ref;
    return this.commits.findIndex((c) => c.sha === sha || c.shortSha === sha);
  }
}
