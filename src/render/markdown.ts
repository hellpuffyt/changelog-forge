import type { ChangelogData, ParsedCommit } from '../types.js';
import { LinkBuilder } from '../links.js';

/** Renders a ChangelogData as a Keep a Changelog-shaped Markdown release section. */
export function renderMarkdown(data: ChangelogData): string {
  const links = new LinkBuilder(data.repoUrl);
  const lines: string[] = [];

  const heading = data.version ? `[${data.version}]` : `[Unreleased]`;
  lines.push(`## ${heading} - ${data.date}`);
  lines.push('');
  lines.push(`_Recommended bump: **${data.bump}**._`);
  lines.push('');

  if (data.sections.length === 0) {
    lines.push('No user-facing changes.');
    lines.push('');
  }

  for (const section of data.sections) {
    lines.push(`### ${section.title}`);
    lines.push('');
    for (const group of section.groups) {
      if (group.scope) {
        lines.push(`#### ${group.scope}`);
        lines.push('');
      }
      for (const entry of group.entries) {
        lines.push(renderEntryLine(entry.commit, links));
        if (section.id === 'breaking' && entry.commit.breakingNote) {
          lines.push('');
          for (const noteLine of entry.commit.breakingNote.split('\n')) {
            lines.push(`  ${noteLine}`.trimEnd());
          }
        }
      }
      lines.push('');
    }
  }

  if (data.contributors.length > 0) {
    lines.push('### Contributors');
    lines.push('');
    for (const contributor of data.contributors) {
      lines.push(`- ${contributor.name}`);
    }
    lines.push('');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function renderEntryLine(commit: ParsedCommit, links: LinkBuilder): string {
  const subject = commit.subject;
  const refs = renderRefs(commit, links);
  const shaLink = links.commit(commit.raw.sha);
  const shaText = shaLink ? `[\`${commit.raw.shortSha}\`](${shaLink})` : `\`${commit.raw.shortSha}\``;
  const suffix = [refs, shaText].filter(Boolean).join(' ');
  return `- ${subject} (${suffix})`;
}

function renderRefs(commit: ParsedCommit, links: LinkBuilder): string {
  const parts: string[] = [];
  for (const pr of commit.prNumbers) {
    const link = links.pull(pr);
    parts.push(link ? `[#${pr}](${link})` : `#${pr}`);
  }
  for (const issue of commit.issueNumbers) {
    const link = links.issue(issue);
    parts.push(link ? `[#${issue}](${link})` : `#${issue}`);
  }
  return parts.join(', ');
}
