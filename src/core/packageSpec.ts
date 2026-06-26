import npa from "npm-package-arg";
import type { ParsedPackageSpec } from "../types/reportSchema.ts";

const SUPPORTED_SPEC_TYPES = new Set(["range", "tag", "version"] as const);

export function parsePackageSpec(raw: string): ParsedPackageSpec {
  const parsed = npa(raw);

  if (!parsed.name) {
    throw new Error(`Package spec must resolve to a package name: ${raw}`);
  }

  if (!parsed.registry || !isSupportedSpecType(parsed.type)) {
    throw new Error(`Only npm registry package names, tags, versions, and ranges are supported: ${raw}`);
  }

  const barePackageRequest = parsed.type === "range" && parsed.fetchSpec === "*";

  return {
    raw,
    name: parsed.name,
    type: barePackageRequest ? "tag" : parsed.type,
    fetchSpec: barePackageRequest ? "latest" : typeof parsed.fetchSpec === "string" ? parsed.fetchSpec : null,
    escapedName: parsed.escapedName ?? parsed.name.replace("/", "%2f")
  };
}

function isSupportedSpecType(type: string): type is ParsedPackageSpec["type"] {
  return SUPPORTED_SPEC_TYPES.has(type as ParsedPackageSpec["type"]);
}
