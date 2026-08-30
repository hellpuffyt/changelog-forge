const DEFAULT_HEADER = '# Changelog\n\nAll notable changes to this project are documented in this file.\n';

/**
 * Inserts a newly rendered release section into an existing CHANGELOG.md, above all previous
 * releases, without disturbing them. If the file doesn't exist yet (or has no `# Changelog`
 * heading), a standard header is created first.
 */
export function prependRelease(existing: string | undefined, newSection: string): string {
  const trimmedNew = newSection.trimEnd();

  if (existing === undefined || existing.trim().length === 0) {
    return `${DEFAULT_HEADER}\n${trimmedNew}\n`;
  }

  const lines = existing.split('\n');
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line));

  if (headingIndex === -1) {
    // No top-level heading: keep the file's content untouched, insert a fresh header above it.
    return `${DEFAULT_HEADER}\n${trimmedNew}\n\n${existing.trimEnd()}\n`;
  }

  // Find the first "## " release heading; everything before it (the top header + any preamble)
  // is preserved verbatim, and the new section is inserted right before it.
  let insertAt = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i] ?? '')) {
      insertAt = i;
      break;
    }
  }

  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);

  // Trim trailing blank lines from "before" so we control spacing precisely.
  while (before.length > 0 && before[before.length - 1]?.trim() === '') {
    before.pop();
  }

  const beforeText = before.join('\n');
  const afterText = after.join('\n').trimEnd();

  const parts = [beforeText, '', trimmedNew];
  if (afterText.length > 0) {
    parts.push('', afterText);
  }
  return parts.join('\n') + '\n';
}
