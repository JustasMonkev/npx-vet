#!/usr/bin/env node
import { confirm as confirmPrompt } from "@inquirer/prompts";
import { Command, CommanderError, Option } from "commander";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { formatCommandForDisplay } from "../core/commandDisplay.ts";
import { runDelegatedCommand as runDelegatedCommandImpl } from "../core/executor.ts";
import { renderHumanReport as renderHumanReportImpl } from "../core/humanRenderer.ts";
import { inspectPackage as inspectPackageImpl } from "../core/inspector.ts";
import { evaluateHumanPolicy, shouldFailInspection, type FailOn, type HumanPolicy } from "../core/policy.ts";
import { DEFAULT_REGISTRY } from "../core/registryClient.ts";
import type { PackageReport, RiskLevel } from "../types/reportSchema.ts";

interface Output {
  writeOut(message: string): void;
  writeErr(message: string): void;
}

interface RootCommandOptions {
  policy: HumanPolicy;
  allowRisk?: RiskLevel;
  yes?: boolean;
  dryRun?: boolean;
  registry: string;
}

interface InspectCommandOptions {
  json?: boolean;
  failOn: FailOn;
  registry: string;
}

interface CliRuntime {
  confirm(options: { message: string; default: boolean }): Promise<boolean>;
  inspectPackage(packageSpec: string, options: {
    registry?: string;
    executionRequested?: boolean;
    targetArgs?: string[];
  }): Promise<PackageReport>;
  renderHumanReport(report: PackageReport): string;
  runDelegatedCommand(command: string[]): Promise<number>;
}

interface RootRunOptions {
  packageSpec: string;
  targetArgs: string[];
  policy: HumanPolicy;
  allowRisk: RiskLevel | null;
  yes: boolean;
  dryRun: boolean;
  registry?: string;
}

interface GateOptions {
  report: PackageReport;
  delegatedCommand: string[];
  policy: HumanPolicy;
  allowRisk: RiskLevel | null;
  yes: boolean;
  dryRun: boolean;
  overrideCommand: string[];
  cancelledMessage: string;
}

const CLI_NAME = "npx-vet";
// ponytail: single source of truth; ../../package.json resolves from both src/commands and dist/commands
const CLI_VERSION = createRequire(import.meta.url)("../../package.json").version as string;

const defaultOutput: Output = {
  writeOut(message: string) {
    process.stdout.write(message);
  },
  writeErr(message: string) {
    process.stderr.write(message);
  }
};

const defaultRuntime: CliRuntime = {
  confirm: confirmPrompt,
  inspectPackage: inspectPackageImpl,
  renderHumanReport: renderHumanReportImpl,
  runDelegatedCommand: runDelegatedCommandImpl
};

export async function main(argv = process.argv.slice(2), output = defaultOutput, runtime = defaultRuntime): Promise<number> {
  let result = 0;
  const program = buildProgram(output, runtime, (exitCode) => {
    result = exitCode;
  });

  try {
    await program.parseAsync(argv, {
      from: "user"
    });
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }

    throw error;
  }

  return result;
}

