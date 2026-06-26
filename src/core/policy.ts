import type { PackageReport, RiskLevel } from "../types/reportSchema.ts";

export type HumanPolicy = "off" | "moderate" | "strict";
export type FailOn = "none" | "medium" | "high";

export interface HumanPolicyDecision {
  allowedToPrompt: boolean;
  autoApproved: boolean;
  blocked: boolean;
  reason: string | null;
}

const FAILING_LEVELS: Record<FailOn, RiskLevel[]> = {
  none: [],
  medium: ["medium", "high"],
  high: ["high"]
};

export function shouldFailInspection(report: PackageReport, failOn: FailOn): boolean {
  return FAILING_LEVELS[failOn].includes(report.risk.level);
}

export function evaluateHumanPolicy(options: {
  report: PackageReport;
  policy: HumanPolicy;
  allowRisk: RiskLevel | null;
  yes: boolean;
}): HumanPolicyDecision {
  const { report, policy, allowRisk, yes } = options;
  const allow = (): HumanPolicyDecision => ({
    allowedToPrompt: true,
    autoApproved: yes && report.risk.level === "low",
    blocked: false,
    reason: null
  });
  const block = (reason: string): HumanPolicyDecision => ({
    allowedToPrompt: false,
    autoApproved: false,
    blocked: true,
    reason
  });

  if (policy === "off") {
    return allow();
  }

  if (report.risk.level === "high" && allowRisk !== "high") {
    return block("High-risk package execution requires --allow-risk=high");
  }

  if (
    policy === "strict"
    && report.risk.level === "medium"
    && allowRisk !== "medium"
    && allowRisk !== "high"
  ) {
    return block("Strict policy blocks medium-risk package execution unless --allow-risk=medium is passed");
  }

  return allow();
}
