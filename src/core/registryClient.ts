import pacote from "pacote";
import type { Packument, PackageManifest, ParsedPackageSpec } from "../types/reportSchema.ts";

export interface RegistryEvidence {
  packument: Packument;
  downloadsLastWeek: number | null;
  registry: string;
  fetchedAt: string;
}

export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

export async function fetchRegistryEvidence(
  spec: ParsedPackageSpec,
  options: { registry?: string } = {}
): Promise<RegistryEvidence> {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  // ponytail: fire both requests at once; downloads fetch is failure-tolerant, its result is discarded if the packument throws
  const [packument, downloadsLastWeek] = await Promise.all([
    pacote.packument(spec.name, {
      fullMetadata: true,
      registry
    }) as Promise<Packument>,
    isNpmRegistry(registry) ? fetchDownloadsLastWeek(spec.name) : null
  ]);

  return {
    packument,
    downloadsLastWeek,
    registry,
    fetchedAt: new Date().toISOString()
  };
}

export function getManifest(packument: Packument, version: string): PackageManifest {
  const manifest = packument.versions?.[version];
  if (!manifest) {
    throw new Error(`Manifest not found for ${packument.name}@${version}`);
  }
  return manifest;
}

async function fetchDownloadsLastWeek(packageName: string): Promise<number | null> {
  const encoded = encodeURIComponent(packageName);
  try {
    const response = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      return null;
    }

    const body = await response.json() as { downloads?: unknown };
    return typeof body.downloads === "number" ? body.downloads : null;
  } catch {
    return null;
  }
}

function isNpmRegistry(registry: string): boolean {
  try {
    const url = new URL(registry);
    return url.hostname === "registry.npmjs.org";
  } catch {
    return registry === DEFAULT_REGISTRY;
  }
}
