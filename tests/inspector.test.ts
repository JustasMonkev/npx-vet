import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import pacote from "pacote";
import { inspectPackage } from "../src/core/inspector.ts";
import type { Packument } from "../src/types/reportSchema.ts";

vi.mock("execa", () => ({
  execa: vi.fn()
}));

vi.mock("pacote", () => ({
  default: {
    packument: vi.fn()
  }
}));

describe("inspectPackage", () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset();
    vi.mocked(pacote.packument).mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds one report from the same custom registry context end to end", async () => {
    vi.mocked(pacote.packument).mockResolvedValue(packument());
    vi.mocked(execa).mockResolvedValue({
      exitCode: 0,
      stdout: [
        "diff --git a/native/addon.node b/native/addon.node",
        "new file mode 100644"
      ].join("\n"),
      stderr: ""
    } as Awaited<ReturnType<typeof execa>>);

    const report = await inspectPackage("demo", {
      registry: "https://registry.example.test",
      executionRequested: true,
      targetArgs: ["--help"]
    });

    expect(pacote.packument).toHaveBeenCalledWith("demo", {
      fullMetadata: true,
      registry: "https://registry.example.test"
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(execa).toHaveBeenCalledWith("npm", [
      "diff",
      "--diff=demo@1.0.0",
      "--diff=demo@2.0.0",
      "--registry",
      "https://registry.example.test"
    ], {
      reject: false,
      timeout: 120_000
    });
    expect(report.registry.source).toBe("https://registry.example.test");
    expect(report.metadata.downloadsLastWeek).toBeNull();
    expect(report.package).toMatchObject({
      name: "demo",
      selectedVersion: "2.0.0",
      previousVersion: "1.0.0"
    });
    expect(report.artifact.lifecycleScripts).toEqual(["postinstall"]);
    expect(report.diff.filesAdded).toEqual(["native/addon.node"]);
    expect(report.execution).toMatchObject({
      requested: true,
      delegatedCommand: [
        "npm",
        "exec",
        "--registry",
        "https://registry.example.test",
        "--yes",
        "--package",
        "demo@2.0.0",
        "--",
        "demo",
        "--help"
      ]
    });
    expect(report.risk.flags.map((flag) => flag.id)).toEqual(expect.arrayContaining([
      "NEW_LIFECYCLE_SCRIPT",
      "HAS_LIFECYCLE_SCRIPT",
      "NEW_BIN",
      "NEW_NATIVE_OR_BINARY_FILE"
    ]));
  });
});

function packument(): Packument {
  return {
    name: "demo",
    description: "Demo package",
    "dist-tags": {
      latest: "2.0.0"
    },
    versions: {
      "1.0.0": {
        name: "demo",
        version: "1.0.0",
        repository: {
          type: "git",
          url: "https://example.test/demo.git"
        },
        dist: {
          fileCount: 5,
          unpackedSize: 1000,
          signatures: [
            {
              keyid: "key",
              sig: "sig"
            }
          ]
        }
      },
      "2.0.0": {
        name: "demo",
        version: "2.0.0",
        repository: {
          type: "git",
          url: "https://example.test/demo.git"
        },
        bin: {
          demo: "cli.js"
        },
        scripts: {
          postinstall: "node postinstall.js"
        },
        dist: {
          fileCount: 6,
          unpackedSize: 1200,
          signatures: [
            {
              keyid: "key",
              sig: "sig"
            }
          ]
        }
      }
    },
    time: {
      "1.0.0": "2025-01-01T00:00:00.000Z",
      "2.0.0": "2025-02-01T00:00:00.000Z"
    }
  };
}
