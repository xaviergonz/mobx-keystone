# Agent instructions for mobx-keystone

## Scope and stack

- Monorepo packages: `mobx-keystone` (core), `mobx-keystone-yjs`, `mobx-keystone-loro`, docs site, benchmark app.
- Tooling: `pnpm@10.29.3`, `turbo`, Vite + `tsc`, TypeScript strict mode, Vitest, Biome.
- CI runtime: Node `25.6.1`.

## Skills

- Source of truth is `skills/**`.
- Never edit mirrored skill folders directly.
- After skill edits run `pnpm skills:sync` (repo root).

## Monorepo map

- Core library: `packages/lib` (`src/index.ts`, tests in `test`).
- Yjs package: `packages/mobx-keystone-yjs` (`src/index.ts`, tests in `test`).
- Loro package: `packages/mobx-keystone-loro` (`src/index.ts`, tests in `test`).
- Docs site: `apps/site` (docs in `apps/site/docs`; generated output in `apps/site/generated-static`).
- Benchmarks: `apps/benchmark`.

## Where to edit

- Core source folders in `packages/lib/src`: `action`, `actionMiddlewares`, `computedTree`, `context`, `dataModel`, `deepChange`, `frozen`, `globalConfig`, `model`, `modelShared`, `parent`, `patch`, `redux`, `ref`, `rootStore`, `snapshot`, `standardActions`, `transforms`, `treeUtils`, `tweaker`, `types`, `utils`, `wrappers`.
- Core tests are mostly mirrored under `packages/lib/test/<area>`.
- Yjs binding code: `packages/mobx-keystone-yjs/src/binding/*`; converters: `convertJsonToYjsData.ts`, `convertYjsDataToJson.ts`; text bridge: `YjsTextModel.ts`; errors: `src/utils/error.ts`.
- Loro binding code: `packages/mobx-keystone-loro/src/binding/*`; converters: `convertJsonToLoroData.ts`, `convertLoroDataToJson.ts`; text bridge: `LoroTextModel.ts`; move helper: `moveWithinArray.ts`; errors: `src/utils/error.ts`.

## Commands (run from repo root)

- Primary: `pnpm lib:build`, `pnpm lib:build-docs`, `pnpm lib:test`, `pnpm lib:test:ci`, `pnpm yjs-lib:build`, `pnpm yjs-lib:test`, `pnpm yjs-lib:test:ci`, `pnpm loro-lib:build`, `pnpm loro-lib:test`, `pnpm loro-lib:test:ci`, `pnpm site:start`, `pnpm site:build`, `pnpm site:serve`, `pnpm build-netlify`, `pnpm netlify-dev`, `pnpm lint`.
- Targeted: `pnpm --dir packages/lib quick-build`, `pnpm --dir packages/lib quick-build-tests`, `pnpm --dir packages/lib test test/<file>.test.ts`, `pnpm --dir packages/mobx-keystone-yjs test test/<file>.test.ts`, `pnpm --dir packages/mobx-keystone-loro test test/<file>.test.ts`, `pnpm --dir apps/benchmark bench`.

## CI parity and matrix

- CI runs: `pnpm site:build`; core `pnpm lib:test:ci` for `COMPILER={tsc,tsc-experimental-decorators,babel,swc}` x `MOBX_VERSION={6,5,4}`; `pnpm yjs-lib:test:ci`; `pnpm loro-lib:test:ci`; `pnpm lib:build` + benchmark build.
- `pnpm lint` is not in CI; run it before finishing.
- For compiler-sensitive core changes (decorators/transforms/model/action wrapping), run at least a reduced local matrix; prefer full matrix:

```bash
for compiler in tsc tsc-experimental-decorators babel swc; do
  for mobx in 6 5 4; do
    COMPILER="$compiler" MOBX_VERSION="$mobx" pnpm lib:test:ci
  done
done
```

## Turbo dependency reminders

- `mobx-keystone-yjs#build` and `mobx-keystone-loro#build` depend on `mobx-keystone#build`.
- `site#build` depends on `mobx-keystone#build`, `mobx-keystone-yjs#build`, `mobx-keystone-loro#build`, `mobx-keystone#build-docs`.
- Prefer root turbo commands so ordering is handled automatically.

