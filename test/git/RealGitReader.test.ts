import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RealGitReader } from '../../src/git/RealGitReader.js';
import { parseCommit } from '../../src/parser.js';

const execFileAsync = promisify(execFile);

let dir: string;

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: dir });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'changelog-forge-'));
  await git(['init', '-q']);
  await git(['symbolic-ref', 'HEAD', 'refs/heads/main']);
  await git(['config', 'user.name', 'Test User']);
  await git(['config', 'user.email', 'test@example.com']);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function commit(message: string): Promise<void> {
  writeFileSync(join(dir, 'file.txt'), `${Date.now()}-${Math.random()}`);
  await git(['add', '.']);
  await git(['commit', '-q', '-m', message]);
}

describe('RealGitReader (integration, real temp repo)', () => {
  it('reads commits from a real repository in newest-first order', async () => {
    await commit('feat: first feature');
    await commit('fix: a bug');
    await commit('feat: second feature');

    const reader = new RealGitReader(dir);
    const head = await reader.resolveRef('HEAD');
    const commits = await reader.getCommits({ to: head });

    expect(commits).toHaveLength(3);
    expect(commits[0]?.message.split('\n')[0]).toBe('feat: second feature');
    expect(commits[2]?.message.split('\n')[0]).toBe('feat: first feature');
    expect(commits[0]?.author.name).toBe('Test User');
    expect(commits[0]?.author.email).toBe('test@example.com');
    expect(commits[0]?.sha).toHaveLength(40);
  });

  it('parses real commit messages with bodies and footers written through git', async () => {
    writeFileSync(join(dir, 'file.txt'), '1');
    await git(['add', '.']);
    const message = [
      'feat(api)!: change response shape',
      '',
      'The response is now an object instead of an array.',
      '',
      'BREAKING CHANGE: clients must update their parsing code.',
    ].join('\n');
    await git(['commit', '-q', '-m', message]);

    const reader = new RealGitReader(dir);
    const head = await reader.resolveRef('HEAD');
    const commits = await reader.getCommits({ to: head });
    const parsed = parseCommit(commits[0]!);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.commit.breaking).toBe(true);
    expect(parsed.commit.breakingNote).toBe('clients must update their parsing code.');
  });

  it('lists tags with resolved semver', async () => {
    await commit('feat: initial');
    await git(['tag', 'v1.0.0']);
    await commit('feat: more');
    await git(['tag', '-a', 'v1.1.0', '-m', 'release 1.1.0']);

    const reader = new RealGitReader(dir);
    const tags = await reader.listTags();
    const names = tags.map((t) => t.name).sort();
    expect(names).toEqual(['v1.0.0', 'v1.1.0']);
    for (const tag of tags) {
      expect(tag.semver).toBeDefined();
      expect(tag.sha).toHaveLength(40);
    }
  });

  it('reads a commit range between two refs', async () => {
    await commit('feat: a');
    await git(['tag', 'v1.0.0']);
    await commit('feat: b');
    await commit('fix: c');

    const reader = new RealGitReader(dir);
    const head = await reader.resolveRef('HEAD');
    const commits = await reader.getCommits({ from: 'v1.0.0', to: head });
    const subjects = commits.map((c) => c.message.split('\n')[0]);
    expect(subjects).toEqual(['fix: c', 'feat: b']);
  });

  it('resolveRef resolves HEAD, a tag, and a short sha', async () => {
    await commit('feat: a');
    await git(['tag', 'v1.0.0']);

    const reader = new RealGitReader(dir);
    const head = await reader.resolveRef('HEAD');
    const viaTag = await reader.resolveRef('v1.0.0');
    expect(viaTag).toBe(head);
    const viaShortSha = await reader.resolveRef(head.slice(0, 7));
    expect(viaShortSha).toBe(head);
  });

  it('returns an empty tag list for a repository with no tags', async () => {
    await commit('feat: a');
    const reader = new RealGitReader(dir);
    expect(await reader.listTags()).toEqual([]);
  });
});
