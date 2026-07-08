import { execa } from "execa";
import type { DependencyChange, DiffSummary, PackageManifest } from "../types/reportSchema.ts";
import { unscopedPackageName } from "./packageName.ts";

const LIFECYCLE_SCRIPT_NAMES = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepublish",
  "prepack",
  "prepare",
  "postpack",
  "preprepare",
  "postprepare"
]);

const NATIVE_OR_BINARY_EXTENSIONS = [
  ".node",
  ".dll",
  ".dylib",
  ".so",
  ".exe",
  ".wasm",
  ".jar",
  ".bin"
];

export interface DiffInput {
  packageName: string;
  previousVersion: string | null;
  selectedVersion: string;
  previousManifest: PackageManifest | null;
  selectedManifest: PackageManifest;
  registry?: string;
}

export async function analyzeDiff(input: DiffInput): Promise<DiffSummary> {
  const manifestDiff = compareManifests(input.previousManifest, input.selectedManifest);

  if (!input.previousVersion || !input.previousManifest) {
    return buildDiffSummary(
      null,
      input.selectedVersion,
      manifestDiff,
      emptyFileDiff(),
      "No previous version exists for comparison"
    );
  }

  try {
    const args = [
      "diff",
      `--diff=${input.packageName}@${input.previousVersion}`,
      `--diff=${input.packageName}@${input.selectedVersion}`
    ];

    if (input.registry) {
      args.push("--registry", input.registry);
    }

    const result = await execa("npm", args, {
      reject: false,
      timeout: 120_000
    });

    if (result.exitCode !== 0) {
      return unavailableDiff(input, manifestDiff, result.stderr || result.stdout || "npm diff failed");
    }

    const parsed = parseNpmDiffOutput(result.stdout);

    return buildDiffSummary(input.previousVersion, input.selectedVersion, manifestDiff, parsed, null);
  } catch (error) {
    return unavailableDiff(input, manifestDiff, error instanceof Error ? error.message : String(error));
  }
}

export function hasNativeOrBinaryFile(diff: DiffSummary): boolean {
  const allFiles = [
    ...diff.filesAdded,
    ...diff.filesChanged,
    ...(diff.binaryFiles ?? [])
  ];

  if ((diff.binaryFiles ?? []).length > 0) {
    return true;
  }

  return allFiles.some((file) => {
    const lowerCaseFile = file.toLowerCase();
    return NATIVE_OR_BINARY_EXTENSIONS.some((extension) => lowerCaseFile.endsWith(extension));
  });
}

function parseNpmDiffOutput(output: string): Pick<DiffSummary, "filesAdded" | "filesRemoved" | "filesChanged" | "binaryFiles"> {
  const entries: Array<{ file: string; status: "added" | "removed" | "changed" }> = [];
  const binaryFiles = new Set<string>();
  let current: { file: string; status: "added" | "removed" | "changed" } | null = null;

  for (const line of output.split("\n")) {
    const diffPaths = parseDiffGitLine(line);
    if (diffPaths) {
      if (current) {
        entries.push(current);
      }
      current = {
        file: diffPaths.after,
        status: "changed"
      };
      continue;
    }

    const binaryPath = parseBinaryFilesLine(line);
    if (binaryPath) {
      binaryFiles.add(binaryPath);
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("new file mode")) {
      current.status = "added";
    } else if (line.startsWith("deleted file mode")) {
      current.status = "removed";
    }
  }

  if (current) {
    entries.push(current);
  }

  const filesAdded = new Set<string>();
  const filesRemoved = new Set<string>();
  const filesChanged = new Set<string>();

  for (const entry of entries) {
    if (!entry.file) {
      continue;
    }

    if (entry.status === "added") {
      filesAdded.add(entry.file);
    } else if (entry.status === "removed") {
      filesRemoved.add(entry.file);
    } else {
      filesChanged.add(entry.file);
    }
  }

  return {
    filesAdded: [...filesAdded].sort(),
    filesRemoved: [...filesRemoved].sort(),
    filesChanged: [...filesChanged].sort(),
    binaryFiles: [...binaryFiles].sort()
  };
}

function parseDiffGitLine(line: string): { before: string; after: string } | null {
  const unquoted = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  if (unquoted) {
    return {
      before: unquoted[1] ?? "",
      after: unquoted[2] ?? ""
    };
  }

  const quoted = /^diff --git ("(?:\\.|[^"])+") ("(?:\\.|[^"])+")$/.exec(line);
  if (!quoted) {
    return null;
  }

  return {
    before: stripDiffPrefix(decodeGitPath(quoted[1] ?? "")),
    after: stripDiffPrefix(decodeGitPath(quoted[2] ?? ""))
  };
}

