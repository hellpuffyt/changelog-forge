#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RealGitReader } from './git/RealGitReader.js';
import { loadConfig, mergeConfig } from './config.js';
import { generateChangelog } from './engine.js';
import { renderMarkdown } from './render/markdown.js';
import { renderJson } from './render/json.js';
import { prependRelease } from './prepend.js';

interface CliOptions {
  from?: string;
  to?: string;
  repoUrl?: string;
  config?: string;
  prepend?: string;
  format: 'markdown' | 'json';
  out?: string;
  cwd: string;
  include: string[];
  version?: string;
  help: boolean;
}

const HELP = `changelog-forge - generate a changelog from conventional commits

Usage:
  changelog-forge [options]

Options:
  --from <ref>          Start of the commit range (exclusive). Defaults to auto-detected
                         previous tag (highest semver, not most recently created).
  --to <ref>             End of the commit range (inclusive). Defaults to HEAD.
  --repo-url <url>       Repository URL used to build commit/PR/issue links.
  --config <path>        Path to a JSON config file.
  --prepend [path]       Insert into an existing changelog file above previous releases.
                          Defaults to CHANGELOG.md when no path is given.
  --format <markdown|json>  Output format. Defaults to markdown.
  --out <path>           Write output to a file instead of stdout.
  --cwd <path>            Git repository directory. Defaults to the current directory.
  --include <types>       Comma-separated types to include even if normally excluded
                          (e.g. chore,ci,style,test).
  --version <semver>      Explicit release version, overriding inference.
  -h, --help              Show this help message.
`;

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    format: 'markdown',
    cwd: process.cwd(),
    include: [],
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--from':
        options.from = requireValue(argv, ++i, '--from');
        break;
      case '--to':
        options.to = requireValue(argv, ++i, '--to');
        break;
      case '--repo-url':
        options.repoUrl = requireValue(argv, ++i, '--repo-url');
        break;
      case '--config':
        options.config = requireValue(argv, ++i, '--config');
        break;
      case '--prepend': {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          options.prepend = next;
          i++;
        } else {
          options.prepend = 'CHANGELOG.md';
        }
        break;
      }
      case '--format': {
        const value = requireValue(argv, ++i, '--format');
        if (value !== 'markdown' && value !== 'json') {
          throw new Error(`--format must be "markdown" or "json", got "${value}"`);
        }
        options.format = value;
        break;
      }
      case '--out':
        options.out = requireValue(argv, ++i, '--out');
        break;
      case '--cwd':
        options.cwd = requireValue(argv, ++i, '--cwd');
        break;
      case '--include':
        options.include = requireValue(argv, ++i, '--include')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--version':
        options.version = requireValue(argv, ++i, '--version');
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export async function run(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const baseConfig = await loadConfig(options.config);
  const config = mergeConfig(baseConfig, {
    ...(options.repoUrl ? { repoUrl: options.repoUrl } : {}),
    ...(options.include.length > 0 ? { includeTypes: options.include } : {}),
  });

  const reader = new RealGitReader(resolve(options.cwd));
  const { data } = await generateChangelog(reader, config, {
    ...(options.from ? { from: options.from } : {}),
    ...(options.to ? { to: options.to } : {}),
    ...(options.version ? { version: options.version } : {}),
  });

  const rendered = options.format === 'json' ? renderJson(data) : renderMarkdown(data);

  if (options.prepend) {
    if (options.format !== 'markdown') {
      throw new Error('--prepend only supports --format markdown');
    }
    const path = resolve(options.prepend);
    let existing: string | undefined;
    try {
      existing = await readFile(path, 'utf8');
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== 'ENOENT') throw err;
    }
    const merged = prependRelease(existing, rendered);
    await writeFile(path, merged, 'utf8');
    process.stdout.write(`Updated ${path}\n`);
    return 0;
  }

  if (options.out) {
    await writeFile(resolve(options.out), rendered, 'utf8');
    process.stdout.write(`Wrote ${resolve(options.out)}\n`);
    return 0;
  }

  process.stdout.write(rendered);
  return 0;
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    });
}
