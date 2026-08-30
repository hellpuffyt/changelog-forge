import type { ChangelogData, ForgeConfig, ParsedCommit, SkippedCommit, VersionBump } from './types.js';
import type { GitReader } from './git/GitReader.js';
import { parseCommit } from './parser.js';
import { cancelReverts } from './revert.js';
import { buildSections } from './grouping.js';
import { buildContributors } from './contributors.js';
import { findPreviousTag, inferBump } from './version.js';
import { applyBump, parseSemVer } from './semver.js';

export interface GenerateOptions {
  from?: string;
  to?: string;
  /** Explicit version to print instead of the inferred bump applied to the previous tag. */
  version?: string;
  /** ISO date to stamp the release with. Defaults to now. */
  date?: string;
}

export interface GenerateResult {
  data: ChangelogData;
  parsedCommits: ParsedCommit[];
  skipped: SkippedCommit[];
}

/** Parses every commit in range, then applies revert cancellation, filtering and grouping. */
export async function generateChangelog(
  reader: GitReader,
  config: ForgeConfig,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const to = options.to ?? 'HEAD';
  const resolvedTo = await reader.resolveRef(to);

  let from = options.from;
  if (!from) {
    const tags = await reader.listTags();
    const previous = findPreviousTag(tags);
    from = previous?.sha;
  }

  const rawCommits = await reader.getCommits(from ? { from, to: resolvedTo } : { to: resolvedTo });

  const parsed: ParsedCommit[] = [];
  const skipped: SkippedCommit[] = [];
  for (const raw of rawCommits) {
    const result = parseCommit(raw);
    if (result.ok) {
      parsed.push(result.commit);
    } else {
      skipped.push(result.skipped);
    }
  }

  const deduped = cancelReverts(parsed);
  const bump = inferBump(deduped);
  const sections = buildSections(deduped, config);
  const contributors = buildContributors(deduped, config);

  const version = options.version ?? (await inferVersionString(reader, from, bump));

  const data: ChangelogData = {
    bump,
    date: options.date ?? new Date().toISOString().slice(0, 10),
    to: resolvedTo,
    sections,
    contributors,
    skipped,
    ...(version !== undefined ? { version } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(config.repoUrl !== undefined ? { repoUrl: config.repoUrl } : {}),
  };

  return { data, parsedCommits: deduped, skipped };
}

async function inferVersionString(
  reader: GitReader,
  fromSha: string | undefined,
  bump: VersionBump
): Promise<string | undefined> {
  if (bump === 'none') return undefined;
  if (!fromSha) return undefined;
  const tags = await reader.listTags();
  const baseTag = tags.find((t) => t.sha === fromSha && t.semver);
  if (!baseTag?.semver) {
    // Fall back to trying to parse the ref itself as a version (e.g. --from was a tag name).
    const bySha = tags.find((t) => t.sha === fromSha);
    const semver = bySha ? parseSemVer(bySha.name) : undefined;
    if (!semver) return undefined;
    return applyBump(semver, bump);
  }
  return applyBump(baseTag.semver, bump);
}
