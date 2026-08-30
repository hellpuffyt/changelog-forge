/** Link generation for commit SHAs, PR numbers, and issue references against a repo URL. */
export class LinkBuilder {
  private readonly base: string | undefined;

  constructor(repoUrl: string | undefined) {
    this.base = repoUrl ? repoUrl.replace(/\/+$/, '') : undefined;
  }

  commit(sha: string): string | undefined {
    if (!this.base) return undefined;
    return `${this.base}/commit/${sha}`;
  }

  pull(number: number): string | undefined {
    if (!this.base) return undefined;
    return `${this.base}/pull/${number}`;
  }

  issue(number: number): string | undefined {
    if (!this.base) return undefined;
    return `${this.base}/issues/${number}`;
  }
}
