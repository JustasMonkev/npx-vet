import { POPULAR_PACKAGES } from "../data/popularPackages.ts";

export interface TyposquatMatch {
  target: string;
  reason: "edit-distance" | "scope-confusion";
  distance: number;
}

// Names shorter than this collide with too many legitimate short names to compare by edit distance.
const MIN_EDIT_DISTANCE_LENGTH = 4;
// Allowing two edits on short names would match half the registry.
const TWO_EDIT_MIN_LENGTH = 8;

export function findTyposquatCandidate(
  packageName: string,
  popularPackages: readonly string[] = POPULAR_PACKAGES
): TyposquatMatch | null {
  const popular = new Set(popularPackages);
  if (popular.has(packageName)) {
    return null;
  }

  const scopeConfusion = findScopeConfusion(packageName, popularPackages);
  if (scopeConfusion) {
    return scopeConfusion;
  }

  return findEditDistanceMatch(packageName, popularPackages);
}

// Catches scope-flattening squats such as "babel-core" impersonating "@babel/core":
// the flattened form reads identically at a glance but is a different registry entry.
function findScopeConfusion(packageName: string, popularPackages: readonly string[]): TyposquatMatch | null {
  if (packageName.startsWith("@")) {
    return null;
  }

  for (const candidate of popularPackages) {
    if (!candidate.startsWith("@")) {
      continue;
    }
    const unscoped = candidate.slice(1);
    if (unscoped.replace("/", "-") === packageName || unscoped.replace("/", "") === packageName) {
      return { target: candidate, reason: "scope-confusion", distance: 0 };
    }
  }

  return null;
}

// The string pairs actually worth edit-distancing for a candidate. A shared
// scope contributes zero edits, so compare basenames there; an unscoped
// request is compared against a scoped candidate's flattened spellings so a
// typo of "types-node" is still measured against "@types/node".
function comparablePairs(packageName: string, candidate: string): [string, string][] {
  if (packageName.startsWith("@") && candidate.startsWith("@")) {
    const scopeEnd = packageName.indexOf("/");
    if (scopeEnd !== -1 && candidate.startsWith(packageName.slice(0, scopeEnd + 1))) {
      return [[packageName.slice(scopeEnd + 1), candidate.slice(scopeEnd + 1)]];
    }
    return [[packageName, candidate]];
  }

  if (!packageName.startsWith("@") && candidate.startsWith("@")) {
    const unscoped = candidate.slice(1);
    return [
      [packageName, unscoped.replace("/", "-")],
      [packageName, unscoped.replace("/", "")]
    ];
  }

  return [[packageName, candidate]];
}

function allowedDistance(length: number): number {
  if (length >= TWO_EDIT_MIN_LENGTH) {
    return 2;
  }
  return length >= MIN_EDIT_DISTANCE_LENGTH ? 1 : 0;
}

function findEditDistanceMatch(packageName: string, popularPackages: readonly string[]): TyposquatMatch | null {
  if (packageName.length < MIN_EDIT_DISTANCE_LENGTH) {
    return null;
  }

  let best: TyposquatMatch | null = null;
  for (const candidate of popularPackages) {
    for (const [a, b] of comparablePairs(packageName, candidate)) {
      // Deletions shorten the typo below the target, so budget by the longer name.
      const maxDistance = allowedDistance(Math.max(a.length, b.length));
      if (maxDistance === 0 || Math.abs(a.length - b.length) > maxDistance) {
        continue;
      }

      const distance = damerauLevenshtein(a, b, best ? Math.min(maxDistance, best.distance - 1) : maxDistance);
      if (distance !== null) {
        // The list is popularity-ordered, so on ties the earlier (more popular) candidate wins.
        best = { target: candidate, reason: "edit-distance", distance };
      }
    }

    if (best?.distance === 1) {
      break;
    }
  }

  return best;
}

// Optimal string alignment distance (Damerau-Levenshtein with adjacent
// transpositions). Returns null when the distance exceeds maxDistance.
export function damerauLevenshtein(a: string, b: string, maxDistance: number): number | null {
  if (maxDistance < 0) {
    return null;
  }

  if (a.length === 0 || b.length === 0) {
    const distance = Math.max(a.length, b.length);
    return distance <= maxDistance ? distance : null;
  }

  const rows = a.length + 1;
  const columns = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_, row) => {
    const line = new Array<number>(columns).fill(0);
    line[0] = row;
    return line;
  });
  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    let rowMinimum = Number.MAX_SAFE_INTEGER;
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = a[row - 1] === b[column - 1] ? 0 : 1;
      let cost = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );

      if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) {
        cost = Math.min(cost, matrix[row - 2][column - 2] + 1);
      }

      matrix[row][column] = cost;
      rowMinimum = Math.min(rowMinimum, cost);
    }

    if (rowMinimum > maxDistance) {
      return null;
    }
  }

  const distance = matrix[a.length][b.length];
  return distance <= maxDistance ? distance : null;
}
