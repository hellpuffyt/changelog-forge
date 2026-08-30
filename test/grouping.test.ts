import { describe, expect, it } from 'vitest';
import { buildSections, SECTION_ORDER } from '../src/grouping.js';
import { defaultConfig } from '../src/config.js';
import { parseCommit } from '../src/parser.js';
import { makeCommit } from './helpers.js';
import type { ForgeConfig } from '../src/types.js';

function commit(message: string) {
  const result = parseCommit(makeCommit({ message }));
  if (!result.ok) throw new Error(`expected a valid commit: ${message}`);
  return result.commit;
}

describe('buildSections', () => {
  it('excludes chore/ci/style/test by default', () => {
    const config = defaultConfig();
    const commits = [
      commit('chore: bump deps'),
      commit('ci: fix pipeline'),
      commit('style: reformat'),
      commit('test: add unit test'),
      commit('feat: keep me'),
    ];
    const sections = buildSections(commits, config);
    const allSubjects = sections.flatMap((s) => s.groups.flatMap((g) => g.entries.map((e) => e.commit.subject)));
    expect(allSubjects).toEqual(['keep me']);
  });

  it('includes excluded types when overridden via includeTypes', () => {
    const config: ForgeConfig = { ...defaultConfig(), includeTypes: ['chore'] };
    const commits = [commit('chore: bump deps'), commit('style: reformat')];
    const sections = buildSections(commits, config);
    const subjects = sections.flatMap((s) => s.groups.flatMap((g) => g.entries.map((e) => e.commit.subject)));
    expect(subjects).toEqual(['bump deps']);
  });

  it('orders sections by impact: breaking, feat, fix, perf, revert, deprecate, other', () => {
    const config = defaultConfig();
    const commits = [
      commit('docs: update guide'),
      commit('perf: speed up parsing'),
      commit('fix: crash on empty input'),
      commit('feat: add export command'),
      commit('feat!: change default export format'),
    ];
    const sections = buildSections(commits, config);
    const ids = sections.map((s) => s.id);
    // Only sections with content appear, but they must respect SECTION_ORDER's relative order.
    const expectedOrder = SECTION_ORDER.filter((id) => ids.includes(id));
    expect(ids).toEqual(expectedOrder);
    expect(ids[0]).toBe('breaking');
  });

  it('puts a breaking commit only in the breaking section, not duplicated in its own type section', () => {
    const config = defaultConfig();
    const commits = [commit('feat!: overhaul the API')];
    const sections = buildSections(commits, config);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe('breaking');
  });

  it('groups entries by canonical scope, unscoped first, then alphabetical', () => {
    const config = defaultConfig();
    const commits = [
      commit('feat(zeta): z thing'),
      commit('feat: unscoped thing'),
      commit('feat(alpha): a thing'),
    ];
    const sections = buildSections(commits, config);
    const feat = sections.find((s) => s.id === 'feat');
    expect(feat?.groups.map((g) => g.scope)).toEqual([undefined, 'alpha', 'zeta']);
  });

  it('applies scope aliases when grouping', () => {
    const config: ForgeConfig = { ...defaultConfig(), scopeAliases: { fe: 'frontend', ui: 'frontend' } };
    const commits = [commit('feat(fe): a'), commit('feat(ui): b')];
    const sections = buildSections(commits, config);
    const feat = sections.find((s) => s.id === 'feat');
    expect(feat?.groups).toHaveLength(1);
    expect(feat?.groups[0]?.scope).toBe('frontend');
    expect(feat?.groups[0]?.entries).toHaveLength(2);
  });

  it('returns no sections for an empty commit list', () => {
    expect(buildSections([], defaultConfig())).toEqual([]);
  });

  it('omits sections with no matching commits', () => {
    const config = defaultConfig();
    const sections = buildSections([commit('feat: only a feature')], config);
    expect(sections.map((s) => s.id)).toEqual(['feat']);
  });
});
