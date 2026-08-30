import { describe, expect, it } from 'vitest';
import { prependRelease } from '../src/prepend.js';

describe('prependRelease', () => {
  it('creates a fresh changelog when none exists', () => {
    const result = prependRelease(undefined, '## [1.0.0] - 2026-01-01\n\n### Features\n\n- thing\n');
    expect(result).toContain('# Changelog');
    expect(result).toContain('## [1.0.0] - 2026-01-01');
  });

  it('creates a fresh changelog for an empty existing file', () => {
    const result = prependRelease('   \n', '## [1.0.0] - 2026-01-01\n');
    expect(result.startsWith('# Changelog')).toBe(true);
  });

  it('inserts the new release above existing releases, preserving them exactly', () => {
    const existing = [
      '# Changelog',
      '',
      'All notable changes.',
      '',
      '## [1.0.0] - 2026-01-01',
      '',
      '### Features',
      '',
      '- original entry',
      '',
    ].join('\n');
    const newSection = '## [1.1.0] - 2026-02-01\n\n### Features\n\n- new entry\n';

    const result = prependRelease(existing, newSection);

    const oldReleaseIndex = result.indexOf('## [1.0.0]');
    const newReleaseIndex = result.indexOf('## [1.1.0]');
    expect(newReleaseIndex).toBeGreaterThanOrEqual(0);
    expect(oldReleaseIndex).toBeGreaterThan(newReleaseIndex);
    expect(result).toContain('- original entry');
    expect(result).toContain('- new entry');
    // The exact old release block, verbatim, must still be present.
    expect(result).toContain('## [1.0.0] - 2026-01-01\n\n### Features\n\n- original entry');
  });

  it('preserves preamble text between the top heading and the first release', () => {
    const existing = '# Changelog\n\nSome preamble text.\n\n## [1.0.0] - 2026-01-01\n\n- x\n';
    const result = prependRelease(existing, '## [2.0.0] - 2026-03-01\n\n- y\n');
    expect(result).toContain('Some preamble text.');
    expect(result.indexOf('Some preamble text.')).toBeLessThan(result.indexOf('## [2.0.0]'));
  });

  it('adds a header when the existing file has no top-level heading', () => {
    const existing = 'Just some notes, no heading.\n';
    const result = prependRelease(existing, '## [1.0.0] - 2026-01-01\n\n- x\n');
    expect(result.startsWith('# Changelog')).toBe(true);
    expect(result).toContain('Just some notes, no heading.');
  });

  it('handles a changelog file that only has the header and no releases yet', () => {
    const existing = '# Changelog\n\nAll notable changes.\n';
    const result = prependRelease(existing, '## [1.0.0] - 2026-01-01\n\n- x\n');
    expect(result).toContain('All notable changes.');
    expect(result).toContain('## [1.0.0] - 2026-01-01');
  });

  it('does not mutate byte-for-byte content of unrelated later releases', () => {
    const olderRelease = '## [0.9.0] - 2025-12-01\n\n### Fixes\n\n- weird   spacing   preserved\n';
    const existing = `# Changelog\n\n${olderRelease}`;
    const result = prependRelease(existing, '## [1.0.0] - 2026-01-01\n\n- x\n');
    expect(result).toContain('weird   spacing   preserved');
  });
});
