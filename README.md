# npx-vet

`npx-vet` inspects npm package trust evidence before it delegates to `npm exec`.

## Usage

Inspect a package for humans:

```sh
npx-vet inspect eslint
```

Inspect a package for agents:

```sh
npx-vet inspect eslint --json
npx-vet inspect eslint --json --fail-on=high
```

Preflight a command without executing it:

```sh
npx-vet --dry-run eslint -- --version
```

Run after inspection and approval:

```sh
npx-vet eslint -- --version
```

High-risk packages are blocked unless explicitly overridden:

```sh
npx-vet --allow-risk=high some-package -- --help
```

## What It Reports

- selected, latest, and previous versions
- publish time and previous publish time
- last-week npm downloads
- maintainers and publisher
- homepage, repository, license, deprecation
- package size, file count, bins, lifecycle scripts
- npm registry signature metadata when visible
- file-level `npm diff` summary
- typosquat similarity against the top 5,000 npm package names
- machine-readable risk flags

## Typosquat Detection

Requested package names are compared against a bundled list of the top
5,000 npm packages (generated from
[`npm-high-impact`](https://www.npmjs.com/package/npm-high-impact) via
`npm run update:popular-packages`). A name that is one edit away from a
popular package (`esilnt` vs `eslint`), or a popular scoped package with
its scope flattened (`types-node` vs `@types/node`), raises a high
`POSSIBLE_TYPOSQUAT` flag and blocks execution unless overridden. Two
edits on longer names raises a medium flag. Popular packages themselves
are never flagged.

These signals are evidence, not proof that a package is safe.
