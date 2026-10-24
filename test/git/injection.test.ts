import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RealGitReader, assertSafeRef } from '../../src/git/RealGitReader.js';
import { isEntryPoint, run } from '../../src/cli.js';

const execFileAsync = promisify(execFile);
let dir: string;

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: dir });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'changelog-forge-inject-'));
  await git(['init', '-q']);
  await git(['config', 'user.name', 'Test User']);
  await git(['config', 'user.email', 'test@example.com']);
  writeFileSync(join(dir, 'f.txt'), 'x');
  await git(['add', '.']);
  await git(['commit', '-q', '-m', 'feat: first']);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('git argument injection', () => {
  it('a --to value cannot become a git option that writes a file', async () => {
    const target = join(dir, 'pwned.txt');
    const reader = new RealGitReader(dir);
    await expect(reader.getCommits({ to: `--output=${target}` })).rejects.toThrow(/unsafe git revision/);
    await expect(reader.getCommits({ from: `--output=${target}`, to: 'HEAD' })).rejects.toThrow(/unsafe git revision/);
    await expect(reader.resolveRef(`--output=${target}`)).rejects.toThrow(/unsafe git revision/);
    expect(existsSync(target)).toBe(false);
  });

  it('the CLI refuses it too and writes nothing', async () => {
    const target = join(dir, 'pwned.txt');
    const stderr: string[] = [];
    const origErr = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string): boolean => {
      stderr.push(String(chunk));
      return true;
    });
    try {
      const code = await run(['--cwd', dir, '--to', `--output=${target}`]).catch(() => 1);
      expect(code).not.toBe(0);
    } finally {
      process.stderr.write = origErr;
    }
    expect(existsSync(target)).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('repository config cannot make git log run a signature program', async () => {
    const marker = join(dir, 'gpg-ran');
    const script = join(dir, 'fake-gpg.sh');
    // Signs (so the commit really carries a signature) and records every verify call.
    writeFileSync(
      script,
      [
        '#!/bin/sh',
        'case "$*" in',
        `  *--verify*) touch "${marker}"; exit 1 ;;`,
        '  *) cat >/dev/null; echo "[GNUPG:] SIG_CREATED " >&2;',
        '     printf -- "-----BEGIN PGP SIGNATURE-----\\n\\nAA==\\n-----END PGP SIGNATURE-----\\n" ;;',
        'esac',
        '',
      ].join('\n'),
      { mode: 0o755 },
    );
    await git(['config', 'gpg.program', script]);
    writeFileSync(join(dir, 'f.txt'), 'signed');
    await git(['add', '.']);
    await git(['-c', 'user.signingkey=TEST', 'commit', '-q', '-S', '-m', 'feat: signed']);
    // Sanity: the signature program does run when git is asked to verify.
    await execFileAsync('git', ['log', '-1', '--show-signature'], { cwd: dir }).catch(() => undefined);
    expect(existsSync(marker)).toBe(true);
    rmSync(marker);

    await git(['config', 'log.showSignature', 'true']);
    await git(['config', 'gpg.program', script]);
    const reader = new RealGitReader(dir);
    await reader.getCommits({ to: 'HEAD' });
    expect(existsSync(marker)).toBe(false);
  });

  it('accepts ordinary revisions', () => {
    for (const ref of ['HEAD', 'v1.2.0', 'main', 'abc1234', 'release/1.x', 'HEAD~3', 'v1.0.0^{commit}']) {
      expect(() => assertSafeRef(ref)).not.toThrow();
    }
    for (const ref of ['', '-n1', '--all', 'a b', 'x\ny']) {
      expect(() => assertSafeRef(ref)).toThrow();
    }
  });
});

describe.skipIf(process.platform === 'win32')('CLI entry point', () => {
  it('treats a symlinked bin as the entry point', () => {
    const cli = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
    const link = join(dir, 'changelog-forge');
    symlinkSync(cli, link);
    expect(isEntryPoint(link, pathToFileURL(cli).href)).toBe(true);
    expect(isEntryPoint(undefined, pathToFileURL(cli).href)).toBe(false);
  });
});
