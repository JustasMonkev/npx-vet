import { describe, expect, it } from "vitest";
import type { Packument, ParsedPackageSpec } from "../src/types/reportSchema.ts";
import { resolveVersions } from "../src/core/versionResolver.ts";

describe("resolveVersions", () => {
  it("uses latest by default and chooses the previous published version", () => {
    const resolved = resolveVersions(packument(), spec("demo", "tag", "latest"));

    expect(resolved).toEqual({
      latestVersion: "2.0.0",
      selectedVersion: "2.0.0",
      previousVersion: "1.1.0"
    });
  });

  it("keeps exact versions exact", () => {
    const resolved = resolveVersions(packument(), spec("demo@1.0.0", "version", "1.0.0"));

    expect(resolved.selectedVersion).toBe("1.0.0");
    expect(resolved.previousVersion).toBeNull();
  });

  it("normalizes exact versions and fails instead of falling back to latest when absent", () => {
    expect(resolveVersions(packument(), spec("demo@v1.0.0", "version", "v1.0.0")).selectedVersion).toBe("1.0.0");
    expect(resolveVersions(packument(), spec("demo@=1.0.0", "version", "=1.0.0")).selectedVersion).toBe("1.0.0");
    expect(() => resolveVersions(packument(), spec("demo@9.9.9", "version", "9.9.9"))).toThrow("has no version 9.9.9");
    expect(() => resolveVersions(packument(), spec("demo@vv1.0.0", "version", "vv1.0.0"))).toThrow("has no version vv1.0.0");
    expect(() => resolveVersions(packument(), spec("demo@v=1.0.0", "version", "v=1.0.0"))).toThrow("has no version v=1.0.0");
    expect(() => resolveVersions(packument(), spec("demo@==1.0.0", "version", "==1.0.0"))).toThrow("has no version ==1.0.0");
  });

  it("does not normalize exact build-metadata versions to a different artifact", () => {
    const withBuildMetadata = {
      ...packument(),
      versions: {
        ...packument().versions,
        "1.0.0+build.1": manifest("1.0.0+build.1")
      }
    };

    expect(resolveVersions(withBuildMetadata, spec("demo@1.0.0+build.1", "version", "1.0.0+build.1")).selectedVersion).toBe("1.0.0+build.1");
    expect(() => resolveVersions(packument(), spec("demo@1.0.0+build.1", "version", "1.0.0+build.1"))).toThrow("has no version 1.0.0+build.1");
  });

  it("validates dist-tag targets exist in the packument", () => {
    expect(resolveVersions(packument(), spec("demo@latest", "tag", "latest")).selectedVersion).toBe("2.0.0");
    expect(() => resolveVersions({
      ...packument(),
      "dist-tags": {
        latest: "9.9.9"
      }
    }, spec("demo", "tag", "latest"))).toThrow("points to unavailable version 9.9.9");
    expect(() => resolveVersions({
      ...packument(),
      "dist-tags": {
        latest: "not-semver"
      }
    }, spec("demo", "tag", "latest"))).toThrow("points to invalid semver version not-semver");
    expect(() => resolveVersions(packument(), spec("demo@toString", "tag", "toString"))).toThrow("has no dist-tag named toString");
  });

  it("resolves ranges and fails closed when no version matches", () => {
    expect(resolveVersions(packument(), spec("demo@^1.0.0", "range", "^1.0.0")).selectedVersion).toBe("1.1.0");
    expect(() => resolveVersions(packument(), spec("demo@^9.0.0", "range", "^9.0.0"))).toThrow("has no version matching ^9.0.0");
  });

  it("excludes prereleases when selected version is stable", () => {
    const resolved = resolveVersions({
      ...packument(),
      versions: {
        "1.0.0": manifest("1.0.0"),
        "1.1.0-beta.0": manifest("1.1.0-beta.0"),
        "1.1.0": manifest("1.1.0")
      },
      "dist-tags": {
        latest: "1.1.0"
      },
      time: {
        "1.0.0": "2025-01-01T00:00:00.000Z",
        "1.1.0-beta.0": "2025-02-01T00:00:00.000Z",
        "1.1.0": "2025-03-01T00:00:00.000Z"
      }
    }, spec("demo", "tag", "latest"));

    expect(resolved.previousVersion).toBe("1.0.0");
  });

  it("uses publish time as a guard when selecting the previous version", () => {
    const resolved = resolveVersions({
      name: "demo",
      "dist-tags": {
        latest: "2.0.0"
      },
      versions: {
        "1.0.0": manifest("1.0.0"),
        "1.5.0": manifest("1.5.0"),
        "2.0.0": manifest("2.0.0")
      },
      time: {
        "1.0.0": "2025-01-01T00:00:00.000Z",
        "1.5.0": "2025-04-01T00:00:00.000Z",
        "2.0.0": "2025-03-01T00:00:00.000Z"
      }
    }, spec("demo", "tag", "latest"));

    expect(resolved.previousVersion).toBe("1.0.0");
  });
});

function packument(): Packument {
  return {
    name: "demo",
    "dist-tags": {
      latest: "2.0.0"
    },
    versions: {
      "1.0.0": manifest("1.0.0"),
      "1.1.0": manifest("1.1.0"),
      "2.0.0": manifest("2.0.0")
    },
    time: {
      "1.0.0": "2025-01-01T00:00:00.000Z",
      "1.1.0": "2025-02-01T00:00:00.000Z",
      "2.0.0": "2025-03-01T00:00:00.000Z"
    }
  };
}

function manifest(version: string) {
  return {
    name: "demo",
    version
  };
}

function spec(raw: string, type: string, fetchSpec: string): ParsedPackageSpec {
  return {
    raw,
    name: "demo",
    type,
    fetchSpec,
    escapedName: "demo"
  };
}
