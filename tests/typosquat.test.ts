import { describe, expect, it } from "vitest";
import { damerauLevenshtein, findTyposquatCandidate } from "../src/core/typosquat.ts";

const POPULAR = [
  "eslint",
  "lodash",
  "cross-env",
  "node-fetch",
  "minimatch",
  "@types/node",
  "@types/ws",
  "@babel/core",
  "ms"
];

describe("findTyposquatCandidate", () => {
  it("returns null for a popular package itself", () => {
    expect(findTyposquatCandidate("eslint", POPULAR)).toBeNull();
    expect(findTyposquatCandidate("@types/node", POPULAR)).toBeNull();
  });

  it("matches single-edit lookalikes", () => {
    expect(findTyposquatCandidate("esilnt", POPULAR)).toEqual({
      target: "eslint",
      reason: "edit-distance",
      distance: 1
    });
    expect(findTyposquatCandidate("crossenv", POPULAR)).toEqual({
      target: "cross-env",
      reason: "edit-distance",
      distance: 1
    });
  });

  it("matches two-edit lookalikes only for longer names", () => {
    expect(findTyposquatCandidate("nod-fetchh", POPULAR)).toEqual({
      target: "node-fetch",
      reason: "edit-distance",
      distance: 2
    });
    expect(findTyposquatCandidate("lodahs", POPULAR)).toEqual({
      target: "lodash",
      reason: "edit-distance",
      distance: 1
    });
    expect(findTyposquatCandidate("lodhsa", POPULAR)).toBeNull();
  });

  it("matches two-deletion typos of longer names even when the typo itself is short", () => {
    expect(findTyposquatCandidate("minimat", POPULAR)).toEqual({
      target: "minimatch",
      reason: "edit-distance",
      distance: 2
    });
  });

  it("matches scoped lookalikes", () => {
    expect(findTyposquatCandidate("@bable/core", POPULAR)).toEqual({
      target: "@babel/core",
      reason: "edit-distance",
      distance: 1
    });
  });

  it("matches flattened scopes as scope confusion", () => {
    expect(findTyposquatCandidate("types-node", POPULAR)).toEqual({
      target: "@types/node",
      reason: "scope-confusion",
      distance: 0
    });
    expect(findTyposquatCandidate("babel-core", POPULAR)).toEqual({
      target: "@babel/core",
      reason: "scope-confusion",
      distance: 0
    });
    expect(findTyposquatCandidate("typesnode", POPULAR)).toEqual({
      target: "@types/node",
      reason: "scope-confusion",
      distance: 0
    });
  });

  it("matches typos of flattened scoped spellings", () => {
    expect(findTyposquatCandidate("types-nodee", POPULAR)).toEqual({
      target: "@types/node",
      reason: "edit-distance",
      distance: 1
    });
    expect(findTyposquatCandidate("bablecore", POPULAR)).toEqual({
      target: "@babel/core",
      reason: "edit-distance",
      distance: 1
    });
  });

  it("applies length thresholds to basenames under a shared scope", () => {
    expect(findTyposquatCandidate("@types/gm", POPULAR)).toBeNull();
    expect(findTyposquatCandidate("@types/nodee", POPULAR)).toEqual({
      target: "@types/node",
      reason: "edit-distance",
      distance: 1
    });
  });

  it("skips names too short to compare", () => {
    expect(findTyposquatCandidate("mss", POPULAR)).toBeNull();
    expect(findTyposquatCandidate("m", POPULAR)).toBeNull();
  });

  it("returns null when nothing resembles the name", () => {
    expect(findTyposquatCandidate("my-totally-unique-package", POPULAR)).toBeNull();
  });

  it("prefers the earlier, more popular candidate on ties", () => {
    expect(findTyposquatCandidate("aa-pkg", ["ab-pkg", "ac-pkg"])).toEqual({
      target: "ab-pkg",
      reason: "edit-distance",
      distance: 1
    });
  });

  it("uses the bundled popular list by default", () => {
    expect(findTyposquatCandidate("eslint")).toBeNull();
    expect(findTyposquatCandidate("esilnt")).toMatchObject({
      target: "eslint",
      distance: 1
    });
  });
});

describe("damerauLevenshtein", () => {
  it("computes substitutions, insertions, deletions, and transpositions", () => {
    expect(damerauLevenshtein("eslint", "eslint", 2)).toBe(0);
    expect(damerauLevenshtein("a", "", 1)).toBe(1);
    expect(damerauLevenshtein("", "a", 1)).toBe(1);
    expect(damerauLevenshtein("eslinr", "eslint", 2)).toBe(1);
    expect(damerauLevenshtein("eslintt", "eslint", 2)).toBe(1);
    expect(damerauLevenshtein("eslnt", "eslint", 2)).toBe(1);
    expect(damerauLevenshtein("esilnt", "eslint", 2)).toBe(1);
  });

  it("returns null when the distance exceeds the maximum", () => {
    expect(damerauLevenshtein("react", "eslint", 2)).toBeNull();
    expect(damerauLevenshtein("a", "b", 0)).toBeNull();
  });
});
