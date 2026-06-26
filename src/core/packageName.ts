export function unscopedPackageName(packageName: string): string {
  return packageName.replace(/^@[^/]+\//, "");
}
