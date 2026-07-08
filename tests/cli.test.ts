import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { main, isCliEntrypoint } from "../src/commands/cli.ts";
import type { PackageReport } from "../src/types/reportSchema.ts";

describe("cli", () => {
  it("renders root help when no package is provided", async () => {
    const output = createOutput();
    const { calls, runtime } = createRuntime();
    const exitCode = await main([], output, runtime);

    expect(exitCode).toBe(0);
    expect(output.stdout).toContain("Usage: npx-vet");
    expect(output.stdout).toContain("inspect");
    expect(output.stderr).toBe("");
    expect(calls.inspectPackage).toEqual([]);
  });

  it("uses commander to render help", async () => {
    const output = createOutput();
    const exitCode = await main(["--help"], output);

    expect(exitCode).toBe(0);
    expect(output.stdout).toContain("Usage: npx-vet");
    expect(output.stdout).toContain("inspect");
    expect(output.stderr).toBe("");
  });

  it("uses commander to render version", async () => {
    const output = createOutput();
    const exitCode = await main(["--version"], output);

    expect(exitCode).toBe(0);
    expect(output.stdout.trim()).toBe(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
    expect(output.stderr).toBe("");
  });

  it("recognizes npm .bin symlink entrypoints", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "npx-vet-cli-"));
    const sourceUrl = new URL("../src/commands/cli.ts", import.meta.url);
    const sourcePath = fileURLToPath(sourceUrl);
    const symlinkPath = join(temporaryDirectory, "npx-vet");

    try {
      symlinkSync(sourcePath, symlinkPath);
      expect(isCliEntrypoint(sourceUrl.href, symlinkPath)).toBe(true);
    } finally {
      rmSync(temporaryDirectory, {
        recursive: true,
        force: true
      });
    }
  });

  it("uses commander option validation for invalid policies", async () => {
    const output = createOutput();
    const exitCode = await main(["--policy", "paranoid", "eslint"], output);

    expect(exitCode).toBe(2);
    expect(output.stderr).toContain("argument 'paranoid' is invalid");
  });

  it("runs inspect command without requesting execution", async () => {
    const output = createOutput();
    const { calls, runtime } = createRuntime(reportWithRisk("high"));
    const exitCode = await main(["inspect", "demo", "--json", "--fail-on", "medium"], output, runtime);

    expect(exitCode).toBe(2);
    expect(JSON.parse(output.stdout)).toMatchObject({
      package: {
        name: "demo"
      },
      risk: {
        level: "high"
      }
    });
    expect(output.stderr).toBe("");
    expect(calls.inspectPackage).toEqual([
      {
        packageSpec: "demo",
        options: {
          registry: "https://registry.npmjs.org",
          executionRequested: false
        }
      }
    ]);
    expect(calls.runDelegatedCommand).toEqual([]);
  });

  it("preserves forwarded args after -- during root dry runs", async () => {
    const output = createOutput();
    const delegatedCommand = ["npm", "exec", "--yes", "--package", "eslint@1.0.0", "--", "eslint", "--fix"];
    const { calls, runtime } = createRuntime(reportWithRisk("low", delegatedCommand));
    const exitCode = await main(["--dry-run", "eslint", "--", "--fix"], output, runtime);

    expect(exitCode).toBe(0);
    expect(output.stdout).toContain("rendered report");
    expect(output.stdout).toContain("Dry run: not executing delegated command.");
    expect(output.stderr).toBe("");
    expect(calls.inspectPackage).toEqual([
      {
        packageSpec: "eslint",
        options: {
          registry: "https://registry.npmjs.org",
          executionRequested: true,
          targetArgs: ["--fix"]
        }
      }
    ]);
    expect(calls.confirm).toEqual([]);
    expect(calls.runDelegatedCommand).toEqual([]);
  });

  it("passes custom registry options to inspection", async () => {
    const output = createOutput();
    const { calls, runtime } = createRuntime();
    const exitCode = await main(["inspect", "demo", "--registry", "https://registry.example.test"], output, runtime);

    expect(exitCode).toBe(0);
    expect(calls.inspectPackage).toEqual([
      {
        packageSpec: "demo",
        options: {
          registry: "https://registry.example.test",
          executionRequested: false
        }
      }
    ]);
  });

  it("passes custom registry options through root execution", async () => {
    const output = createOutput();
    const { calls, runtime } = createRuntime();
    const exitCode = await main(["--registry", "https://registry.example.test", "--dry-run", "demo"], output, runtime);

    expect(exitCode).toBe(0);
    expect(calls.inspectPackage).toEqual([
      {
        packageSpec: "demo",
        options: {
          registry: "https://registry.example.test",
          executionRequested: true,
          targetArgs: []
        }
      }
    ]);
  });

  it("blocks packages without executable bins even when forwarded args exist", async () => {
    const output = createOutput();
    const delegatedCommand = ["npm", "exec", "--yes", "--package", "left-pad@1.0.0", "--", "--version"];
    const { calls, runtime } = createRuntime(reportWithRisk("low", delegatedCommand, []));
    const exitCode = await main(["--dry-run", "left-pad", "--", "--version"], output, runtime);

    expect(exitCode).toBe(2);
    expect(output.stderr).toContain("does not expose an executable bin");
    expect(calls.confirm).toEqual([]);
    expect(calls.runDelegatedCommand).toEqual([]);
  });

  it("runs the delegated command after confirmation", async () => {
    const output = createOutput();
    const delegatedCommand = ["npm", "exec", "--yes", "--package", "demo@1.0.0", "--", "demo"];
    const { calls, runtime } = createRuntime(reportWithRisk("low", delegatedCommand), true);
    const exitCode = await main(["demo"], output, runtime);

    expect(exitCode).toBe(0);
    expect(calls.confirm).toHaveLength(1);
    expect(calls.runDelegatedCommand).toEqual([delegatedCommand]);
  });

  it("does not run the delegated command when confirmation is rejected", async () => {
    const output = createOutput();
    const delegatedCommand = ["npm", "exec", "--yes", "--package", "demo@1.0.0", "--", "demo"];
    const { calls, runtime } = createRuntime(reportWithRisk("low", delegatedCommand), false);
    const exitCode = await main(["demo"], output, runtime);

    expect(exitCode).toBe(1);
    expect(output.stdout).toContain("Cancelled. Target package was not executed.");
    expect(calls.confirm).toHaveLength(1);
    expect(calls.runDelegatedCommand).toEqual([]);
  });

  it("auto-approves low-risk execution only with --yes", async () => {
    const output = createOutput();
    const delegatedCommand = ["npm", "exec", "--yes", "--package", "demo@1.0.0", "--", "demo"];
    const { calls, runtime } = createRuntime(reportWithRisk("low", delegatedCommand));
    const exitCode = await main(["--yes", "demo"], output, runtime);

    expect(exitCode).toBe(0);
    expect(calls.confirm).toEqual([]);
    expect(calls.runDelegatedCommand).toEqual([delegatedCommand]);
  });

  it("does not auto-approve high-risk execution when policy is off", async () => {
    const output = createOutput();
    const delegatedCommand = ["npm", "exec", "--yes", "--package", "demo@1.0.0", "--", "demo"];
    const { calls, runtime } = createRuntime(reportWithRisk("high", delegatedCommand), false);
    const exitCode = await main(["--policy", "off", "--yes", "demo"], output, runtime);

    expect(exitCode).toBe(1);
    expect(calls.confirm).toHaveLength(1);
    expect(calls.runDelegatedCommand).toEqual([]);
  });

  it("blocks medium-risk root execution in strict policy", async () => {
    const output = createOutput();
    const { calls, runtime } = createRuntime(reportWithRisk("medium"));
    const exitCode = await main(["--policy", "strict", "demo"], output, runtime);

    expect(exitCode).toBe(2);
    expect(output.stderr).toContain("Strict policy blocks medium-risk package execution");
    expect(calls.confirm).toEqual([]);
    expect(calls.runDelegatedCommand).toEqual([]);
  });

  it("formats shell-sensitive approval prompts unambiguously", async () => {
    const output = createOutput();
    const delegatedCommand = ["npm", "exec", "--yes", "--package", "demo@1.0.0", "--", "demo", "$(touch /tmp/bad)", "has space"];
    const { calls, runtime } = createRuntime(reportWithRisk("low", delegatedCommand), false);
    await main(["demo"], output, runtime);

    expect(calls.confirm[0]?.message).toContain("'$(touch /tmp/bad)'");
    expect(calls.confirm[0]?.message).toContain("'has space'");
  });

  it("blocks high-risk execution without an override", async () => {
    const output = createOutput();
    const { calls, runtime } = createRuntime(reportWithRisk("high"));
    const exitCode = await main(["--yes", "demo"], output, runtime);

    expect(exitCode).toBe(2);
    expect(output.stderr).toContain("High-risk package execution requires --allow-risk=high");
    expect(calls.confirm).toEqual([]);
    expect(calls.runDelegatedCommand).toEqual([]);
  });

  it("keeps custom registries in high-risk override examples", async () => {
    const output = createOutput();
    const { runtime } = createRuntime(reportWithRisk("high"));
    const exitCode = await main(["--registry", "https://registry.example.test", "--yes", "demo"], output, runtime);

    expect(exitCode).toBe(2);
    expect(output.stderr).toContain("npx-vet --registry https://registry.example.test --allow-risk=high demo --");
  });

  it("allows high-risk dry-runs with an explicit override", async () => {
    const output = createOutput();
    const { calls, runtime } = createRuntime(reportWithRisk("high"));
    const exitCode = await main(["--allow-risk", "high", "--dry-run", "demo"], output, runtime);

    expect(exitCode).toBe(0);
    expect(output.stdout).toContain("Dry run: not executing delegated command.");
    expect(calls.confirm).toEqual([]);
    expect(calls.runDelegatedCommand).toEqual([]);
  });
});

