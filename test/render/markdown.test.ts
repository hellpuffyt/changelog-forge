import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/render/markdown.js';
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

describe('renderMarkdown', () => {
  it('renders breaking changes first with the migration note indented beneath the entry', () => {
    const config = { ...defaultConfig(), repoUrl: 'https://github.com/o/r' };
    const commits = [
      commit('fix: minor fix'),
      commit('feat(api)!: remove legacy endpoints\n\nBREAKING CHANGE: use /v2 instead of /v1.'),
    ];
    const data: ChangelogData = {
      bump: 'major',
      version: '2.0.0',
      date: '2026-03-01',
      to: 'HEAD',
      sections: buildSections(commits, config),
      contributors: [],
      skipped: [],
      repoUrl: config.repoUrl,
    };
    const output = renderMarkdown(data);

    const breakingIndex = output.indexOf('BREAKING CHANGES');
    const fixIndex = output.indexOf('Bug Fixes');
    expect(breakingIndex).toBeGreaterThanOrEqual(0);
    expect(fixIndex).toBeGreaterThan(breakingIndex);
    expect(output).toContain('use /v2 instead of /v1.');
    expect(output).toContain('[2.0.0]');
    expect(output).toContain('Recommended bump: **major**');
  });

  it('links commit sha, PR numbers, and issue numbers when a repo URL is set', () => {
    const config = { ...defaultConfig(), repoUrl: 'https://github.com/o/r' };
    const commits = [commit('fix: correct math (#5)')];
    const data: ChangelogData = {
      bump: 'patch',
      date: '2026-03-01',
      to: 'HEAD',
      sections: buildSections(commits, config),
      contributors: [],
      skipped: [],
      repoUrl: config.repoUrl,
    };
    const output = renderMarkdown(data);
    expect(output).toContain('https://github.com/o/r/pull/5');
    expect(output).toContain('https://github.com/o/r/commit/');
  });

  it('omits links when no repo URL is configured', () => {
    const config = defaultConfig();
    const commits = [commit('fix: correct math (#5)')];
    const data: ChangelogData = {
      bump: 'patch',
      date: '2026-03-01',
      to: 'HEAD',
      sections: buildSections(commits, config),
      contributors: [],
      skipped: [],
    };
    const output = renderMarkdown(data);
    expect(output).not.toContain('](');
  });

  it('renders a contributors section, and omits it when empty', () => {
    const withContributors = renderMarkdown({
      bump: 'none',
      date: '2026-03-01',
      to: 'HEAD',
      sections: [],
      contributors: [{ name: 'Ada Lovelace', email: 'ada@example.com' }],
      skipped: [],
    });
    expect(withContributors).toContain('### Contributors');
    expect(withContributors).toContain('- Ada Lovelace');

    const withoutContributors = renderMarkdown({
      bump: 'none',
      date: '2026-03-01',
      to: 'HEAD',
      sections: [],
      contributors: [],
      skipped: [],
    });
    expect(withoutContributors).not.toContain('### Contributors');
  });

  it('shows "No user-facing changes." when there are no sections', () => {
    const output = renderMarkdown({
      bump: 'none',
      date: '2026-03-01',
      to: 'HEAD',
      sections: [],
      contributors: [],
      skipped: [],
    });
    expect(output).toContain('No user-facing changes.');
  });

  it('renders "[Unreleased]" when no version is set', () => {
    const output = renderMarkdown({
      bump: 'none',
      date: '2026-03-01',
      to: 'HEAD',
      sections: [],
      contributors: [],
      skipped: [],
    });
    expect(output).toContain('[Unreleased]');
  });

  it('renders scope headings within a section', () => {
    const config = defaultConfig();
    const commits = [commit('feat(auth): login'), commit('feat(billing): invoices')];
    const data: ChangelogData = {
      bump: 'minor',
      date: '2026-03-01',
      to: 'HEAD',
      sections: buildSections(commits, config),
      contributors: [],
      skipped: [],
    };
    const output = renderMarkdown(data);
    expect(output).toContain('#### auth');
    expect(output).toContain('#### billing');
  });
});
