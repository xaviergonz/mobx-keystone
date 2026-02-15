# Agent instructions for mobx-keystone

This repository is a pnpm + Turbo monorepo for:
- `mobx-keystone` (core library)
- `mobx-keystone-yjs` (Yjs bindings)
- `mobx-keystone-loro` (Loro bindings)
- docs site and benchmarks

## Quick facts

- Package manager: `pnpm` (`pnpm@10.28.2`)
- Task runner: `turbo`
- Build tool: Vite (library packaging) + `tsc` (type-checking)
- Language: TypeScript (`strict: true` across packages)
- Test runner: Vitest (not Jest)
- Lint/format: Biome (`pnpm lint`; auto-fix with `pnpm exec biome check --write .`)
- CI runtime: Node `24.3.0`

## Monorepo map (source of truth)

- `packages/lib`
  - Core `mobx-keystone` library.
  - Main entry: `packages/lib/src/index.ts`
  - Tests: `packages/lib/test`
- `packages/mobx-keystone-yjs`
  - Yjs integration package.
  - Main entry: `packages/mobx-keystone-yjs/src/index.ts`
  - Tests: `packages/mobx-keystone-yjs/test`
- `packages/mobx-keystone-loro`
  - Loro integration package.
  - Main entry: `packages/mobx-keystone-loro/src/index.ts`
  - Tests: `packages/mobx-keystone-loro/test`
- `apps/site`
  - Docusaurus documentation site.
  - Docs content: `apps/site/docs`
  - Generated docs assets: `apps/site/generated-static`
- `apps/benchmark`
  - Benchmark app and model comparisons.

## Core library architecture (where to edit)

`packages/lib/src` is split by concern. Use this map to avoid editing the wrong layer.

- `action`: model actions, flows, action plumbing.
- `actionMiddlewares`: middleware APIs, serialization, undo/transaction/readonly.
- `computedTree`: computed tree decorators/utilities.
- `context`: context APIs for trees.
- `dataModel`: DataModel definitions and metadata.
- `deepChange`: deep change observation and events.
- `frozen`: frozen data handling.
- `globalConfig`: global runtime configuration.
- `model` + `modelShared`: model class/decorator internals.
- `parent`: parent/child relationships, attach/detach, paths.
- `patch`: patch generation and patch application.
- `redux`: Redux/devtools integration.
- `ref`: refs, root refs, ref resolution.
- `rootStore`: root-store lifecycle and registration.
- `snapshot`: snapshot creation/reconciliation/apply/fromSnapshot.
- `standardActions`: generated/standalone action helpers.
- `transforms`: transform utilities (Date, Map/Set, etc).
- `treeUtils`: helper utilities for tree operations.
- `tweaker`: node conversion/tweaking and type-check integration.
- `types`: runtime type system and checking.
- `utils`: common utilities, error handling (`failure()`, `MobxKeystoneError`), internal decorator helpers.
- `wrappers`: wrappers such as `ObjectMap`, `ArraySet`, `asMap`, `asSet`.

Tests are organized similarly under `packages/lib/test/<area>`, though not every src area has a matching test directory (some are covered by tests in related areas).

## Integration package architecture

### `packages/mobx-keystone-yjs`

- Binding logic lives in `src/binding/*`.
- Conversion utilities: `convertJsonToYjsData.ts`, `convertYjsDataToJson.ts`.
- Text model bridge: `YjsTextModel.ts`.
- Error type: `src/utils/error.ts` (`MobxKeystoneYjsError`).
- Tests: `test/binding/*.test.ts` (e.g. `binding.test.ts`, `YjsTextModel.test.ts`, `detached.test.ts`, `snapshotCapture.test.ts`).

### `packages/mobx-keystone-loro`

- Binding logic lives in `src/binding/*`.
- Conversion utilities: `convertJsonToLoroData.ts`, `convertLoroDataToJson.ts`.
- Text model bridge: `LoroTextModel.ts`.
- Move helper: `moveWithinArray.ts`.
- Error type: `src/utils/error.ts` (`MobxKeystoneLoroError`).
- Tests: `test/binding/*.test.ts` (e.g. `binding.test.ts`, `LoroTextModel.test.ts`, `detached.test.ts`, `move.test.ts`, `convertJsonToLoroData.test.ts`, `convertLoroDataToJson.test.ts`).

## Commands (run from repo root)

### Root turbo commands

- `pnpm lib:build`
- `pnpm lib:build-docs`
- `pnpm lib:test`
- `pnpm lib:test:ci`
- `pnpm yjs-lib:build`
- `pnpm yjs-lib:test`
- `pnpm yjs-lib:test:ci`
- `pnpm loro-lib:build`
- `pnpm loro-lib:test`
- `pnpm loro-lib:test:ci`
- `pnpm site:start`
- `pnpm site:build`
- `pnpm site:serve`
- `pnpm build-netlify`
- `pnpm netlify-dev`
- `pnpm lint`

### Useful package-local commands

Use these when you need targeted debugging or one-off commands.

- `pnpm --dir packages/lib test test/<file>.test.ts`
- `pnpm --dir packages/mobx-keystone-yjs test test/<file>.test.ts`
- `pnpm --dir packages/mobx-keystone-loro test test/<file>.test.ts`
- `pnpm --dir apps/benchmark bench`

## CI parity and compatibility matrix

CI currently runs:

1. `pnpm site:build`
2. `pnpm lib:test:ci` for every combination of:
   - `COMPILER={tsc, tsc-experimental-decorators, babel, swc}`
   - `MOBX_VERSION={6,5,4}`
