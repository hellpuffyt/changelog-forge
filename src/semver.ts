import type { SemVer, VersionBump } from './types.js';

const SEMVER_RE =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-.]+))?(?:\+[0-9A-Za-z-.]+)?$/;

/** Parses a (possibly `v`-prefixed) semver string. Returns undefined if it isn't valid semver. */
export function parseSemVer(input: string): SemVer | undefined {
  const match = SEMVER_RE.exec(input.trim());
  if (!match) return undefined;
  const [, major, minor, patch, prerelease] = match;
  if (major === undefined || minor === undefined || patch === undefined) return undefined;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ? prerelease.split('.') : [],
    raw: input,
  };
}

/** Compares two semvers. Returns >0 if a > b, <0 if a < b, 0 if equal (per semver precedence rules). */
export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  const aHasPre = a.prerelease.length > 0;
  const bHasPre = b.prerelease.length > 0;
  if (aHasPre && !bHasPre) return -1;
  if (!aHasPre && bHasPre) return 1;
  if (!aHasPre && !bHasPre) return 0;

  const len = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < len; i++) {
    const ai = a.prerelease[i];
    const bi = b.prerelease[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    const aNum = /^\d+$/.test(ai);
    const bNum = /^\d+$/.test(bi);
    if (aNum && bNum) {
      const diff = Number(ai) - Number(bi);
      if (diff !== 0) return diff;
      continue;
    }
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    if (ai !== bi) return ai < bi ? -1 : 1;
  }
  return 0;
}

export function applyBump(version: SemVer, bump: VersionBump): string {
  switch (bump) {
    case 'major':
      return `${version.major + 1}.0.0`;
    case 'minor':
      return `${version.major}.${version.minor + 1}.0`;
    case 'patch':
      return `${version.major}.${version.minor}.${version.patch + 1}`;
    case 'none':
      return `${version.major}.${version.minor}.${version.patch}`;
  }
}
