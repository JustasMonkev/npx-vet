import type { DiffSummary, PackageManifest, RiskFlag, RiskLevel } from "../types/reportSchema.ts";
import { hasNativeOrBinaryFile, lifecycleScriptNames } from "./diffAnalyzer.ts";
import type { TyposquatMatch } from "./typosquat.ts";

export interface RiskInput {
  packageName: string;
  typosquat: TyposquatMatch | null;
  selectedManifest: PackageManifest;
  previousManifest: PackageManifest | null;
  diff: DiffSummary;
  downloadsLastWeek: number | null;
  publishTime: string;
  previousPublishTime: string | null;
  repository: string;
  signaturePresent: boolean;
}

export interface RiskResult {
  level: RiskLevel;
  score: number;
  flags: RiskFlag[];
}

const FLAG_SCORE: Record<Exclude<RiskLevel, "unknown">, number> = {
  low: 5,
  medium: 20,
  high: 45
};

export function evaluateRisk(input: RiskInput): RiskResult {
  const flags: RiskFlag[] = [];
  const addFlag = (id: string, level: RiskFlag["level"], message: string) => {
    flags.push({ id, level, message });
  };

  if (input.typosquat) {
    addFlag(
      "POSSIBLE_TYPOSQUAT",
      // A single edit or a flattened scope is a classic squat; two edits is weaker evidence.
      input.typosquat.reason === "edit-distance" && input.typosquat.distance > 1 ? "medium" : "high",
      typosquatMessage(input.packageName, input.typosquat)
    );
  }

  if (input.selectedManifest.deprecated) {
    addFlag("DEPRECATED_PACKAGE", "high", `Package is deprecated: ${input.selectedManifest.deprecated}`);
  }

  if (input.downloadsLastWeek !== null && input.downloadsLastWeek < 1000) {
    addFlag("LOW_DOWNLOADS", "medium", `Only ${input.downloadsLastWeek} downloads in the last week`);
  }

  if (input.publishTime && daysSince(input.publishTime) <= 7) {
    addFlag("VERY_RECENT_PUBLISH", "medium", `Selected version was published ${formatAge(input.publishTime)} ago`);
  }

  if (input.publishTime && input.previousPublishTime) {
    const dormantDays = daysBetween(input.previousPublishTime, input.publishTime);
    if (dormantDays >= 365) {
      addFlag(
        "LONG_DORMANT_THEN_PUBLISHED",
        "medium",
        `Previous release was ${Math.round(dormantDays)} days before the selected version`
      );
    }
  }

  if (input.diff.newLifecycleScripts.length > 0) {
    addFlag(
      "NEW_LIFECYCLE_SCRIPT",
      "high",
      `Selected version adds or changes lifecycle scripts: ${input.diff.newLifecycleScripts.join(", ")}`
    );
  }

  const lifecycleScripts = lifecycleScriptNames(input.selectedManifest);
  if (lifecycleScripts.length > 0) {
    addFlag("HAS_LIFECYCLE_SCRIPT", "medium", `Selected version contains lifecycle scripts: ${lifecycleScripts.join(", ")}`);
  }

  if (input.diff.newBins.length > 0) {
    addFlag("NEW_BIN", "medium", `Selected version adds executable bins: ${input.diff.newBins.join(", ")}`);
  }

  if (!input.repository) {
    addFlag("MISSING_REPOSITORY", "low", "Package metadata does not include a repository URL");
  }

  if (artifactJumped(input.previousManifest, input.selectedManifest)) {
    addFlag(
      "LARGE_ARTIFACT_JUMP",
      "medium",
      "Selected artifact size or file count increased sharply compared with the previous version"
    );
  }

  if (hasNativeOrBinaryFile(input.diff)) {
    addFlag("NEW_NATIVE_OR_BINARY_FILE", "high", "Diff includes native or binary-looking files");
  }

  const addedDependencies = input.diff.dependencyChanges.filter(({ type }) => type === "added");
  if (addedDependencies.length >= 5) {
    addFlag("DEPENDENCY_SPIKE", "medium", `Selected version adds ${addedDependencies.length} dependencies`);
  }

  if (input.diff.unavailableReason) {
    addFlag(
      "DIFF_UNAVAILABLE",
      input.diff.comparedFrom ? "medium" : "low",
      `Previous-version diff unavailable: ${input.diff.unavailableReason}`
    );
  }

  if (!input.signaturePresent) {
    addFlag("NO_REGISTRY_SIGNATURE", "low", "Selected version does not expose npm registry signature metadata");
  }

  const score = flags.reduce((sum, flag) => sum + FLAG_SCORE[flag.level], 0);
  return {
    level: riskLevelFromFlags(flags),
    score,
    flags
  };
}

function typosquatMessage(packageName: string, match: TyposquatMatch): string {
  if (match.reason === "scope-confusion") {
    return `Package name "${packageName}" is the popular package "${match.target}" with its scope flattened; verify you requested the intended package`;
  }

  return `Package name "${packageName}" is ${match.distance} edit${match.distance === 1 ? "" : "s"} away from popular package "${match.target}"; verify you requested the intended package`;
}

function riskLevelFromFlags(flags: RiskFlag[]): RiskLevel {
  if (flags.some((flag) => flag.level === "high")) {
    return "high";
  }

  if (flags.some((flag) => flag.level === "medium")) {
    return "medium";
  }

  return "low";
}

function artifactJumped(previousManifest: PackageManifest | null, selectedManifest: PackageManifest): boolean {
  if (!previousManifest?.dist || !selectedManifest.dist) {
    return false;
  }

  const previousSize = previousManifest.dist.unpackedSize ?? 0;
  const selectedSize = selectedManifest.dist.unpackedSize ?? 0;
  const previousFiles = previousManifest.dist.fileCount ?? 0;
  const selectedFiles = selectedManifest.dist.fileCount ?? 0;

  return (previousSize > 0 && selectedSize > previousSize * 2 && selectedSize - previousSize > 1_000_000)
    || (previousFiles > 0 && selectedFiles > previousFiles * 2 && selectedFiles - previousFiles > 50);
}

function daysSince(date: string): number {
  return daysBetween(date, new Date().toISOString());
}

function daysBetween(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 86_400_000;
}

function formatAge(date: string): string {
  const days = Math.max(0, Math.floor(daysSince(date)));
  if (days === 0) {
    return "less than a day";
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}
