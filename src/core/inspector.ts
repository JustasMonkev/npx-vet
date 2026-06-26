import { analyzeDiff, binNames, lifecycleScriptNames } from "./diffAnalyzer.ts";
import { buildNpmExecCommand } from "./executor.ts";
import { parsePackageSpec } from "./packageSpec.ts";
import { fetchRegistryEvidence, getManifest } from "./registryClient.ts";
import { evaluateRisk } from "./riskEngine.ts";
import { packageReportSchema, type PackageManifest, type PackageReport } from "../types/reportSchema.ts";
import { resolveVersions } from "./versionResolver.ts";

export interface InspectOptions {
  registry?: string;
  executionRequested?: boolean;
  targetArgs?: string[];
}

export async function inspectPackage(rawSpec: string, options: InspectOptions = {}): Promise<PackageReport> {
  const parsed = parsePackageSpec(rawSpec);
  const evidence = await fetchRegistryEvidence(parsed, {
    registry: options.registry
  });
  const registry = evidence.registry;
  const targetArgs = options.targetArgs ?? [];
  const versions = resolveVersions(evidence.packument, parsed);
  const selectedManifest = getManifest(evidence.packument, versions.selectedVersion);
  const previousManifest = versions.previousVersion ? getManifest(evidence.packument, versions.previousVersion) : null;
  const selectedDist = selectedManifest.dist;
  const previousDist = previousManifest?.dist;
  const diff = await analyzeDiff({
    packageName: parsed.name,
    previousVersion: versions.previousVersion,
    selectedVersion: versions.selectedVersion,
    previousManifest,
    selectedManifest,
    registry
  });

  const repository = stringifyRepository(selectedManifest.repository);
  const time = evidence.packument.time ?? {};
  const publishTime = time[versions.selectedVersion] ?? "";
  const previousPublishTime = versions.previousVersion ? time[versions.previousVersion] ?? null : null;
  const signature = selectedDist?.signatures?.[0] ?? null;
  const delegatedCommand = buildNpmExecCommand({
    packageName: parsed.name,
    selectedVersion: versions.selectedVersion,
    selectedManifest,
    targetArgs,
    registry
  });
  const risk = evaluateRisk({
    selectedManifest,
    previousManifest,
    diff,
    downloadsLastWeek: evidence.downloadsLastWeek,
    publishTime,
    previousPublishTime,
    repository,
    signaturePresent: Boolean(signature)
  });

  const report: PackageReport = {
    schemaVersion: 1,
    package: {
      name: parsed.name,
      requested: rawSpec,
      selectedVersion: versions.selectedVersion,
      latestVersion: versions.latestVersion,
      previousVersion: versions.previousVersion,
      distTags: evidence.packument["dist-tags"] ?? {}
    },
    registry: {
      source: evidence.registry,
      fetchedAt: evidence.fetchedAt
    },
    metadata: {
      description: selectedManifest.description ?? evidence.packument.description ?? "",
      homepage: selectedManifest.homepage ?? "",
      repository,
      license: selectedManifest.license ?? "",
      deprecated: Boolean(selectedManifest.deprecated),
      maintainers: normalizePeople(selectedManifest.maintainers ?? evidence.packument.maintainers ?? []),
      publisher: normalizePerson(selectedManifest._npmUser ?? null),
      publishTime,
      previousPublishTime,
      downloadsLastWeek: evidence.downloadsLastWeek
    },
    artifact: {
      integrity: selectedDist?.integrity ?? "",
      tarball: selectedDist?.tarball ?? "",
      fileCount: selectedDist?.fileCount ?? null,
      unpackedSize: selectedDist?.unpackedSize ?? null,
      previousFileCount: previousDist?.fileCount ?? null,
      previousUnpackedSize: previousDist?.unpackedSize ?? null,
      bins: binNames(selectedManifest),
      lifecycleScripts: lifecycleScriptNames(selectedManifest),
      signature: {
        present: Boolean(signature),
        keyId: signature?.keyid ?? null
      },
      provenance: {
        status: "unknown",
        summary: null
      }
    },
    diff,
    execution: {
      requested: options.executionRequested ?? false,
      allowed: false,
      delegatedCommand
    },
    risk
  };

  return packageReportSchema.parse(report);
}

function stringifyRepository(repository: PackageManifest["repository"]): string {
  if (!repository) {
    return "";
  }

  return typeof repository === "string" ? repository : repository.url ?? "";
}

function normalizePeople(people: NonNullable<PackageManifest["maintainers"]>): string[] {
  return people.map((person) => normalizePerson(person)).filter((person): person is string => Boolean(person));
}

function normalizePerson(person: PackageManifest["_npmUser"] | null): string | null {
  if (!person) {
    return null;
  }

  if (typeof person === "string") {
    return person;
  }

  if (person.name && person.email) {
    return `${person.name} <${person.email}>`;
  }

  return person.name ?? person.email ?? null;
}
