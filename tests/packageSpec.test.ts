import { describe, expect, it } from "vitest";
import { parsePackageSpec } from "../src/core/packageSpec.ts";

describe("parsePackageSpec", () => {
  it("normalizes a plain package name", () => {
    const parsed = parsePackageSpec("eslint");

    expect(parsed.name).toBe("eslint");
    expect(parsed.type).toBe("tag");
    expect(parsed.fetchSpec).toBe("latest");
  });

  it("normalizes scoped packages", () => {
    const parsed = parsePackageSpec("@scope/tool@1.2.3");

    expect(parsed.name).toBe("@scope/tool");
    expect(parsed.type).toBe("version");
    expect(parsed.fetchSpec).toBe("1.2.3");
    expect(parsed.escapedName).toBe("@scope%2ftool");
  });

  it.each([
    ["eslint@next", "tag", "next"],
    ["eslint@^8.0.0", "range", "^8.0.0"],
    ["eslint@*", "tag", "latest"],
    ["@scope/tool", "tag", "latest"]
  ])("normalizes supported registry specs: %s", (raw, type, fetchSpec) => {
    const parsed = parsePackageSpec(raw);

    expect(parsed.type).toBe(type);
    expect(parsed.fetchSpec).toBe(fetchSpec);
  });

  it.each([
    "eslint@file:./x.tgz",
    "eslint@git+https://github.com/example/eslint.git",
    "eslint@https://example.com/eslint.tgz",
    "alias-name@npm:eslint@^8.0.0"
  ])("rejects unsupported specs that can confuse the inspected target: %s", (raw) => {
    expect(() => parsePackageSpec(raw)).toThrow("Only npm registry package names");
  });
});