## Test configuration details

- Core test env vars:
  - `COMPILER` (default `tsc`): `tsc`, `tsc-experimental-decorators`, `babel`, `swc`.
  - `MOBX_VERSION` (default `6`): `6`, `5`, `4`.
- Matrix logic lives in `packages/lib/env.js` and `packages/lib/vitest.config.ts` (tsconfig selection, MobX aliasing to `mobx-v4`/`mobx-v5`, compiler plugin).
- Vitest setup file across packages: `test/commonSetup.ts`.
- For TS type assertions in tests use:

```ts
import { _, assert } from "spec.ts"
```

## Standards and safety

- TypeScript strict style; avoid `any` unless necessary.
- Use Biome (`pnpm lint`; autofix: `pnpm exec biome check --write .`).
- Keep imports/exports idiomatic; use `index.ts` barrels for public API.
- Avoid new dependencies unless necessary.
- Git safety: do not run git write/mutation commands without explicit user permission  (for example: staging/unstaging files, creating/amending commits, checking out/switching branches, rebasing, merging, or resetting). Use `gh` for GitHub operations.

## Error handling conventions

- Never throw raw strings.
- Core library: use `failure(...)` from `packages/lib/src/utils/index.ts` (`MobxKeystoneError`).
- Yjs/Loro: use package-specific helpers in `src/utils/error.ts`.
- Runtime type-check flows should consistently use `TypeCheckError` (`packages/lib/src/types/TypeCheckError.ts`).

## Generated/forbidden paths

- Never hand-edit generated artifacts; edit sources and regenerate.
- Forbidden targets: `**/dist/**`, `packages/lib/api-docs/**`, `packages/*/coverage/**`, `apps/site/.docusaurus/**`, `apps/site/build/**`, `apps/site/generated-static/**`, `apps/site/static/api/**`.
- Build copy notes: core build copies root `README.md`, `LICENSE`, `CHANGELOG.md` into `packages/lib`; Yjs/Loro builds copy `LICENSE`.

## Docs and changelog policy

- Update docs (`apps/site/docs/**`) for public-facing behavior/API changes.
- Update changelog only for public-facing changes (API changes, features, user-visible fixes, meaningful user-visible perf improvements), unless user says otherwise.
- Do not update changelog for internal-only changes (tests, refactors, comments, CI/tooling maintenance).
- Changelog files by package: core `CHANGELOG.md`, Yjs `packages/mobx-keystone-yjs/CHANGELOG.md`, Loro `packages/mobx-keystone-loro/CHANGELOG.md`.
- Regenerate docs artifacts when needed: `pnpm lib:build-docs`, `pnpm site:build`.
- `apps/site` build/start runs LLM docs generation and syncs root `llms.txt`.

## Task playbooks

- Core bug fix: add failing test (`packages/lib/test/**`) -> minimal fix in matching `packages/lib/src/<area>` -> run focused then broader tests -> run `pnpm lint` -> run matrix if needed.
- Yjs/Loro feature/change: edit `src/**` + matching `test/binding/**` -> run `pnpm yjs-lib:test` or `pnpm loro-lib:test` -> run `pnpm lint` -> update package changelog if public-facing.
- Docs-only: edit `apps/site/docs/**` -> run `pnpm site:build` (or `pnpm site:start`) -> never edit generated site folders.
- Performance-sensitive core internals (`snapshot`/`patch`/`tweaker`/`model`): run `pnpm --dir apps/benchmark bench`.

## Definition of done

1. Correct package source and tests updated.
2. Public exports updated when API surface changes.
3. Relevant tests pass (`lib` / `yjs` / `loro` as applicable).
4. Compiler/MobX compatibility checks run when relevant.
5. For core changes: `pnpm --dir packages/lib quick-build` and `pnpm --dir packages/lib quick-build-tests` pass.
6. `pnpm lint` passes.
7. Public-facing changes have docs/changelog updates (unless explicitly skipped).
8. No generated artifact was manually edited.
