import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high", "unknown"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskFlagSchema = z.object({
  id: z.string(),
  level: riskLevelSchema.exclude(["unknown"]),
  message: z.string()
});
export type RiskFlag = z.infer<typeof riskFlagSchema>;

export const dependencyChangeSchema = z.object({
  name: z.string(),
  previous: z.string().nullable(),
  selected: z.string().nullable(),
  type: z.enum(["added", "removed", "changed"])
});
export type DependencyChange = z.infer<typeof dependencyChangeSchema>;

export const diffSummarySchema = z.object({
  comparedFrom: z.string().nullable(),
  comparedTo: z.string(),
  filesAdded: z.array(z.string()),
  filesRemoved: z.array(z.string()),
  filesChanged: z.array(z.string()),
  binaryFiles: z.array(z.string()).optional(),
  newBins: z.array(z.string()),
  newLifecycleScripts: z.array(z.string()),
  dependencyChanges: z.array(dependencyChangeSchema),
  unavailableReason: z.string().nullable()
});
export type DiffSummary = z.infer<typeof diffSummarySchema>;

export const packageReportSchema = z.object({
  schemaVersion: z.literal(1),
  package: z.object({
    name: z.string(),
    requested: z.string(),
    selectedVersion: z.string(),
    latestVersion: z.string().nullable(),
    previousVersion: z.string().nullable(),
    distTags: z.record(z.string(), z.string())
  }),
  registry: z.object({
    source: z.string(),
    fetchedAt: z.string()
  }),
  metadata: z.object({
    description: z.string(),
    homepage: z.string(),
    repository: z.string(),
    license: z.string(),
    deprecated: z.boolean(),
    maintainers: z.array(z.string()),
    publisher: z.string().nullable(),
    publishTime: z.string(),
    previousPublishTime: z.string().nullable(),
    downloadsLastWeek: z.number().nullable()
  }),
  artifact: z.object({
    integrity: z.string(),
    tarball: z.string(),
    fileCount: z.number().nullable(),
    unpackedSize: z.number().nullable(),
    previousFileCount: z.number().nullable(),
    previousUnpackedSize: z.number().nullable(),
    bins: z.array(z.string()),
    lifecycleScripts: z.array(z.string()),
    signature: z.object({
      present: z.boolean(),
      keyId: z.string().nullable()
    }),
    provenance: z.object({
      status: z.enum(["present", "absent", "unknown"]),
      summary: z.string().nullable()
    })
  }),
  diff: diffSummarySchema,
  execution: z.object({
    requested: z.boolean(),
    allowed: z.boolean(),
    delegatedCommand: z.array(z.string())
  }),
  risk: z.object({
    level: riskLevelSchema,
    score: z.number(),
    flags: z.array(riskFlagSchema)
  })
});
export type PackageReport = z.infer<typeof packageReportSchema>;

export interface ParsedPackageSpec {
  raw: string;
  name: string;
  type: "range" | "tag" | "version";
  fetchSpec: string | null;
  escapedName: string;
}

export interface PackageManifest {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: string | { url?: string; type?: string };
  license?: string;
  deprecated?: string;
  maintainers?: Array<string | { name?: string; email?: string }>;
  _npmUser?: string | { name?: string; email?: string };
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  dist?: {
    integrity?: string;
    tarball?: string;
    fileCount?: number;
    unpackedSize?: number;
    signatures?: Array<{ keyid?: string; sig?: string }>;
  };
}

export interface Packument {
  name: string;
  description?: string;
  "dist-tags"?: Record<string, string>;
  versions?: Record<string, PackageManifest>;
  time?: Record<string, string>;
  maintainers?: Array<string | { name?: string; email?: string }>;
}
