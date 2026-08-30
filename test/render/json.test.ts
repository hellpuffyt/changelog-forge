import { describe, expect, it } from 'vitest';
import { renderJson, toJsonChangelog } from '../../src/render/json.js';
import { buildSections } from '../../src/grouping.js';
import { defaultConfig } from '../../src/config.js';
import { parseCommit } from '../../src/parser.js';
import { makeCommit } from '../helpers.js';
import type { ChangelogData } from '../../src/types.js';

function commit(message: string) {
  const result = parseCommit(makeCommit({ message }));
  if (!result.ok) throw new Error('expected a valid commit');
  return result.commit;
}

describe('toJsonChangelog / renderJson', () => {
  it('produces valid JSON that round-trips through JSON.parse', () => {
    const config = { ...defaultConfig(), repoUrl: 'https://github.com/o/r' };
    const commits = [commit('feat(api)!: v2\n\nBREAKING CHANGE: drop v1.'), commit('fix: bug (#9)')];
    const data: ChangelogData = {
      bump: 'major',
      version: '2.0.0',
      date: '2026-03-01',
      to: 'HEAD',
      sections: buildSections(commits, config),
      contributors: [{ name: 'Ada', email: 'ada@example.com' }],
      skipped: [],
      repoUrl: config.repoUrl,
    };
    const text = renderJson(data);
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toBeTruthy();
  });

  it('includes the breaking note and version/bump fields', () => {
    const config = defaultConfig();
    const commits = [commit('feat!: rewrite\n\nBREAKING CHANGE: everything changed.')];
    const json = toJsonChangelog({
      bump: 'major',
      version: '3.0.0',
      date: '2026-03-01',
      to: 'HEAD',
      sections: buildSections(commits, config),
      contributors: [],
      skipped: [],
    });
    expect(json.version).toBe('3.0.0');
    expect(json.bump).toBe('major');
    const entry = json.sections[0]?.groups[0]?.entries[0];
    expect(entry?.breakingNote).toBe('everything changed.');
  });

  it('includes skipped commits with their reason', () => {
    const json = toJsonChangelog({
      bump: 'none',
      date: '2026-03-01',
      to: 'HEAD',
      sections: [],
      contributors: [],
      skipped: [{ raw: makeCommit({ message: 'not conventional' }), reason: 'header does not match' }],
    });
    expect(json.skipped).toHaveLength(1);
    expect(json.skipped[0]?.reason).toBe('header does not match');
  });

  it('omits shaUrl when there is no repo URL', () => {
    const config = defaultConfig();
    const commits = [commit('fix: x')];
    const json = toJsonChangelog({
      bump: 'patch',
      date: '2026-03-01',
      to: 'HEAD',
      sections: buildSections(commits, config),
      contributors: [],
      skipped: [],
    });
    const entry = json.sections[0]?.groups[0]?.entries[0];
    expect(entry?.shaUrl).toBeUndefined();
  });
});
