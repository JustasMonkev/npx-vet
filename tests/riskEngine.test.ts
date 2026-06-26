import { describe, expect, it } from "vitest";
import type { DiffSummary, PackageManifest } from "../src/types/reportSchema.ts";
import { evaluateRisk } from "../src/core/riskEngine.ts";

describe("evaluateRisk", () => {
  it("flags high-risk lifecycle and binary changes", () => {
    const risk = evaluateRisk({
      selectedManifest: selectedManifest(),
      previousManifest: previousManifest(),
      diff: diffSummary(),
      downloadsLastWeek: 25,
      publishTime: new Date().toISOString(),
      previousPublishTime: "2024-01-01T00:00:00.000Z",
      repository: "",
      signaturePresent: false
    });

    expect(risk.level).toBe("high");
    expect(risk.score).toBe(240);
    expect(risk.flags.map((flag) => flag.id)).toEqual(expect.arrayContaining([
      "LOW_DOWNLOADS",
      "VERY_RECENT_PUBLISH",
      "LONG_DORMANT_THEN_PUBLISHED",
      "NEW_LIFECYCLE_SCRIPT",
      "HAS_LIFECYCLE_SCRIPT",
      "NEW_BIN",
      "MISSING_REPOSITORY",
      "LARGE_ARTIFACT_JUMP",
      "NEW_NATIVE_OR_BINARY_FILE",
      "DEPENDENCY_SPIKE",
      "NO_REGISTRY_SIGNATURE"
    ]));
  });
});

function previousManifest(): PackageManifest {
  return {
    name: "demo",
    version: "1.0.0",
    dist: {
      fileCount: 10,
      unpackedSize: 10_000
    },
    dependencies: {
      a: "^1.0.0"
    }
  };
}

function selectedManifest(): PackageManifest {
  return {
    name: "demo",
    version: "2.0.0",
    scripts: {
      postinstall: "node postinstall.js"
    },
    bin: {
      demo: "./cli.js"
    },
    dist: {
      fileCount: 100,
      unpackedSize: 2_500_000
    },
    dependencies: {
      a: "^2.0.0",
      b: "^1.0.0",
      c: "^1.0.0",
      d: "^1.0.0",
      e: "^1.0.0",
      f: "^1.0.0"
    }
  };
}

function diffSummary(): DiffSummary {
  return {
    comparedFrom: "1.0.0",
    comparedTo: "2.0.0",
    filesAdded: [],
    filesRemoved: [],
    filesChanged: ["package.json", "native/addon.node"],
    newBins: ["demo"],
    newLifecycleScripts: ["postinstall"],
    dependencyChanges: [
      { name: "a", previous: "^1.0.0", selected: "^2.0.0", type: "changed" },
      { name: "b", previous: null, selected: "^1.0.0", type: "added" },
      { name: "c", previous: null, selected: "^1.0.0", type: "added" },
      { name: "d", previous: null, selected: "^1.0.0", type: "added" },
      { name: "e", previous: null, selected: "^1.0.0", type: "added" },
      { name: "f", previous: null, selected: "^1.0.0", type: "added" }
    ],
    unavailableReason: null
  };
}
