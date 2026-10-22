import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RawCommit, TagInfo } from '../types.js';
import { parseSemVer } from '../semver.js';
import type { CommitRange, GitReader } from './GitReader.js';

const execFileAsync = promisify(execFile);

const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';

/**
 * Rejects a user-supplied revision that git could read as an option.
 *
 * `--from`/`--to` used to be passed straight to `git log`, so a value such as
 * `--output=/some/file` made git write an arbitrary file. Refs are also passed
 * after `--end-of-options`, so this check is defence in depth and gives a
 * clear error message.
 */
export function assertSafeRef(ref: string): void {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is rejected
  if (ref.length === 0 || ref.startsWith('-') || /[\x00-\x20\x7f]/.test(ref)) {
    throw new Error(`refusing unsafe git revision ${JSON.stringify(ref)}: revisions may not be empty, start with "-", or contain whitespace/control characters`);
  }
}

/** A GitReader backed by the system `git` binary, run against a real repository on disk. */
export class RealGitReader implements GitReader {
  constructor(private readonly cwd: string) {}

  private async git(args: string[]): Promise<string> {
    // Repository config must not be able to make a read-only command run
    // programs (e.g. log.showSignature invoking gpg.program).
    const { stdout } = await execFileAsync('git', ['-c', 'log.showSignature=false', ...args], {
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
    if (range.from) assertSafeRef(range.from);
    assertSafeRef(range.to);
    const rangeArg = range.from ? `${range.from}..${range.to}` : range.to;
    const format = `%H${FIELD_SEP}%h${FIELD_SEP}%an${FIELD_SEP}%ae${FIELD_SEP}%aI${FIELD_SEP}%B${RECORD_SEP}`;
    const stdout = await this.git([
      'log',
      `--format=${format}`,
      '--no-color',
      '--end-of-options',
      rangeArg,
      '--',
    ]);
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
    assertSafeRef(ref);
    const stdout = await this.git(['rev-parse', '--verify', '--end-of-options', ref]);
    return stdout.trim();
  }
}
