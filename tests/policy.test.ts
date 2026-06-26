import { describe, expect, it } from "vitest";
import type { PackageReport } from "../src/types/reportSchema.ts";
import { evaluateHumanPolicy, shouldFailInspection } from "../src/core/policy.ts";

describe("policy", () => {
  it("fails agent inspection only when requested", () => {
    const report = reportWithRisk("high");

    expect(shouldFailInspection(report, "none")).toBe(false);
    expect(shouldFailInspection(report, "high")).toBe(true);
    expect(shouldFailInspection(reportWithRisk("medium"), "high")).toBe(false);
    expect(shouldFailInspection(reportWithRisk("medium"), "medium")).toBe(true);
  });

  it("blocks high-risk human execution without explicit override", () => {
    const decision = evaluateHumanPolicy({
      report: reportWithRisk("high"),
      policy: "moderate",
      allowRisk: null,
      yes: true
    });

    expect(decision.blocked).toBe(true);
    expect(decision.allowedToPrompt).toBe(false);
  });

  it("does not auto-approve medium risk with --yes", () => {
    const decision = evaluateHumanPolicy({
      report: reportWithRisk("medium"),
      policy: "moderate",
      allowRisk: null,
      yes: true
    });

    expect(decision.blocked).toBe(false);
    expect(decision.autoApproved).toBe(false);
  });

  it("does not auto-approve high risk even when explicitly unblocked", () => {
    const decision = evaluateHumanPolicy({
      report: reportWithRisk("high"),
      policy: "moderate",
      allowRisk: "high",
      yes: true
    });

    expect(decision.blocked).toBe(false);
    expect(decision.autoApproved).toBe(false);
  });

  it("keeps --yes low-risk-only even when policy is off", () => {
    expect(evaluateHumanPolicy({
      report: reportWithRisk("low"),
      policy: "off",
      allowRisk: null,
      yes: true
    }).autoApproved).toBe(true);

    expect(evaluateHumanPolicy({
      report: reportWithRisk("high"),
      policy: "off",
      allowRisk: null,
      yes: true
    }).autoApproved).toBe(false);
  });

  it("blocks medium risk in strict mode unless explicitly overridden", () => {
    expect(evaluateHumanPolicy({
      report: reportWithRisk("medium"),
      policy: "strict",
      allowRisk: null,
      yes: false
    }).blocked).toBe(true);

    expect(evaluateHumanPolicy({
      report: reportWithRisk("medium"),
      policy: "strict",
      allowRisk: "medium",
      yes: false
    }).blocked).toBe(false);
  });
});

function reportWithRisk(level: PackageReport["risk"]["level"]): PackageReport {
  return {
    schemaVersion: 1,
    package: {
      name: "demo",
      requested: "demo",
      selectedVersion: "1.0.0",
      latestVersion: "1.0.0",
      previousVersion: null,
      distTags: {
        latest: "1.0.0"
      }
    },
    registry: {
      source: "https://registry.npmjs.org",
      fetchedAt: "2026-06-24T00:00:00.000Z"
    },
    metadata: {
      description: "",
      homepage: "",
      repository: "",
      license: "",
      deprecated: false,
      maintainers: [],
      publisher: null,
      publishTime: "2026-06-24T00:00:00.000Z",
      previousPublishTime: null,
      downloadsLastWeek: null
    },
    artifact: {
      integrity: "",
      tarball: "",
      fileCount: null,
      unpackedSize: null,
      previousFileCount: null,
      previousUnpackedSize: null,
      bins: [],
      lifecycleScripts: [],
      signature: {
        present: false,
        keyId: null
      },
      provenance: {
        status: "unknown",
        summary: null
      }
    },
    diff: {
      comparedFrom: null,
      comparedTo: "1.0.0",
      filesAdded: [],
      filesRemoved: [],
      filesChanged: [],
      newBins: [],
      newLifecycleScripts: [],
      dependencyChanges: [],
      unavailableReason: null
    },
    execution: {
      requested: false,
      allowed: false,
      delegatedCommand: []
    },
    risk: {
      level,
      score: level === "high" ? 45 : level === "medium" ? 20 : 0,
      flags: []
    }
  };
}
