export { inspectPackage } from "./core/inspector.ts";
export type { InspectOptions } from "./core/inspector.ts";
export { parsePackageSpec } from "./core/packageSpec.ts";
export { resolveVersions } from "./core/versionResolver.ts";
export type { ResolvedVersions } from "./core/versionResolver.ts";
export { evaluateRisk } from "./core/riskEngine.ts";
export type { RiskInput, RiskResult } from "./core/riskEngine.ts";
export { findTyposquatCandidate } from "./core/typosquat.ts";
export type { TyposquatMatch } from "./core/typosquat.ts";
export { buildNpmExecCommand } from "./core/executor.ts";
export type { BuildNpmExecCommandOptions } from "./core/executor.ts";
export type {
  DiffSummary,
  Packument,
  PackageManifest,
  PackageReport,
  ParsedPackageSpec,
  RiskFlag,
  RiskLevel
} from "./types/reportSchema.ts";
