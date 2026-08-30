import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RawCommit, TagInfo } from '../types.js';
import { parseSemVer } from '../semver.js';
import type { CommitRange, GitReader } from './GitReader.js';

const execFileAsync = promisify(execFile);

const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';

/** A GitReader backed by the system `git` binary, run against a real repository on disk. */
export class RealGitReader implements GitReader {
  constructor(private readonly cwd: string) {}

  private async git(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.cwd,
      maxBuffer: 1024 * 1024 * 64,
    });
    return stdout;
  }

  async listTags(): Promise<TagInfo[]> {
    let stdout: string;
    try {
      stdout = await this.git([
        'for-each-ref',
        'refs/tags',
        `--format=%(refname:short)${FIELD_SEP}%(objectname)${FIELD_SEP}%(*objectname)${FIELD_SEP}%(creatordate:iso-strict)${FIELD_SEP}%(*creatordate:iso-strict)`,
      ]);
    } catch {
      return [];
    }
    const tags: TagInfo[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const [name, sha, dereferencedSha, createdAt, dereferencedDate] = line.split(FIELD_SEP);
      if (!name || !sha) continue;
      const resolvedSha = dereferencedSha && dereferencedSha.length > 0 ? dereferencedSha : sha;
      const resolvedDate =
        dereferencedDate && dereferencedDate.length > 0 ? dereferencedDate : (createdAt ?? '');
      const semver = parseSemVer(name);
      tags.push({
        name,
        sha: resolvedSha,
        createdAt: resolvedDate,
        ...(semver ? { semver } : {}),
      });
    }
    return tags;
  }

  async getCommits(range: CommitRange): Promise<RawCommit[]> {
    const rangeArg = range.from ? `${range.from}..${range.to}` : range.to;
    const format = `%H${FIELD_SEP}%h${FIELD_SEP}%an${FIELD_SEP}%ae${FIELD_SEP}%aI${FIELD_SEP}%B${RECORD_SEP}`;
    const stdout = await this.git(['log', rangeArg, `--format=${format}`, '--no-color']);
    const records = stdout.split(RECORD_SEP).filter((r) => r.trim().length > 0);
    const commits: RawCommit[] = [];
    for (const record of records) {
      const trimmed = record.replace(/^\n/, '');
      const parts = trimmed.split(FIELD_SEP);
      const [sha, shortSha, authorName, authorEmail, date, ...messageParts] = parts;
      if (!sha || !shortSha || date === undefined) continue;
      const message = messageParts.join(FIELD_SEP).replace(/\n$/, '');
      commits.push({
        sha,
        shortSha,
        author: { name: authorName ?? '', email: authorEmail ?? '' },
        date,
        message,
      });
    }
    return commits;
  }

  async resolveRef(ref: string): Promise<string> {
    const stdout = await this.git(['rev-parse', ref]);
    return stdout.trim();
  }
}