3. `pnpm yjs-lib:test:ci`
4. `pnpm loro-lib:test:ci`
5. `pnpm lib:build` and benchmark build in `apps/benchmark`

**Note:** `pnpm lint` is NOT part of CI. Agents must run it manually before finishing.

When changing compiler-sensitive code (decorators, transforms, model wrapping, action wrapping), run at least a reduced matrix locally, and preferably full matrix before finishing:

```bash
for compiler in tsc tsc-experimental-decorators babel swc; do
  for mobx in 6 5 4; do
    COMPILER="$compiler" MOBX_VERSION="$mobx" pnpm lib:test:ci
  done
done
```

## Turbo dependency graph (important)

- `mobx-keystone-yjs#build` depends on `mobx-keystone#build`.
- `mobx-keystone-loro#build` depends on `mobx-keystone#build`.
- `site#build` depends on:
  - `mobx-keystone#build`
  - `mobx-keystone-yjs#build`
  - `mobx-keystone-loro#build`
  - `mobx-keystone#build-docs`

Prefer root turbo commands so this dependency ordering is handled automatically.

## Test configuration

The core library test matrix is controlled by two environment variables:

- `COMPILER` (default: `tsc`): selects the transpiler — `tsc`, `tsc-experimental-decorators`, `babel`, or `swc`.
- `MOBX_VERSION` (default: `6`): selects MobX version — `6`, `5`, or `4`.

These are read by `packages/lib/env.js` and used by `packages/lib/vitest.config.ts` to:
- Pick the correct `test/tsconfig*.json` file (e.g. `tsconfig.experimental-decorators.json` for legacy decorators, `tsconfig.mobx4.json` / `tsconfig.mobx5.json` for older MobX).
- Alias the `mobx` import to `mobx-v4` or `mobx-v5` npm packages when testing older MobX versions.
- Apply the selected compiler via a Vite plugin that transpiles `.ts` files before test execution.

All packages use `test/commonSetup.ts` as a vitest setup file.

## Code standards

- Use strict TypeScript; avoid `any` unless there is no practical alternative.
- Use Biome for formatting/linting; do not hand-format around Biome.
- Keep imports/exports idiomatic to the existing style.
- Use barrel exports (`index.ts`) for public surface areas.
- Follow existing naming conventions and module boundaries.
- Do not add dependencies unless necessary; prefer existing utilities.

## Git safety

- Do not run any git write/mutation commands without express user permission (for example: staging/unstaging files, creating/amending commits, checking out/switching branches, rebasing, merging, or resetting).

## Error handling conventions

Do not throw raw strings.

- Core library errors generally go through `failure(...)` from `packages/lib/src/utils/index.ts`, which returns `MobxKeystoneError`.
- Yjs and Loro packages use package-specific error helpers/classes in `src/utils/error.ts`.
- `TypeCheckError` is in `packages/lib/src/types/TypeCheckError.ts` and should be used consistently with runtime type checking flows.

## Generated files and forbidden edit targets

Do not manually edit generated artifacts. Edit sources and regenerate instead.

- `**/dist/**`
- `packages/lib/api-docs/**`
- `packages/*/coverage/**`
- `apps/site/.docusaurus/**`
- `apps/site/build/**`
- `apps/site/generated-static/**`
- `apps/site/static/api/**`

Notes:

- The `packages/lib` `build` script copies root `README.md`, `LICENSE`, and `CHANGELOG.md` into `packages/lib/`.
- Yjs/Loro package builds copy `LICENSE` into their package folders.

## Documentation and API updates

When public behavior or public API changes:

1. Update docs in `apps/site/docs/**`.
2. Update changelog for affected package(s):
   - Core: `CHANGELOG.md` (root, copied into `packages/lib` during build)
   - Yjs: `packages/mobx-keystone-yjs/CHANGELOG.md`
   - Loro: `packages/mobx-keystone-loro/CHANGELOG.md`
3. Regenerate API/docs artifacts as needed:
   - `pnpm lib:build-docs`
   - `pnpm site:build`

`apps/site` build/start also runs LLM docs generation (`llms` scripts) and syncs root `llms.txt` into site generated output.

## Task playbooks

### Bug fix in core library

1. Reproduce with a failing test in `packages/lib/test/**`.
2. Implement minimal fix in the relevant `packages/lib/src/<area>` module.
3. Run focused tests, then broader package tests.
4. Run `pnpm lint`.
5. Run compatibility matrix if behavior may vary by MobX/compiler.

### Feature/change in Yjs or Loro bindings

1. Edit `packages/mobx-keystone-yjs/src/**` or `packages/mobx-keystone-loro/src/**`.
2. Add/update tests in matching `test/binding/**`.
3. Run package tests via root command (`pnpm yjs-lib:test` / `pnpm loro-lib:test`).
4. Run `pnpm lint`.
5. Update package changelog if behavior/API changed.

### Docs-only changes

1. Edit `apps/site/docs/**`.
2. Run `pnpm site:build` (or `pnpm site:start` for local iteration).
3. Do not hand-edit generated site folders.

### Performance-sensitive changes

If touching snapshot/patch/tweaker/model internals, run benchmarks:

- `pnpm --dir apps/benchmark bench`

## Definition of done (agent checklist)

Before finishing, ensure all applicable items are done:

1. Correct package(s) updated in `src/**` and matching tests.
2. Public exports updated (`index.ts` barrels) when API surface changed.
3. Relevant tests pass (`lib`, `yjs`, `loro` as needed).
4. Compatibility checks run for MobX/compiler-sensitive changes.
5. `pnpm lint` passes.
6. Docs/changelog updated for public behavior changes.
7. No generated artifact edited manually.