function buildProgram(output: Output, runtime: CliRuntime, setResult: (exitCode: number) => void): Command {
  const command = new Command()
    .name(CLI_NAME)
    .version(CLI_VERSION)
    .description("Inspect npm package trust evidence before delegating to npm exec.")
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (message) => output.writeOut(message),
      writeErr: (message) => output.writeErr(message)
    })
    .argument("[package-spec]", "npm package spec to inspect and optionally execute")
    .argument("[target-args...]", "arguments forwarded to the package binary after --")
    .addOption(new Option("--policy <policy>", "human execution policy").choices(["off", "moderate", "strict"]).default("moderate"))
    .addOption(new Option("--allow-risk <level>", "override policy block for risk level").choices(["medium", "high"]))
    .option("-y, --yes", "auto-approve low-risk execution only")
    .option("--dry-run", "inspect and show delegated command without executing")
    .option("--registry <url>", "npm registry URL", DEFAULT_REGISTRY)
    .action(async (packageSpec: string | undefined, targetArgs: string[], options: RootCommandOptions) => {
      if (!packageSpec) {
        command.outputHelp();
        setResult(0);
        return;
      }

      setResult(await runRootCommand({
        packageSpec,
        targetArgs,
        policy: options.policy,
        allowRisk: options.allowRisk ?? null,
        yes: Boolean(options.yes),
        dryRun: Boolean(options.dryRun),
        registry: options.registry
      }, output, runtime));
    });

  command
    .command("inspect")
    .description("inspect a package without installing or executing it")
    .argument("<package-spec>", "npm package spec to inspect")
    .option("--json", "print JSON output")
    .addOption(new Option("--fail-on <level>", "return non-zero for risk level").choices(["none", "medium", "high"]).default("none"))
    .option("--registry <url>", "npm registry URL", DEFAULT_REGISTRY)
    .action(async (packageSpec: string, options: InspectCommandOptions) => {
      setResult(await runInspectCommand(packageSpec, {
        ...options,
        registry: effectiveInspectRegistry(options.registry, command.opts<RootCommandOptions>().registry)
      }, output, runtime));
    });

  return command;
}

async function runInspectCommand(packageSpec: string, options: InspectCommandOptions, output: Output, runtime: CliRuntime): Promise<number> {
  const report = await runtime.inspectPackage(packageSpec, {
    registry: options.registry,
    executionRequested: false
  });

  output.writeOut(
    options.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : `${runtime.renderHumanReport(report)}\n`
  );

  return shouldFailInspection(report, options.failOn) ? 2 : 0;
}

async function runRootCommand(options: RootRunOptions, output: Output, runtime: CliRuntime): Promise<number> {
  const report = await runtime.inspectPackage(options.packageSpec, {
    registry: options.registry,
    executionRequested: true,
    targetArgs: options.targetArgs
  });

  output.writeOut(`${runtime.renderHumanReport(report)}\n`);

  if (report.artifact.bins.length === 0) {
    output.writeErr("\nBlocked: selected package does not expose an executable bin. Inspection completed, but there is no safe npm exec command to run.\n");
    return 2;
  }

  return gateAndDelegate({
    report,
    delegatedCommand: report.execution.delegatedCommand,
    policy: options.policy,
    allowRisk: options.allowRisk,
    yes: options.yes,
    dryRun: options.dryRun,
    overrideCommand: buildOverrideCommand(options, report.risk.level),
    cancelledMessage: "Cancelled. Target package was not executed."
  }, output, runtime);
}

async function gateAndDelegate(options: GateOptions, output: Output, runtime: CliRuntime): Promise<number> {
  const decision = evaluateHumanPolicy({
    report: options.report,
    policy: options.policy,
    allowRisk: options.allowRisk,
    yes: options.yes
  });

  if (decision.blocked) {
    output.writeErr(`\nBlocked: ${decision.reason}\n`);
    output.writeErr(`Override example: ${formatCommandForDisplay(options.overrideCommand)}\n`);
    return 2;
  }

  if (options.dryRun) {
    output.writeOut("\nDry run: not executing delegated command.\n");
    return 0;
  }

  const approved = decision.autoApproved || await runtime.confirm({
    message: `Proceed with ${formatCommandForDisplay(options.delegatedCommand)}?`,
    default: false
  });

  if (!approved) {
    output.writeOut(`${options.cancelledMessage}\n`);
    return 1;
  }

  return runtime.runDelegatedCommand(options.delegatedCommand);
}

function effectiveInspectRegistry(inspectRegistry: string, rootRegistry: string): string {
  return inspectRegistry === DEFAULT_REGISTRY ? rootRegistry : inspectRegistry;
}

function buildOverrideCommand(options: RootRunOptions, riskLevel: RiskLevel): string[] {
  return [
    CLI_NAME,
    ...(options.registry && options.registry !== DEFAULT_REGISTRY ? ["--registry", options.registry] : []),
    `--allow-risk=${riskLevel}`,
    options.packageSpec,
    "--",
    ...options.targetArgs
  ];
}

export function isCliEntrypoint(moduleUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvPath);
  } catch {
    return fileURLToPath(moduleUrl) === argvPath;
  }
}


if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
