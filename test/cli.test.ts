import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs, run } from '../src/cli.js';

const execFileAsync = promisify(execFile);

describe('parseArgs', () => {
  it('parses --from and --to', () => {
    const options = parseArgs(['--from', 'v1.0.0', '--to', 'HEAD']);
    expect(options.from).toBe('v1.0.0');
    expect(options.to).toBe('HEAD');
  });

  it('defaults format to markdown', () => {
    expect(parseArgs([]).format).toBe('markdown');
  });

  it('parses --format json', () => {
    expect(parseArgs(['--format', 'json']).format).toBe('json');
  });

  it('rejects an invalid --format value', () => {
    expect(() => parseArgs(['--format', 'yaml'])).toThrow(/--format must be/);
  });

  it('parses --prepend with a following path', () => {
    expect(parseArgs(['--prepend', 'HISTORY.md']).prepend).toBe('HISTORY.md');
  });

  it('defaults --prepend to CHANGELOG.md when no path follows', () => {
    expect(parseArgs(['--prepend']).prepend).toBe('CHANGELOG.md');
  });

  it('does not swallow the next flag as a --prepend path', () => {
    const options = parseArgs(['--prepend', '--format', 'json']);
    expect(options.prepend).toBe('CHANGELOG.md');
    expect(options.format).toBe('json');
  });

  it('parses --include as a comma-separated list', () => {
    expect(parseArgs(['--include', 'chore,ci, style']).include).toEqual(['chore', 'ci', 'style']);
  });

  it('parses --help / -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
    expect(parseArgs([]).help).toBe(false);
  });

  it('throws for a flag missing its required value', () => {
    expect(() => parseArgs(['--from'])).toThrow(/--from requires a value/);
  });

  it('throws for an unknown flag', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(/Unknown argument/);
  });

  it('parses --repo-url, --config, --out, --cwd, --version', () => {
    const options = parseArgs([
      '--repo-url',
      'https://github.com/o/r',
      '--config',
      'cfg.json',
      '--out',
      'out.md',
      '--cwd',
      '/tmp/repo',
      '--version',
      '2.0.0',
    ]);
    expect(options.repoUrl).toBe('https://github.com/o/r');
    expect(options.config).toBe('cfg.json');
    expect(options.out).toBe('out.md');
    expect(options.cwd).toBe('/tmp/repo');
    expect(options.version).toBe('2.0.0');
  });
});

describe('run (end to end against a real temp repo)', () => {
  let dir: string;

  async function git(args: string[]): Promise<void> {
    await execFileAsync('git', args, { cwd: dir });
  }

  async function commit(message: string): Promise<void> {
    writeFileSync(join(dir, `f-${Date.now()}-${Math.random()}.txt`), 'x');
    await git(['add', '.']);
    await git(['commit', '-q', '-m', message]);
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'changelog-forge-cli-'));
    await git(['init', '-q']);
    await git(['symbolic-ref', 'HEAD', 'refs/heads/main']);
    await git(['config', 'user.name', 'Test User']);
    await git(['config', 'user.email', 'test@example.com']);
    await commit('chore: init');
    await commit('feat: add widget');
    await commit('fix: correct widget size');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('prints markdown to stdout by default', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const code = await run(['--cwd', dir]);
      expect(code).toBe(0);
      const output = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('Features');
      expect(output).toContain('Bug Fixes');
    } finally {
      spy.mockRestore();
    }
  });

  it('writes JSON to a file with --format json --out', async () => {
    const outPath = join(dir, 'out.json');
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const code = await run(['--cwd', dir, '--format', 'json', '--out', outPath]);
      expect(code).toBe(0);
    } finally {
      spy.mockRestore();
    }
    const parsed: unknown = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(parsed).toBeTruthy();
  });

  it('prepends into a fresh CHANGELOG.md', async () => {
    const changelogPath = join(dir, 'CHANGELOG.md');
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const code = await run(['--cwd', dir, '--prepend', changelogPath]);
      expect(code).toBe(0);
    } finally {
      spy.mockRestore();
    }
    const content = readFileSync(changelogPath, 'utf8');
    expect(content).toContain('# Changelog');
    expect(content).toContain('Features');
  });

  it('rejects --prepend combined with --format json', async () => {
    await expect(run(['--cwd', dir, '--prepend', '--format', 'json'])).rejects.toThrow(
      /--prepend only supports --format markdown/
    );
  });

  it('prints help text and exits 0', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const code = await run(['--help']);
      expect(code).toBe(0);
      const output = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('Usage:');
    } finally {
      spy.mockRestore();
    }
  });
});