function parseBinaryFilesLine(line: string): string | null {
  const match = /^Binary files (.+) and (.+) differ$/.exec(line);
  if (!match) {
    return null;
  }

  const before = parseDiffPath(match[1] ?? "");
  const after = parseDiffPath(match[2] ?? "");
  return after !== "/dev/null" ? after : before;
}

function parseDiffPath(value: string): string {
  return stripDiffPrefix(value.startsWith("\"") ? decodeGitPath(value) : value);
}

function decodeGitPath(value: string): string {
  try {
    return JSON.parse(value) as string;
  } catch {
    return value.replace(/^"|"$/g, "").replaceAll("\\\"", "\"").replaceAll("\\\\", "\\");
  }
}

function stripDiffPrefix(path: string): string {
  return path.replace(/^[ab]\//, "");
}

function unavailableDiff(
  input: DiffInput,
  manifestDiff: Pick<DiffSummary, "newBins" | "newLifecycleScripts" | "dependencyChanges">,
  reason: string
): DiffSummary {
  return buildDiffSummary(input.previousVersion, input.selectedVersion, manifestDiff, emptyFileDiff(), reason);
}

function buildDiffSummary(
  comparedFrom: string | null,
  comparedTo: string,
  manifestDiff: Pick<DiffSummary, "newBins" | "newLifecycleScripts" | "dependencyChanges">,
  fileDiff: Pick<DiffSummary, "filesAdded" | "filesRemoved" | "filesChanged" | "binaryFiles">,
  unavailableReason: string | null
): DiffSummary {
  return {
    comparedFrom,
    comparedTo,
    ...fileDiff,
    ...manifestDiff,
    unavailableReason
  };
}

function emptyFileDiff(): Pick<DiffSummary, "filesAdded" | "filesRemoved" | "filesChanged" | "binaryFiles"> {
  return {
    filesAdded: [],
    filesRemoved: [],
    filesChanged: [],
    binaryFiles: []
  };
}

function compareManifests(
  previousManifest: PackageManifest | null,
  selectedManifest: PackageManifest
): Pick<DiffSummary, "newBins" | "newLifecycleScripts" | "dependencyChanges"> {
  const previousBins = new Set(binNames(previousManifest));
  const selectedBins = binNames(selectedManifest);
  const previousScripts = previousManifest?.scripts ?? {};
  const selectedScripts = selectedManifest.scripts ?? {};

  return {
    newBins: selectedBins.filter((bin) => !previousBins.has(bin)),
    newLifecycleScripts: Object.keys(selectedScripts).filter((scriptName) => {
      return LIFECYCLE_SCRIPT_NAMES.has(scriptName) && previousScripts[scriptName] !== selectedScripts[scriptName];
    }),
    dependencyChanges: compareDependencies(previousManifest, selectedManifest)
  };
}

function compareDependencies(
  previousManifest: PackageManifest | null,
  selectedManifest: PackageManifest
): DependencyChange[] {
  const previous = collectDependencies(previousManifest);
  const selected = collectDependencies(selectedManifest);
  const names = new Set([...Object.keys(previous), ...Object.keys(selected)]);
  const changes: DependencyChange[] = [];

  for (const name of [...names].sort()) {
    const previousRange = previous[name] ?? null;
    const selectedRange = selected[name] ?? null;
    if (previousRange === selectedRange) {
      continue;
    }

    changes.push({
      name,
      previous: previousRange,
      selected: selectedRange,
      type: previousRange === null ? "added" : selectedRange === null ? "removed" : "changed"
    });
  }

  return changes;
}

function collectDependencies(manifest: PackageManifest | null): Record<string, string> {
  return {
    ...(manifest?.dependencies ?? {}),
    ...(manifest?.optionalDependencies ?? {}),
    ...(manifest?.peerDependencies ?? {})
  };
}

export function binNames(manifest: PackageManifest | null): string[] {
  if (!manifest?.bin) {
    return [];
  }

  if (typeof manifest.bin === "string") {
    return [unscopedPackageName(manifest.name)];
  }

  return Object.keys(manifest.bin).sort();
}

export function lifecycleScriptNames(manifest: PackageManifest): string[] {
  return Object.keys(manifest.scripts ?? {})
    .filter((scriptName) => LIFECYCLE_SCRIPT_NAMES.has(scriptName))
    .sort();
}
