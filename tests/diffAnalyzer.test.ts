import { beforeEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import { analyzeDiff, hasNativeOrBinaryFile, lifecycleScriptNames } from "../src/core/diffAnalyzer.ts";
import type { PackageManifest } from "../src/types/reportSchema.ts";

vi.mock("execa", () => ({
  execa: vi.fn()
}));

describe("diffAnalyzer", () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset();
  });

  it("passes the selected registry to npm diff and parses file statuses", async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 0,
      stdout: [
        "diff --git a/package.json b/package.json",
        "index 0000000..1111111 100644",
        "diff --git a/native/addon.node b/native/addon.node",
        "new file mode 100644",
        "diff --git a/old.bin b/old.bin",
        "deleted file mode 100644"
      ].join("\n"),
      stderr: ""
    } as Awaited<ReturnType<typeof execa>>);

    const diff = await analyzeDiff({
      packageName: "demo",
      previousVersion: "1.0.0",
      selectedVersion: "2.0.0",
      registry: "https://registry.example.test",
      previousManifest: manifest("1.0.0"),
      selectedManifest: manifest("2.0.0")
    });

    expect(execa).toHaveBeenCalledWith("npm", [
      "diff",
      "--diff=demo@1.0.0",
      "--diff=demo@2.0.0",
      "--registry",
      "https://registry.example.test"
    ], {
      reject: false
    });
    expect(diff.filesChanged).toEqual(["package.json"]);
    expect(diff.filesAdded).toEqual(["native/addon.node"]);
    expect(diff.filesRemoved).toEqual(["old.bin"]);
    expect(hasNativeOrBinaryFile(diff)).toBe(true);
  });

  it("detects install lifecycle hooks beyond postinstall", () => {
    expect(lifecycleScriptNames({
      name: "demo",
      version: "1.0.0",
      scripts: {
        prepublish: "node prepublish.js",
        preprepare: "node preprepare.js",
        postprepare: "node postprepare.js",
        test: "vitest"
      }
    })).toEqual(["postprepare", "preprepare", "prepublish"]);
  });

  it("detects uppercase native and binary file extensions", () => {
    expect(hasNativeOrBinaryFile({
      comparedFrom: "1.0.0",
      comparedTo: "2.0.0",
      filesAdded: ["payload.WASM"],
      filesRemoved: [],
      filesChanged: [],
      newBins: [],
      newLifecycleScripts: [],
      dependencyChanges: [],
      unavailableReason: null
    })).toBe(true);
  });

  it("preserves extensionless binary diff signals", async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 0,
      stdout: [
        "diff --git a/vendor/linux-x64/helper b/vendor/linux-x64/helper",
        "new file mode 100755",
        "Binary files /dev/null and b/vendor/linux-x64/helper differ"
      ].join("\n"),
      stderr: ""
    } as Awaited<ReturnType<typeof execa>>);

    const diff = await analyzeDiff({
      packageName: "demo",
      previousVersion: "1.0.0",
      selectedVersion: "2.0.0",
      previousManifest: manifest("1.0.0"),
      selectedManifest: manifest("2.0.0")
    });

    expect(diff.filesAdded).toEqual(["vendor/linux-x64/helper"]);
    expect(diff.binaryFiles).toEqual(["vendor/linux-x64/helper"]);
    expect(hasNativeOrBinaryFile(diff)).toBe(true);
  });

  it("parses quoted git diff paths", async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 0,
      stdout: [
        String.raw`diff --git "a/native/add\ton.node" "b/native/add\ton.node"`,
        "new file mode 100644"
      ].join("\n"),
      stderr: ""
    } as Awaited<ReturnType<typeof execa>>);

    const diff = await analyzeDiff({
      packageName: "demo",
      previousVersion: "1.0.0",
      selectedVersion: "2.0.0",
      previousManifest: manifest("1.0.0"),
      selectedManifest: manifest("2.0.0")
    });

    expect(diff.filesAdded).toEqual(["native/add\ton.node"]);
    expect(hasNativeOrBinaryFile(diff)).toBe(true);
  });
});

function manifest(version: string): PackageManifest {
  return {
    name: "demo",
    version
  };
}
