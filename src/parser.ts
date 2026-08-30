import type { CommitSection, Footer, ParsedCommit, RawCommit, SkippedCommit } from './types.js';

const HEADER_RE = /^([A-Za-z][A-Za-z0-9]*)(\(([^)]+)\))?(!)?:[ \t](.+)$/;

// A footer token is either "Word-word" or the special "BREAKING CHANGE" (with a literal space).
const FOOTER_LINE_RE = /^(BREAKING CHANGE|BREAKING-CHANGE|[A-Za-z0-9][A-Za-z0-9-]*)(: | #)(.*)$/;

const PR_REF_RE = /\(#(\d+)\)/g;
const ISSUE_REF_RE = /#(\d+)/g;
const REVERTS_RE = /This reverts commit ([0-9a-f]{7,40})/i;

const SECTION_BY_TYPE: Record<string, CommitSection> = {
  feat: 'feat',
  feature: 'feat',
  fix: 'fix',
  bugfix: 'fix',
  perf: 'perf',
  performance: 'perf',
  revert: 'revert',
  reverts: 'revert',
  deprecate: 'deprecate',
  deprecated: 'deprecate',
  deprecation: 'deprecate',
};

export type ParseResult =
  | { ok: true; commit: ParsedCommit }
  | { ok: false; skipped: SkippedCommit };

/**
 * Parses a single raw commit as a conventional commit.
 * Never throws: malformed commits come back as `{ ok: false }` with a human-readable reason
 * so callers can skip them instead of crashing on real-world commit history.
 */
export function parseCommit(raw: RawCommit): ParseResult {
  const message = raw.message.replace(/\r\n/g, '\n').trimEnd();
  if (message.trim().length === 0) {
    return { ok: false, skipped: { raw, reason: 'empty commit message' } };
  }

  const lines = message.split('\n');
  const headerLine = lines[0] ?? '';
  const headerMatch = HEADER_RE.exec(headerLine.trim());
  if (!headerMatch) {
    return { ok: false, skipped: { raw, reason: 'header does not match "type(scope)!: subject"' } };
  }

  const [, rawType, , rawScope, bang, subject] = headerMatch;
  if (!rawType || subject === undefined || subject.trim().length === 0) {
    return { ok: false, skipped: { raw, reason: 'missing type or subject' } };
  }

  const type = rawType.toLowerCase();
  const scope = rawScope?.trim() ? rawScope.trim() : undefined;

  const rest = lines.slice(1).join('\n').trim();
  const paragraphs = rest.length > 0 ? rest.split(/\n{2,}/) : [];

  const { body, footers } = extractFooters(paragraphs);

  let breaking = bang === '!';
  let breakingNote: string | undefined;
  for (const footer of footers) {
    const normalizedKey = footer.key.toUpperCase().replace('-', ' ');
    if (normalizedKey === 'BREAKING CHANGE') {
      breaking = true;
      breakingNote = footer.value.trim();
    }
  }
  if (breaking && !breakingNote) {
    // "!" marker with no footer body: fall back to the subject so a migration note is never empty.
    breakingNote = subject.trim();
  }

  const section: CommitSection = breaking
    ? 'breaking'
    : (SECTION_BY_TYPE[type] ?? 'other');

  const prNumbers = uniqueNumbers(subject.matchAll(PR_REF_RE));
  const issueSource = `${body ?? ''}\n${footers.map((f) => f.value).join('\n')}`;
  const issueNumbers = uniqueNumbers(issueSource.matchAll(ISSUE_REF_RE)).filter(
    (n) => !prNumbers.includes(n)
  );

  const revertsMatch = REVERTS_RE.exec(`${body ?? ''}\n${footers.map((f) => f.value).join('\n')}`);

  const commit: ParsedCommit = {
    raw,
    type,
    ...(scope !== undefined ? { scope } : {}),
    breaking,
    ...(breakingNote !== undefined ? { breakingNote } : {}),
    subject: subject.trim(),
    ...(body !== undefined ? { body } : {}),
    footers,
    section,
    ...(revertsMatch?.[1] !== undefined ? { revertsSha: revertsMatch[1] } : {}),
    prNumbers,
    issueNumbers,
  };

  return { ok: true, commit };
}

function uniqueNumbers(matches: IterableIterator<RegExpMatchArray>): number[] {
  const seen = new Set<number>();
  for (const m of matches) {
    const raw = m[1];
    if (raw === undefined) continue;
    seen.add(Number(raw));
  }
  return [...seen];
}

/**
 * Splits the paragraphs following the header into a free-text body and a trailing block of
 * git-trailer-style footers. Only a contiguous run of footer paragraphs at the very end counts;
 * a footer-shaped line at the top of the body (rare, but possible) is left as body text.
 */
function extractFooters(paragraphs: string[]): { body?: string; footers: Footer[] } {
  if (paragraphs.length === 0) return { footers: [] };

  // Find the longest trailing run of paragraphs that are entirely footer blocks.
  let splitIndex = paragraphs.length;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const para = paragraphs[i];
    if (para !== undefined && isFooterParagraph(para)) {
      splitIndex = i;
    } else {
      break;
    }
  }

  const bodyParagraphs = paragraphs.slice(0, splitIndex);
  const footerParagraphs = paragraphs.slice(splitIndex);

  const footers: Footer[] = [];
  for (const para of footerParagraphs) {
    footers.push(...parseFooterParagraph(para));
  }

  const body = bodyParagraphs.length > 0 ? bodyParagraphs.join('\n\n').trim() : undefined;
  return body !== undefined ? { body, footers } : { footers };
}

function isFooterParagraph(paragraph: string): boolean {
  const lines = paragraph.split('\n');
  const first = lines[0];
  if (first === undefined || !FOOTER_LINE_RE.test(first)) return false;
  // Continuation lines (folded values) don't need to match; only the first line of the
  // paragraph must look like a footer for the whole paragraph to count as footer text.
  return true;
}

function parseFooterParagraph(paragraph: string): Footer[] {
  const lines = paragraph.split('\n');
  const footers: Footer[] = [];
  for (const line of lines) {
    const match = FOOTER_LINE_RE.exec(line);
    if (match?.[1] !== undefined && match[3] !== undefined) {
      footers.push({ key: match[1], value: match[3] });
    } else if (footers.length > 0) {
      // Continuation of the previous footer's (folded) value.
      const last = footers[footers.length - 1];
      if (last) last.value = `${last.value}\n${line}`;
    }
  }
  return footers;
}
