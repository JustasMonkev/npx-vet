import { describe, expect, it } from "vitest";
import { renderHumanReport } from "../src/core/humanRenderer.ts";
import type { PackageReport } from "../src/types/reportSchema.ts";

describe("renderHumanReport", () => {
  it("renders human output as scan-friendly tables", () => {
    const output = renderHumanReport(createReport());

    expect(output).toContain("Safe NPX inspection: demo@1.0.0");
    expect(output).toContain("| Field                | Value");
    expect(output).toMatch(/\| Verdict\s+\| HIGH \(score 45\)/);
    expect(output).toContain("| Level    | Flag");
    expect(output).toContain("| high     | NEW_LIFECYCLE_SCRIPT");
    expect(output).toContain("Would run: npm exec --yes --package demo@1.0.0 -- demo --version");
  });

  it("quotes shell-sensitive command tokens and strips terminal controls", () => {
    const report = createReport();
    report.package.name = "demo\u001B[2J";
    report.risk.flags[0] = {
      id: "NEW_LIFECYCLE_SCRIPT",
      level: "high",
      message: "bad\u001B]2;owned\u0007message"
    };
    report.execution.delegatedCommand = [
      "npm",
      "exec",
      "--",
      "demo",
      "$(touch /tmp/bad)",
      "has space"
    ];

    const output = renderHumanReport(report);

    expect(output).not.toContain("\u001B");
    expect(output).not.toContain("\u0007");
    expect(output).toContain("'$(touch /tmp/bad)'");
    expect(output).toContain("'has space'");
  });

  it("truncates risk flags after twelve rows", () => {
    const report = createReport();
    report.risk.flags = Array.from({ length: 13 }, (_, index) => ({
      id: `FLAG_${index}`,
      level: "low",
      message: `message ${index}`
    }));

    const output = renderHumanReport(report);

    expect(output).toContain("1 more");
    expect(output).toContain("Run with --json to inspect every risk flag.");
  });
});

function createReport(): PackageReport {
  return {
    schemaVersion: 1,
    package: {
      name: "demo",
      requested: "demo",
      selectedVersion: "1.0.0",
      latestVersion: "1.0.0",
      previousVersion: "0.9.0",
      distTags: {
        latest: "1.0.0"
      }
    },
    registry: {
      source: "https://registry.npmjs.org",
      fetchedAt: "2026-06-25T00:00:00.000Z"
    },
    metadata: {
      description: "",
      homepage: "https://example.com",
      repository: "https://github.com/example/demo",
      license: "MIT",
      deprecated: false,
      maintainers: ["demo <demo@example.com>"],
      publisher: "demo <demo@example.com>",
      publishTime: "2026-06-25T00:00:00.000Z",
      previousPublishTime: "2026-06-20T00:00:00.000Z",
      downloadsLastWeek: 12345
    },
    artifact: {
      integrity: "sha512-demo",
      tarball: "https://registry.npmjs.org/demo/-/demo-1.0.0.tgz",
      fileCount: 10,
      unpackedSize: 2048,
      previousFileCount: 9,
      previousUnpackedSize: 1024,
      bins: ["demo"],
      lifecycleScripts: ["postinstall"],
      signature: {
        present: true,
        keyId: "key"
      },
      provenance: {
        status: "unknown",
        summary: null
      }
    },
    diff: {
      comparedFrom: "0.9.0",
      comparedTo: "1.0.0",
      filesAdded: ["postinstall.js"],
      filesRemoved: [],
      filesChanged: ["package.json"],
      newBins: [],
      newLifecycleScripts: ["postinstall"],
      dependencyChanges: [],
      unavailableReason: null
    },
    execution: {
      requested: true,
      allowed: false,
      delegatedCommand: ["npm", "exec", "--yes", "--package", "demo@1.0.0", "--", "demo", "--version"]
    },
    risk: {
      level: "high",
      score: 45,
      flags: [
        {
          id: "NEW_LIFECYCLE_SCRIPT",
          level: "high",
          message: "Selected version adds or changes lifecycle scripts: postinstall"
        }
      ]
    }
  };
}
