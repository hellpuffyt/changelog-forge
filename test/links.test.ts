import { describe, expect, it } from 'vitest';
import { LinkBuilder } from '../src/links.js';

describe('LinkBuilder', () => {
  it('builds commit, pull, and issue links from a repo URL', () => {
    const links = new LinkBuilder('https://github.com/owner/repo');
    expect(links.commit('abc123')).toBe('https://github.com/owner/repo/commit/abc123');
    expect(links.pull(42)).toBe('https://github.com/owner/repo/pull/42');
    expect(links.issue(7)).toBe('https://github.com/owner/repo/issues/7');
  });

  it('strips a trailing slash from the repo URL', () => {
    const links = new LinkBuilder('https://github.com/owner/repo/');
    expect(links.commit('abc123')).toBe('https://github.com/owner/repo/commit/abc123');
  });

  it('returns undefined for all link kinds when no repo URL is configured', () => {
    const links = new LinkBuilder(undefined);
    expect(links.commit('abc123')).toBeUndefined();
    expect(links.pull(1)).toBeUndefined();
    expect(links.issue(1)).toBeUndefined();
  });
});