function createOutput() {
  return {
    stdout: "",
    stderr: "",
    writeOut(message: string) {
      this.stdout += message;
    },
    writeErr(message: string) {
      this.stderr += message;
    }
  };
}

function createRuntime(report = reportWithRisk("low"), confirmResult = false) {
  const calls = {
    confirm: [] as Array<{ message: string; default: boolean }>,
    inspectPackage: [] as Array<{
      packageSpec: string;
      options: {
        registry?: string;
        executionRequested?: boolean;
        targetArgs?: string[];
      };
    }>,
    runDelegatedCommand: [] as string[][]
  };

  return {
    calls,
    runtime: {
      async confirm(options: { message: string; default: boolean }) {
        calls.confirm.push(options);
        return confirmResult;
      },
      async inspectPackage(packageSpec: string, options: {
        registry?: string;
        executionRequested?: boolean;
        targetArgs?: string[];
      }) {
        calls.inspectPackage.push({ packageSpec, options });
        return report;
      },
      renderHumanReport() {
        return "rendered report";
      },
      async runDelegatedCommand(command: string[]) {
        calls.runDelegatedCommand.push(command);
        return 0;
      }
    }
  };
}

function reportWithRisk(
  level: PackageReport["risk"]["level"],
  delegatedCommand = ["npm", "exec", "--yes", "--package", "demo@1.0.0", "--", "demo"],
  bins = ["demo"]
): PackageReport {
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
      bins,
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
      delegatedCommand
    },
    risk: {
      level,
      score: level === "high" ? 45 : level === "medium" ? 20 : 0,
      flags: []
    }
  };
}
