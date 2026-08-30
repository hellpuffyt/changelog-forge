import { describe, expect, it } from 'vitest';
import { parseCommit } from '../src/parser.js';
import { makeCommit } from './helpers.js';

describe('parseCommit', () => {
  it('parses a simple feat commit', () => {
    const result = parseCommit(makeCommit({ message: 'feat: add login page' }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.type).toBe('feat');
    expect(result.commit.scope).toBeUndefined();
    expect(result.commit.subject).toBe('add login page');
    expect(result.commit.section).toBe('feat');
    expect(result.commit.breaking).toBe(false);
  });

  it('parses type(scope): subject', () => {
    const result = parseCommit(makeCommit({ message: 'fix(auth): handle expired tokens' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.type).toBe('fix');
    expect(result.commit.scope).toBe('auth');
    expect(result.commit.section).toBe('fix');
  });

  it('parses type(scope)!: subject as breaking via bang', () => {
    const result = parseCommit(makeCommit({ message: 'feat(api)!: remove v1 endpoints' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.breaking).toBe(true);
    expect(result.commit.section).toBe('breaking');
    expect(result.commit.breakingNote).toBe('remove v1 endpoints');
  });

  it('parses type!: subject (no scope) as breaking', () => {
    const result = parseCommit(makeCommit({ message: 'refactor!: drop node 16 support' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.breaking).toBe(true);
    expect(result.commit.type).toBe('refactor');
  });

  it('parses BREAKING CHANGE footer without bang', () => {
    const message = [
      'feat(config): support yaml config files',
      '',
      'Adds a new loader.',
      '',
      'BREAKING CHANGE: the config file must now be named config.yaml, not config.json.',
    ].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.breaking).toBe(true);
    expect(result.commit.section).toBe('breaking');
    expect(result.commit.breakingNote).toBe(
      'the config file must now be named config.yaml, not config.json.'
    );
    expect(result.commit.body).toBe('Adds a new loader.');
  });

  it('parses BREAKING-CHANGE footer (hyphenated form)', () => {
    const message = [
      'feat: new plugin system',
      '',
      'BREAKING-CHANGE: plugins must export a default function now.',
    ].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.breaking).toBe(true);
    expect(result.commit.breakingNote).toBe('plugins must export a default function now.');
  });

  it('treats bang + BREAKING CHANGE footer as breaking with footer note winning', () => {
    const message = [
      'feat(cli)!: change default output format',
      '',
      'BREAKING CHANGE: JSON is no longer the default; pass --format json explicitly.',
    ].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.breaking).toBe(true);
    expect(result.commit.breakingNote).toBe(
      'JSON is no longer the default; pass --format json explicitly.'
    );
  });

  it('falls back to the subject as the breaking note when only "!" is used', () => {
    const result = parseCommit(makeCommit({ message: 'feat!: rewrite the query engine' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.breakingNote).toBe('rewrite the query engine');
  });

  it('parses a multi-line BREAKING CHANGE footer with folded continuation lines', () => {
    const message = [
      'feat(api)!: new pagination format',
      '',
      'BREAKING CHANGE: `page` and `perPage` query params are removed.',
      'Use `cursor` and `limit` instead.',
      'See the migration guide for examples.',
    ].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.breakingNote).toContain('Use `cursor` and `limit` instead.');
    expect(result.commit.breakingNote).toContain('See the migration guide for examples.');
  });

  it('parses body and multiple footers together', () => {
    const message = [
      'fix(parser): handle trailing commas',
      '',
      'This fixes a crash when parsing arrays with a trailing comma.',
      '',
      'Reviewed-by: Grace Hopper',
      'Refs: #42',
    ].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.body).toBe('This fixes a crash when parsing arrays with a trailing comma.');
    expect(result.commit.footers).toEqual([
      { key: 'Reviewed-by', value: 'Grace Hopper' },
      { key: 'Refs', value: '#42' },
    ]);
    expect(result.commit.issueNumbers).toContain(42);
  });

  it('extracts PR numbers from "(#123)" in the subject', () => {
    const result = parseCommit(makeCommit({ message: 'fix: correct rounding error (#123)' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.prNumbers).toEqual([123]);
  });

  it('does not double-count a PR number as an issue number', () => {
    const message = ['fix: correct rounding error (#123)', '', 'Closes #123.'].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.prNumbers).toEqual([123]);
    expect(result.commit.issueNumbers).toEqual([]);
  });

  it('detects a revert target sha from "This reverts commit"', () => {
    const message = [
      'revert: feat: add experimental cache',
      '',
      'This reverts commit abc1234567890abc1234567890abc1234567890.',
    ].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.type).toBe('revert');
    expect(result.commit.section).toBe('revert');
    expect(result.commit.revertsSha).toBe('abc1234567890abc1234567890abc1234567890');
  });

  it('maps perf and deprecate types to their sections', () => {
    const perf = parseCommit(makeCommit({ message: 'perf(db): use an index for lookups' }));
    const deprecate = parseCommit(makeCommit({ message: 'deprecate(sdk): old client is deprecated' }));
    if (!perf.ok || !deprecate.ok) throw new Error('expected ok');
    expect(perf.commit.section).toBe('perf');
    expect(deprecate.commit.section).toBe('deprecate');
  });

  it('maps unrecognized types to "other"', () => {
    const result = parseCommit(makeCommit({ message: 'docs: update README' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.section).toBe('other');
  });

  it('rejects a commit with no colon in the header', () => {
    const result = parseCommit(makeCommit({ message: 'just a random commit message' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a commit with an empty message', () => {
    const result = parseCommit(makeCommit({ message: '   ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a header with a space before the colon (invalid type token)', () => {
    const result = parseCommit(makeCommit({ message: 'feat : missing tight colon' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a header with an empty subject', () => {
    const result = parseCommit(makeCommit({ message: 'feat: ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a header with an empty scope subject after trimming', () => {
    // "feat:" with no space is not a valid conventional commit header.
    const result = parseCommit(makeCommit({ message: 'feat:no-space-after-colon' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a type containing invalid characters', () => {
    const result = parseCommit(makeCommit({ message: 'fe@t: something' }));
    expect(result.ok).toBe(false);
  });

  it('never throws on malformed input, only returns a skip reason', () => {
    const inputs = ['', '   \n\n  ', 'random text\nwith\nnewlines', ':::', 'a:b:c:d'];
    for (const message of inputs) {
      expect(() => parseCommit(makeCommit({ message }))).not.toThrow();
    }
  });

  it('does not treat a footer-shaped line inside the body as a footer if not trailing', () => {
    const message = [
      'feat: add retry logic',
      '',
      'Note: retries use exponential backoff.',
      '',
      'This is unrelated free-form text after what looks like a footer line.',
    ].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    // The trailing paragraph is plain text, not footer-shaped, so nothing is extracted as a footer.
    expect(result.commit.footers).toEqual([]);
    expect(result.commit.body).toContain('Note: retries use exponential backoff.');
  });

  it('parses a footer using the " #" separator form', () => {
    const message = ['fix: close socket on error', '', 'Refs #99'].join('\n');
    const result = parseCommit(makeCommit({ message }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.footers).toEqual([{ key: 'Refs', value: '99' }]);
  });

  it('handles CRLF line endings', () => {
    const result = parseCommit(makeCommit({ message: 'feat: crlf support\r\n\r\nBody text.\r\n' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.subject).toBe('crlf support');
    expect(result.commit.body).toBe('Body text.');
  });

  it('lowercases the type but preserves subject casing', () => {
    const result = parseCommit(makeCommit({ message: 'FEAT: Add Support For X' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.type).toBe('feat');
    expect(result.commit.subject).toBe('Add Support For X');
  });

  it('trims whitespace around the scope', () => {
    const result = parseCommit(makeCommit({ message: 'fix( auth ): trims scope' }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.commit.scope).toBe('auth');
  });
});
