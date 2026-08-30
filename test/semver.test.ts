import { describe, expect, it } from 'vitest';
import { applyBump, compareSemVer, parseSemVer } from '../src/semver.js';

describe('parseSemVer', () => {
  it('parses a plain semver', () => {
    expect(parseSemVer('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], raw: '1.2.3' });
  });

  it('parses a v-prefixed semver', () => {
    const result = parseSemVer('v2.0.0');
    expect(result).toMatchObject({ major: 2, minor: 0, patch: 0 });
  });

  it('parses a prerelease semver', () => {
    const result = parseSemVer('1.0.0-rc.1');
    expect(result?.prerelease).toEqual(['rc', '1']);
  });

  it('ignores build metadata', () => {
    const result = parseSemVer('1.0.0+build.5');
    expect(result).toMatchObject({ major: 1, minor: 0, patch: 0, prerelease: [] });
  });

  it('returns undefined for non-semver tags', () => {
    expect(parseSemVer('release-2026')).toBeUndefined();
    expect(parseSemVer('latest')).toBeUndefined();
    expect(parseSemVer('1.2')).toBeUndefined();
  });
});

describe('compareSemVer', () => {
  it('orders by major, minor, patch', () => {
    expect(compareSemVer(parseSemVer('2.0.0')!, parseSemVer('1.9.9')!)).toBeGreaterThan(0);
    expect(compareSemVer(parseSemVer('1.2.0')!, parseSemVer('1.10.0')!)).toBeLessThan(0);
    expect(compareSemVer(parseSemVer('1.2.3')!, parseSemVer('1.2.4')!)).toBeLessThan(0);
  });

  it('treats a release as greater than its prerelease', () => {
    expect(compareSemVer(parseSemVer('1.0.0')!, parseSemVer('1.0.0-rc.1')!)).toBeGreaterThan(0);
  });

  it('compares prerelease identifiers numerically when both are numeric', () => {
    expect(compareSemVer(parseSemVer('1.0.0-rc.2')!, parseSemVer('1.0.0-rc.10')!)).toBeLessThan(0);
  });

  it('treats equal versions as equal', () => {
    expect(compareSemVer(parseSemVer('1.2.3')!, parseSemVer('1.2.3')!)).toBe(0);
  });
});

describe('applyBump', () => {
  const base = parseSemVer('1.2.3')!;

  it('bumps major and resets minor/patch', () => {
    expect(applyBump(base, 'major')).toBe('2.0.0');
  });

  it('bumps minor and resets patch', () => {
    expect(applyBump(base, 'minor')).toBe('1.3.0');
  });

  it('bumps patch only', () => {
    expect(applyBump(base, 'patch')).toBe('1.2.4');
  });

  it('leaves the version unchanged for "none"', () => {
    expect(applyBump(base, 'none')).toBe('1.2.3');
  });
});
