import { describe, expect, it } from "vitest";
import type { DiffSummary, PackageManifest } from "../src/types/reportSchema.ts";
import { evaluateRisk } from "../src/core/riskEngine.ts";

describe("evaluateRisk", () => {
  it("flags high-risk lifecycle and binary changes", () => {
    const risk = evaluateRisk({
      packageName: "demo",
      typosquat: null,
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

  it("flags one-edit typosquat candidates as high risk", () => {
    const risk = evaluateRisk(cleanInput({
      packageName: "esilnt",
      typosquat: { target: "eslint", reason: "edit-distance", distance: 1 }
    }));

    expect(risk.level).toBe("high");
    expect(risk.flags).toContainEqual({
      id: "POSSIBLE_TYPOSQUAT",
      level: "high",
      message: 'Package name "esilnt" is 1 edit away from popular package "eslint"; verify you requested the intended package'
    });
  });

  it("flags two-edit typosquat candidates as medium risk", () => {
    const risk = evaluateRisk(cleanInput({
      packageName: "nod-fetchh",
      typosquat: { target: "node-fetch", reason: "edit-distance", distance: 2 }
    }));

    expect(risk.flags).toContainEqual({
      id: "POSSIBLE_TYPOSQUAT",
      level: "medium",
      message: 'Package name "nod-fetchh" is 2 edits away from popular package "node-fetch"; verify you requested the intended package'
    });
  });

  it("flags scope confusion as high risk", () => {
    const risk = evaluateRisk(cleanInput({
      packageName: "types-node",
      typosquat: { target: "@types/node", reason: "scope-confusion", distance: 0 }
    }));

    expect(risk.flags).toContainEqual({
      id: "POSSIBLE_TYPOSQUAT",
      level: "high",
      message: 'Package name "types-node" is the popular package "@types/node" with its scope flattened; verify you requested the intended package'
    });
  });

  it("does not flag typosquats when no candidate was found", () => {
    const risk = evaluateRisk(cleanInput({ packageName: "demo" }));

    expect(risk.flags.map((flag) => flag.id)).not.toContain("POSSIBLE_TYPOSQUAT");
  });
});

function cleanInput(overrides: Partial<Parameters<typeof evaluateRisk>[0]>): Parameters<typeof evaluateRisk>[0] {
  return {
    packageName: "demo",
    typosquat: null,
    selectedManifest: { name: "demo", version: "2.0.0" },
    previousManifest: null,
    diff: {
      comparedFrom: "1.0.0",
      comparedTo: "2.0.0",
      filesAdded: [],
      filesRemoved: [],
      filesChanged: [],
      newBins: [],
      newLifecycleScripts: [],
      dependencyChanges: [],
      unavailableReason: null
    },
    downloadsLastWeek: 1_000_000,
    publishTime: "2024-01-01T00:00:00.000Z",
    previousPublishTime: "2023-12-01T00:00:00.000Z",
    repository: "https://example.test/demo.git",
    signaturePresent: true,
    ...overrides
  };
}

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
