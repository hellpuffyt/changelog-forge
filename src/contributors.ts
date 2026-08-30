import type { Contributor, ForgeConfig, ParsedCommit } from './types.js';
import { isBot } from './config.js';

/** Builds a deduplicated (by lower-cased email), bot-excluded contributor list, name-sorted. */
export function buildContributors(commits: ParsedCommit[], config: ForgeConfig): Contributor[] {
  const byEmail = new Map<string, Contributor>();
  for (const commit of commits) {
    const { name, email } = commit.raw.author;
    if (!name.trim() || !email.trim()) continue;
    if (isBot(config, name, email)) continue;
    const key = email.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, { name, email });
    }
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name));
}
