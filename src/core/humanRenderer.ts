import type { PackageReport, RiskFlag } from "../types/reportSchema.ts";
import { formatCommandForDisplay, sanitizeForTerminal } from "./commandDisplay.ts";

type TableRow = string[];

const DETAIL_WIDTHS = [20, 74];
const RISK_WIDTHS = [8, 26, 58];

export function renderHumanReport(report: PackageReport): string {
  const lines = [
    `Safe NPX inspection: ${sanitizeForTerminal(report.package.name)}@${sanitizeForTerminal(report.package.selectedVersion)}`,
    "",
    "Summary",
    ...renderKeyValueTable([
      ["Verdict", `${report.risk.level.toUpperCase()} (score ${report.risk.score})`],
      ["Requested", report.package.requested],
      ["Latest", report.package.latestVersion ?? "unknown"],
      ["Previous", report.package.previousVersion ?? "none"],
      ["Published", report.metadata.publishTime || "unknown"],
      ["Downloads", formatNullableNumber(report.metadata.downloadsLastWeek)]
    ]),
    "",
    "Package metadata",
    ...renderKeyValueTable([
      ["Maintainers", formatList(report.metadata.maintainers, "unknown")],
      ["Publisher", report.metadata.publisher ?? "unknown"],
      ["Repository", report.metadata.repository || "missing"],
      ["Homepage", report.metadata.homepage || "missing"],
      ["License", report.metadata.license || "unknown"]
    ]),
    "",
    "Artifact",
    ...renderKeyValueTable([
      ["Bins", formatList(report.artifact.bins, "none")],
      ["Lifecycle scripts", formatList(report.artifact.lifecycleScripts, "none")],
      ["Size", `${formatNullableNumber(report.artifact.fileCount)} files, ${formatBytes(report.artifact.unpackedSize)}`],
      ["Signature", report.artifact.signature.present ? `present (${report.artifact.signature.keyId ?? "unknown key"})` : "not visible"]
    ]),
    "",
    "Latest diff",
    ...renderKeyValueTable([
      ["Compared", `${report.diff.comparedFrom ?? "none"} -> ${report.diff.comparedTo}`],
      ["Changed files", String(report.diff.filesChanged.length)],
      ["New bins", formatList(report.diff.newBins, "none")],
      ["New scripts", formatList(report.diff.newLifecycleScripts, "none")],
      ["Dependency changes", String(report.diff.dependencyChanges.length)],
      ...(report.diff.unavailableReason ? [["Diff note", report.diff.unavailableReason]] : [])
    ]),
    "",
    "Risk flags",
    ...renderRiskFlagTable(report.risk.flags),
    "",
    // Don't hand out a copy-pasteable command for a package we consider high risk.
    report.risk.level === "high"
      ? "Command withheld: risk verdict is HIGH."
      : `Would run: ${formatCommandForDisplay(report.execution.delegatedCommand)}`,
    "",
    "These signals are evidence, not proof that the package is safe."
  ];

  return lines.join("\n");
}

function renderKeyValueTable(rows: TableRow[]): string[] {
  return renderTable(["Field", "Value"], rows, DETAIL_WIDTHS);
}

function renderRiskFlagTable(flags: RiskFlag[]): string[] {
  if (flags.length === 0) {
    return renderTable(["Level", "Flag", "Message"], [["-", "none", "-"]], RISK_WIDTHS);
  }

  const rows = flags.slice(0, 12).map((flag) => [flag.level, flag.id, flag.message]);
  if (flags.length > rows.length) {
    rows.push(["-", `${flags.length - rows.length} more`, "Run with --json to inspect every risk flag."]);
  }

  return renderTable(["Level", "Flag", "Message"], rows, RISK_WIDTHS);
}

function renderTable(headers: TableRow, rows: TableRow[], widths: number[]): string[] {
  const border = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
  const lines = [
    border,
    renderTableLine(headers, widths),
    border
  ];

  for (const row of rows) {
    const cells = row.map((cell, index) => wrapCell(cell, widths[index] ?? 20));
    const height = Math.max(...cells.map((cell) => cell.length));

    for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
      lines.push(renderTableLine(cells.map((cell) => cell[rowIndex] ?? ""), widths));
    }
  }

  lines.push(border);
  return lines;
}

function renderTableLine(cells: TableRow, widths: number[]): string {
  return `| ${cells.map((cell, index) => sanitizeForTerminal(cell).padEnd(widths[index] ?? 20)).join(" | ")} |`;
}

function wrapCell(value: string, width: number): string[] {
  const words = sanitizeForTerminal(value).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = "";
      }

      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current || lines.length === 0) {
    lines.push(current);
  }

  return lines;
}

function formatList(items: string[], emptyValue: string): string {
  return items.length > 0 ? items.join(", ") : emptyValue;
}

function formatNullableNumber(value: number | null): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "unknown";
}

function formatBytes(value: number | null): string {
  if (typeof value !== "number") {
    return "unknown size";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
