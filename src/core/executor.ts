import { execa } from "execa";
import type { PackageManifest } from "../types/reportSchema.ts";
import { unscopedPackageName } from "./packageName.ts";

export interface BuildNpmExecCommandOptions {
  packageName: string;
  selectedVersion: string;
  selectedManifest: PackageManifest;
  targetArgs: string[];
  registry?: string;
}

export function buildNpmExecCommand(options: BuildNpmExecCommandOptions): string[] {
  const binName = selectBinName(options.packageName, options.selectedManifest);
  const command = [
    "npm",
    "exec"
  ];

  if (options.registry) {
    command.push("--registry", options.registry);
  }

  command.push(
    "--yes",
    "--package",
    `${options.packageName}@${options.selectedVersion}`
  );

  if (!binName) {
    return command;
  }

  command.push("--", binName, ...options.targetArgs);
  return command;
}

export async function runDelegatedCommand(command: string[]): Promise<number> {
  const [binary, ...args] = command;
  if (!binary) {
    throw new Error("Cannot execute an empty delegated command");
  }

  const result = await execa(binary, args, {
    stdio: "inherit",
    reject: false
  });
  return result.exitCode ?? 1;
}

function selectBinName(packageName: string, manifest: PackageManifest): string | null {
  if (!manifest.bin) {
    return null;
  }

  if (typeof manifest.bin === "string") {
    return unscopedPackageName(manifest.name);
  }

  const unscoped = unscopedPackageName(packageName);
  if (manifest.bin[packageName]) {
    return packageName;
  }

  if (manifest.bin[unscoped]) {
    return unscoped;
  }

  const binNames = Object.keys(manifest.bin).sort();
  return binNames.length === 1 ? binNames[0] : null;
}
