import { describe, expect, it } from 'vitest';
import { effectiveExcludedTypes, isBot, mergeConfig, defaultConfig, resolveScope } from '../src/config.js';

describe('mergeConfig', () => {
  it('merges scope aliases over defaults', () => {
    const merged = mergeConfig(defaultConfig(), { scopeAliases: { fe: 'frontend' } });
    expect(merged.scopeAliases).toEqual({ fe: 'frontend' });
  });

  it('overrides excludeTypes entirely when provided', () => {
    const merged = mergeConfig(defaultConfig(), { excludeTypes: ['chore'] });
    expect(merged.excludeTypes).toEqual(['chore']);
  });

  it('sets repoUrl', () => {
    const merged = mergeConfig(defaultConfig(), { repoUrl: 'https://github.com/o/r' });
    expect(merged.repoUrl).toBe('https://github.com/o/r');
  });

  it('ignores non-object overrides', () => {
    expect(mergeConfig(defaultConfig(), null)).toEqual(defaultConfig());
    expect(mergeConfig(defaultConfig(), 'nonsense')).toEqual(defaultConfig());
  });

  it('ignores malformed fields (wrong types)', () => {
    const merged = mergeConfig(defaultConfig(), { excludeTypes: 'not-an-array', repoUrl: 42 });
    expect(merged.excludeTypes).toEqual(defaultConfig().excludeTypes);
    expect(merged.repoUrl).toBeUndefined();
  });
});

describe('effectiveExcludedTypes', () => {
  it('excludes default types', () => {
    const excluded = effectiveExcludedTypes(defaultConfig());
    expect(excluded.has('chore')).toBe(true);
    expect(excluded.has('feat')).toBe(false);
  });

  it('removes types listed in includeTypes', () => {
    const config = { ...defaultConfig(), includeTypes: ['chore'] };
    const excluded = effectiveExcludedTypes(config);
    expect(excluded.has('chore')).toBe(false);
    expect(excluded.has('ci')).toBe(true);
  });
});

describe('resolveScope', () => {
  it('returns the alias when one is configured', () => {
    const config = { ...defaultConfig(), scopeAliases: { fe: 'frontend' } };
    expect(resolveScope(config, 'fe')).toBe('frontend');
  });

  it('returns the raw scope when no alias exists', () => {
    expect(resolveScope(defaultConfig(), 'auth')).toBe('auth');
  });

  it('returns undefined for an undefined scope', () => {
    expect(resolveScope(defaultConfig(), undefined)).toBeUndefined();
  });
});

describe('isBot', () => {
  it('matches against name or email', () => {
    const config = defaultConfig();
    expect(isBot(config, 'dependabot[bot]', 'x@y.com')).toBe(true);
    expect(isBot(config, 'Human', 'human@noreply.github.com')).toBe(false);
    expect(isBot(config, 'Someone', 'someone@users.noreply.github.com')).toBe(false);
  });

  it('ignores an invalid regex pattern instead of throwing', () => {
    const config = { ...defaultConfig(), botPatterns: ['[invalid('] };
    expect(() => isBot(config, 'anyone', 'anyone@example.com')).not.toThrow();
    expect(isBot(config, 'anyone', 'anyone@example.com')).toBe(false);
  });
});
