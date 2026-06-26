# npx-vet

`npx-vet` inspects npm package trust evidence before it delegates to `npm exec`.

It is built for Node.js 24+ with TypeScript 7 RC. Inspection is side-effect-free: it reads npm registry metadata, download counts, package manifests, and `npm diff` output without installing or executing the target package.

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
- machine-readable risk flags

These signals are evidence, not proof that a package is safe.
