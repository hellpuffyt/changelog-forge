import { readFile } from 'node:fs/promises';
import type { ForgeConfig } from './types.js';

export const DEFAULT_EXCLUDED_TYPES = ['chore', 'ci', 'style', 'test'];

export const DEFAULT_BOT_PATTERNS = [
  '\\[bot\\]$',
  '^dependabot',
  '^renovate',
  '^github-actions',
  'noreply@github\\.com$',
];

export function defaultConfig(): ForgeConfig {
  return {
    scopeAliases: {},
    botPatterns: [...DEFAULT_BOT_PATTERNS],
    excludeTypes: [...DEFAULT_EXCLUDED_TYPES],
    includeTypes: [],
  };
}

/** Loads and merges a JSON config file over the defaults. Missing files are not an error. */
export async function loadConfig(path?: string): Promise<ForgeConfig> {
  const base = defaultConfig();
  if (!path) return base;

  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') return base;
    throw err;
  }

  const parsed: unknown = JSON.parse(text);
  return mergeConfig(base, parsed);
}

export function mergeConfig(base: ForgeConfig, override: unknown): ForgeConfig {
  if (typeof override !== 'object' || override === null) return base;
  const o = override as Record<string, unknown>;

  const merged: ForgeConfig = {
    scopeAliases: { ...base.scopeAliases },
    botPatterns: [...base.botPatterns],
    excludeTypes: [...base.excludeTypes],
    includeTypes: [...base.includeTypes],
    ...(base.repoUrl !== undefined ? { repoUrl: base.repoUrl } : {}),
  };

  if (typeof o['repoUrl'] === 'string') merged.repoUrl = o['repoUrl'];
  if (isStringRecord(o['scopeAliases'])) {
    merged.scopeAliases = { ...merged.scopeAliases, ...o['scopeAliases'] };
  }
  if (isStringArray(o['botPatterns'])) merged.botPatterns = o['botPatterns'];
  if (isStringArray(o['excludeTypes'])) merged.excludeTypes = o['excludeTypes'];
  if (isStringArray(o['includeTypes'])) merged.includeTypes = o['includeTypes'];

  return merged;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === 'string')
  );
}

/** Resolves the effective set of excluded types after applying `includeTypes` overrides. */
export function effectiveExcludedTypes(config: ForgeConfig): Set<string> {
  const excluded = new Set(config.excludeTypes.map((t) => t.toLowerCase()));
  for (const included of config.includeTypes) {
    excluded.delete(included.toLowerCase());
  }
  return excluded;
}

export function resolveScope(config: ForgeConfig, scope: string | undefined): string | undefined {
  if (!scope) return undefined;
  return config.scopeAliases[scope] ?? scope;
}

export function isBot(config: ForgeConfig, name: string, email: string): boolean {
  return config.botPatterns.some((pattern) => {
    try {
      const re = new RegExp(pattern, 'i');
      return re.test(name) || re.test(email);
    } catch {
      return false;
    }
  });
}
