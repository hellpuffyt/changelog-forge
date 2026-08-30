import type { ChangelogData } from '../types.js';
import { LinkBuilder } from '../links.js';

export interface JsonEntry {
  subject: string;
  scope?: string;
  sha: string;
  shortSha: string;
  shaUrl?: string;
  prNumbers: number[];
  issueNumbers: number[];
  breakingNote?: string;
  author: { name: string; email: string };
  date: string;
}

export interface JsonSection {
  id: string;
  title: string;
  groups: { scope?: string; entries: JsonEntry[] }[];
}

export interface JsonChangelog {
  version?: string;
  bump: ChangelogData['bump'];
  date: string;
  from?: string;
  to: string;
  sections: JsonSection[];
  contributors: { name: string; email: string }[];
  skipped: { sha: string; reason: string }[];
}

export function toJsonChangelog(data: ChangelogData): JsonChangelog {
  const links = new LinkBuilder(data.repoUrl);

  const sections: JsonSection[] = data.sections.map((section) => ({
    id: section.id,
    title: section.title,
    groups: section.groups.map((group) => ({
      ...(group.scope !== undefined ? { scope: group.scope } : {}),
      entries: group.entries.map(({ commit }) => {
        const shaUrl = links.commit(commit.raw.sha);
        return {
          subject: commit.subject,
          ...(commit.scope !== undefined ? { scope: commit.scope } : {}),
          sha: commit.raw.sha,
          shortSha: commit.raw.shortSha,
          ...(shaUrl !== undefined ? { shaUrl } : {}),
          prNumbers: commit.prNumbers,
          issueNumbers: commit.issueNumbers,
          ...(commit.breakingNote !== undefined ? { breakingNote: commit.breakingNote } : {}),
          author: commit.raw.author,
          date: commit.raw.date,
        };
      }),
    })),
  }));

  return {
    ...(data.version !== undefined ? { version: data.version } : {}),
    bump: data.bump,
    date: data.date,
    ...(data.from !== undefined ? { from: data.from } : {}),
    to: data.to,
    sections,
    contributors: data.contributors,
    skipped: data.skipped.map((s) => ({ sha: s.raw.sha, reason: s.reason })),
  };
}

export function renderJson(data: ChangelogData): string {
  return JSON.stringify(toJsonChangelog(data), null, 2) + '\n';
}
