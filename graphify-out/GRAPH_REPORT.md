# Graph Report - .  (2026-06-27)

## Corpus Check
- Corpus is ~8,527 words - fits in a single context window. You may not need a graph.

## Summary
- 237 nodes · 517 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_CLI Gate Policy|CLI Gate Policy]]
- [[_COMMUNITY_Registry Version Resolution|Registry Version Resolution]]
- [[_COMMUNITY_Package Manifest Dependencies|Package Manifest Dependencies]]
- [[_COMMUNITY_Inspection Delegation|Inspection Delegation]]
- [[_COMMUNITY_Risk Report Schema|Risk Report Schema]]
- [[_COMMUNITY_Diff Analysis|Diff Analysis]]
- [[_COMMUNITY_Human Output Rendering|Human Output Rendering]]
- [[_COMMUNITY_TypeScript Build Config|TypeScript Build Config]]
- [[_COMMUNITY_NPM Scripts|NPM Scripts]]
- [[_COMMUNITY_Build Script Rationale|Build Script Rationale]]

## God Nodes (most connected - your core abstractions)
1. `resolveVersions()` - 24 edges
2. `inspectPackage()` - 22 edges
3. `evaluateRisk()` - 18 edges
4. `PackageReport` - 17 edges
5. `PackageManifest` - 17 edges
6. `compilerOptions` - 17 edges
7. `renderHumanReport()` - 13 edges
8. `fetchRegistryEvidence()` - 13 edges
9. `parsePackageSpec()` - 12 edges
10. `Packument` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Agent JSON Inspection Output` --semantically_similar_to--> `runInspectCommand()`  [INFERRED] [semantically similar]
  README.md → src/commands/cli.ts
- `Human Inspection Output` --semantically_similar_to--> `runInspectCommand()`  [INFERRED] [semantically similar]
  README.md → src/commands/cli.ts
- `Dry Run Preflight` --semantically_similar_to--> `gateAndDelegate()`  [INFERRED] [semantically similar]
  README.md → src/commands/cli.ts
- `npm exec Delegation` --semantically_similar_to--> `buildNpmExecCommand()`  [INFERRED] [semantically similar]
  README.md → src/core/executor.ts
- `High Risk Override` --semantically_similar_to--> `evaluateHumanPolicy()`  [INFERRED] [semantically similar]
  README.md → src/core/policy.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Inspection Report Pipeline** — core_inspector_inspectpackage, core_packagespec_parsepackagespec, core_registryclient_fetchregistryevidence, core_versionresolver_resolveversions, core_diffanalyzer_analyzediff, core_executor_buildnpmexeccommand, core_riskengine_evaluaterisk, types_reportschema_packagereportschema [EXTRACTED 1.00]
- **Execution Gate Flow** — commands_cli_runrootcommand, commands_cli_gateanddelegate, core_policy_evaluatehumanpolicy, core_commanddisplay_formatcommandfordisplay, core_executor_rundelegatedcommand, readme_high_risk_override [INFERRED 0.85]
- **Risk Evidence Model** — core_riskengine_evaluaterisk, core_diffanalyzer_hasnativeorbinaryfile, core_diffanalyzer_lifecyclescriptnames, core_registryclient_fetchregistryevidence, types_reportschema_riskflag, readme_trust_evidence [INFERRED 0.85]
- **Fail Closed Version And Manifest Selection** — tests_versionresolver_test_exact_version_fail_closed, tests_versionresolver_test_dist_tag_validation, tests_versionresolver_test_range_fail_closed, tests_registryclient_test_missing_manifest_error [INFERRED 0.85]
- **Risk Evaluation Policy Gate** — core_riskengine_evaluaterisk, core_policy_shouldfailinspection, core_policy_evaluatehumanpolicy, tests_policy_test_reportwithrisk [INFERRED 0.75]
- **Package Spec Registry Resolution Flow** — core_packagespec_parsepackagespec, core_registryclient_fetchregistryevidence, core_versionresolver_resolveversions, core_registryclient_getmanifest [INFERRED 0.75]

## Communities (10 total, 1 thin omitted)

### Community 0 - "CLI Gate Policy"
Cohesion: 0.09
Nodes (37): buildOverrideCommand(), buildProgram(), CliRuntime, defaultOutput, defaultRuntime, effectiveInspectRegistry(), gateAndDelegate(), GateOptions (+29 more)

### Community 1 - "Registry Version Resolution"
Cohesion: 0.10
Nodes (36): isSupportedSpecType(), parsePackageSpec(), SUPPORTED_SPEC_TYPES, DEFAULT_REGISTRY, fetchDownloadsLastWeek(), fetchRegistryEvidence(), getManifest(), isNpmRegistry() (+28 more)

### Community 2 - "Package Manifest Dependencies"
Cohesion: 0.06
Nodes (31): bin, npx-vet, default, dependencies, commander, execa, @inquirer/prompts, npm-package-arg (+23 more)

### Community 3 - "Inspection Delegation"
Cohesion: 0.15
Nodes (19): binNames(), buildNpmExecCommand(), BuildNpmExecCommandOptions, runDelegatedCommand(), selectBinName(), InspectOptions, inspectPackage(), normalizePeople() (+11 more)

### Community 4 - "Risk Report Schema"
Cohesion: 0.20
Nodes (20): artifactJumped(), daysBetween(), daysSince(), evaluateRisk(), FLAG_SCORE, formatAge(), RiskInput, riskLevelFromFlags() (+12 more)

### Community 5 - "Diff Analysis"
Cohesion: 0.19
Nodes (21): analyzeDiff(), buildDiffSummary(), collectDependencies(), compareDependencies(), compareManifests(), decodeGitPath(), DiffInput, emptyFileDiff() (+13 more)

### Community 6 - "Human Output Rendering"
Cohesion: 0.20
Nodes (17): formatCommandForDisplay(), quoteShellToken(), sanitizeForTerminal(), DETAIL_WIDTHS, formatBytes(), formatList(), formatNullableNumber(), renderHumanReport() (+9 more)

### Community 7 - "TypeScript Build Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+10 more)

### Community 8 - "NPM Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, clean, inspect:eslint, pack:dry, postbuild, prepack, test (+1 more)

## Knowledge Gaps
- **71 isolated node(s):** `name`, `version`, `description`, `license`, `type` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolveVersions()` connect `Registry Version Resolution` to `Inspection Delegation`, `Risk Report Schema`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `inspectPackage()` connect `Inspection Delegation` to `CLI Gate Policy`, `Registry Version Resolution`, `Risk Report Schema`, `Diff Analysis`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `PackageReport` connect `CLI Gate Policy` to `Inspection Delegation`, `Risk Report Schema`, `Human Output Rendering`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `resolveVersions()` (e.g. with `parsePackageSpec()` and `fetchRegistryEvidence()`) actually correct?**
  _`resolveVersions()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `inspectPackage()` (e.g. with `runInspectCommand()` and `runRootCommand()`) actually correct?**
  _`inspectPackage()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `evaluateRisk()` (e.g. with `diffSummary()` and `previousManifest()`) actually correct?**
  _`evaluateRisk()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _72 weakly-connected nodes found - possible documentation gaps or missing edges._