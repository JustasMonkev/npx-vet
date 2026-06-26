import semver from "semver";
import type { Packument, ParsedPackageSpec } from "../types/reportSchema.ts";

export interface ResolvedVersions {
  latestVersion: string | null;
  selectedVersion: string;
  previousVersion: string | null;
}

export function resolveVersions(packument: Packument, spec: ParsedPackageSpec): ResolvedVersions {
  const distTags = packument["dist-tags"] ?? {};
  const versions = Object.keys(packument.versions ?? {}).filter((version) => semver.valid(version));
  const latestVersion = hasOwn(distTags, "latest")
    ? validateResolvedVersion(packument.name, distTags.latest, versions, "dist-tag latest")
    : null;
  const selectedVersion = resolveSelectedVersion(spec, distTags, versions, latestVersion);
  const previousVersion = resolvePreviousVersion(packument, selectedVersion, versions);

  return {
    latestVersion,
    selectedVersion,
    previousVersion
  };
}

function resolveSelectedVersion(
  spec: ParsedPackageSpec,
  distTags: Record<string, string>,
  versions: string[],
  latestVersion: string | null
): string {
  if (versions.length === 0) {
    throw new Error(`Package has no semver versions: ${spec.name}`);
  }

  if (spec.type === "version" && spec.fetchSpec) {
    return resolveExactVersion(spec, versions);
  }

  if (spec.type === "tag" && spec.fetchSpec) {
    if (!hasOwn(distTags, spec.fetchSpec)) {
      throw new Error(`Package ${spec.name} has no dist-tag named ${spec.fetchSpec}`);
    }
    const tagged = distTags[spec.fetchSpec];
    return validateResolvedVersion(spec.name, tagged, versions, `dist-tag ${spec.fetchSpec}`);
  }

  if (spec.type === "range" && spec.fetchSpec) {
    const matching = semver.maxSatisfying(versions, spec.fetchSpec, { includePrerelease: false });
    if (!matching) {
      throw new Error(`Package ${spec.name} has no version matching ${spec.fetchSpec}`);
    }
    return matching;
  }

  if (latestVersion) {
    return latestVersion;
  }

  const highest = semver.rsort(versions)[0];
  if (!highest) {
    throw new Error(`Package has no resolvable version: ${spec.name}`);
  }
  return highest;
}

function resolveExactVersion(spec: ParsedPackageSpec, versions: string[]): string {
  if (spec.fetchSpec && versions.includes(spec.fetchSpec)) {
    return spec.fetchSpec;
  }

  const normalizedVersion = spec.fetchSpec && canNormalizeExactVersion(spec.fetchSpec)
    ? semver.clean(spec.fetchSpec)
    : null;
  if (normalizedVersion && versions.includes(normalizedVersion)) {
    return normalizedVersion;
  }

  throw new Error(`Package ${spec.name} has no version ${spec.fetchSpec}`);
}

function validateResolvedVersion(packageName: string, version: string, versions: string[], source: string): string {
  if (!semver.valid(version)) {
    throw new Error(`Package ${packageName} ${source} points to invalid semver version ${version}`);
  }

  if (!versions.includes(version)) {
    throw new Error(`Package ${packageName} ${source} points to unavailable version ${version}`);
  }

  return version;
}

function canNormalizeExactVersion(version: string): boolean {
  return /^[v=]\d/.test(version) && !version.includes("+");
}

function hasOwn<T extends object, K extends PropertyKey>(object: T, key: K): object is T & Record<K, string> {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function resolvePreviousVersion(packument: Packument, selectedVersion: string, versions: string[]): string | null {
  const selectedPublishTime = packument.time?.[selectedVersion];
  const selectedIsPrerelease = semver.prerelease(selectedVersion) !== null;

  const candidates = versions.filter((candidate) => {
    if (candidate === selectedVersion || !semver.lt(candidate, selectedVersion)) {
      return false;
    }

    if (!selectedIsPrerelease && semver.prerelease(candidate) !== null) {
      return false;
    }

    const candidatePublishTime = packument.time?.[candidate];
    if (selectedPublishTime && candidatePublishTime) {
      return Date.parse(candidatePublishTime) < Date.parse(selectedPublishTime);
    }

    return true;
  });

  return semver.rsort(candidates)[0] ?? null;
}
