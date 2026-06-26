import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pacote from "pacote";
import { fetchRegistryEvidence, getManifest } from "../src/core/registryClient.ts";
import type { Packument, ParsedPackageSpec } from "../src/types/reportSchema.ts";

vi.mock("pacote", () => ({
  default: {
    packument: vi.fn()
  }
}));

describe("registryClient", () => {
  beforeEach(() => {
    vi.mocked(pacote.packument).mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not query public npm downloads for custom registries", async () => {
    vi.mocked(pacote.packument).mockResolvedValue(packument());

    const evidence = await fetchRegistryEvidence(spec("@company/tool"), {
      registry: "https://registry.example.test"
    });

    expect(pacote.packument).toHaveBeenCalledWith("@company/tool", {
      fullMetadata: true,
      registry: "https://registry.example.test"
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(evidence.downloadsLastWeek).toBeNull();
  });

  it("returns null downloads when public npm download metadata fails", async () => {
    vi.mocked(pacote.packument).mockResolvedValue(packument());
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network down"));

    const evidence = await fetchRegistryEvidence(spec("demo"));

    expect(evidence.downloadsLastWeek).toBeNull();
  });

  it("throws a clear error when a manifest is missing", () => {
    expect(() => getManifest(packument(), "9.9.9")).toThrow("Manifest not found for demo@9.9.9");
  });
});

function spec(name: string): ParsedPackageSpec {
  return {
    raw: name,
    name,
    type: "tag",
    fetchSpec: "latest",
    escapedName: name.replace("/", "%2f")
  };
}

function packument(): Packument {
  return {
    name: "demo",
    versions: {
      "1.0.0": {
        name: "demo",
        version: "1.0.0"
      }
    }
  };
}
