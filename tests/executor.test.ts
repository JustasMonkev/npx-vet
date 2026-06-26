import { beforeEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import { buildNpmExecCommand, runDelegatedCommand } from "../src/core/executor.ts";

vi.mock("execa", () => ({
  execa: vi.fn()
}));

describe("buildNpmExecCommand", () => {
  beforeEach(() => {
    vi.mocked(execa).mockReset();
  });

  it("builds an npm exec command with the selected package version and inferred bin", () => {
    const command = buildNpmExecCommand({
      packageName: "create-vite",
      selectedVersion: "8.0.0",
      selectedManifest: {
        name: "create-vite",
        version: "8.0.0",
        bin: {
          "create-vite": "index.js"
        }
      },
      targetArgs: ["my-app", "--template", "react"]
    });

    expect(command).toEqual([
      "npm",
      "exec",
      "--yes",
      "--package",
      "create-vite@8.0.0",
      "--",
      "create-vite",
      "my-app",
      "--template",
      "react"
    ]);
  });

  it("carries the inspected registry into npm exec", () => {
    const command = buildNpmExecCommand({
      packageName: "create-vite",
      selectedVersion: "8.0.0",
      registry: "https://registry.example.test",
      selectedManifest: {
        name: "create-vite",
        version: "8.0.0",
        bin: {
          "create-vite": "index.js"
        }
      },
      targetArgs: []
    });

    expect(command).toEqual([
      "npm",
      "exec",
      "--registry",
      "https://registry.example.test",
      "--yes",
      "--package",
      "create-vite@8.0.0",
      "--",
      "create-vite"
    ]);
  });

  it("does not invent a command for packages without bins", () => {
    const command = buildNpmExecCommand({
      packageName: "left-pad",
      selectedVersion: "1.3.0",
      selectedManifest: {
        name: "left-pad",
        version: "1.3.0"
      },
      targetArgs: []
    });

    expect(command).toEqual([
      "npm",
      "exec",
      "--yes",
      "--package",
      "left-pad@1.3.0"
    ]);
  });

  it("does not guess when a package exposes ambiguous bins", () => {
    const command = buildNpmExecCommand({
      packageName: "multi-bin",
      selectedVersion: "1.0.0",
      selectedManifest: {
        name: "multi-bin",
        version: "1.0.0",
        bin: {
          alpha: "alpha.js",
          omega: "omega.js"
        }
      },
      targetArgs: []
    });

    expect(command).toEqual([
      "npm",
      "exec",
      "--yes",
      "--package",
      "multi-bin@1.0.0"
    ]);
  });

  it("uses the unscoped executable name for scoped shorthand bins", () => {
    const command = buildNpmExecCommand({
      packageName: "@scope/tool",
      selectedVersion: "1.0.0",
      selectedManifest: {
        name: "@scope/tool",
        version: "1.0.0",
        bin: "cli.js"
      },
      targetArgs: ["--help"]
    });

    expect(command).toEqual([
      "npm",
      "exec",
      "--yes",
      "--package",
      "@scope/tool@1.0.0",
      "--",
      "tool",
      "--help"
    ]);
  });

  it("rejects empty delegated commands", async () => {
    await expect(runDelegatedCommand([])).rejects.toThrow("Cannot execute an empty delegated command");
  });

  it("executes delegated commands as argv arrays and returns the child exit code", async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 7
    } as Awaited<ReturnType<typeof execa>>);

    await expect(runDelegatedCommand(["npm", "exec", "--", "demo", "$(bad)"])).resolves.toBe(7);
    expect(execa).toHaveBeenCalledWith("npm", ["exec", "--", "demo", "$(bad)"], {
      stdio: "inherit",
      reject: false
    });
  });
});
