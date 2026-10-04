import { defineConfig } from "vite-plus"

export default defineConfig({
  run: {
    // On macOS the TypeScript 7 native tsc binary is signed with Hardened Runtime, so the vp run
    // cache cannot track the files it reads and would replay stale results. Tasks that run tsc
    // must use `cache: false` until a stable TypeScript release ships
    // https://github.com/microsoft/typescript-go/pull/4868
    // (see https://github.com/voidzero-dev/vite-task/issues/587).
    // Each of those tasks has a `// restore:` comment with its proper cache setting.
    tasks: {
      "quick-build": {
        command: "tsc",
        cache: false, // restore: remove this line (default caching; tsc runs with noEmit)
      },
      "quick-build-tests": {
        command: "tsc -p test",
        cache: false, // restore: remove this line (default caching; tsc runs with noEmit)
      },
      // Not cached: a cached run would be replayed without deleting anything.
      "clean-dist": {
        command: "shx rm -rf dist",
        cache: false,
      },
      "build-types": {
        command:
          "tsc --noEmit false --noEmitOnError --emitDeclarationOnly --declarationDir dist/types",
        cache: false, // restore: remove this line (default caching)
      },
      "check-declarations": {
        command: "tsc -p scripts/tsconfig.check-declarations.json",
        cache: false, // restore: remove this line (default caching; tsc runs with noEmit)
      },
      "copy-root-files": {
        command:
          "shx cp ../../README.md . && shx cp ../../LICENSE . && shx cp ../../CHANGELOG.md .",
        cache: false,
      },
      // Not cached: its only input is in dist/, which the build task excludes from its inputs,
      // so a cached check would replay a stale result.
      "check-bundled-peers": {
        command: "node ../../scripts/check-bundled-peers.mjs",
        cache: false,
      },
      // Not cached: its only input is in dist/, which the build task excludes from its inputs,
      // so a cached copy would replay a stale file.
      "copy-esm-js": {
        command: "shx cp dist/mobx-keystone.esm.mjs dist/mobx-keystone.esm.js",
        cache: false,
      },
      build: {
        command:
          "vp run copy-root-files && vp run clean-dist && vp run build-types && vp pack && vp run check-declarations && vp run check-bundled-peers && vp run copy-esm-js",
        cache: { input: [{ auto: true }, "!dist/**"] },
      },
      "build-docs": {
        command:
          "shx rm -rf ../../apps/site/generated-api && node --import ./scripts/typedoc-typescript6-register.mjs ./node_modules/typedoc/dist/cli.js --options ./typedocconfig.js src/index.ts",
        dependsOn: ["build"],
      },
      test: {
        command: "vp test run",
        cache: { env: ["COMPILER", "MOBX_VERSION"] },
      },
      "test:ci": {
        command: "vp test run --coverage",
        cache: { env: ["COMPILER", "MOBX_VERSION"] },
      },
      "test:perf": {
        command: "vp run build && vp run test:perf:run",
        cache: false,
      },
      "test:perf:run": {
        command:
          "NODE_ENV=production TS_NODE_COMPILER=@typescript/typescript6 /usr/bin/time node --expose-gc --require ts-node/register ./report.ts",
        cwd: "perf_bench",
        cache: false,
      },
      memtest: {
        command:
          "NODE_ENV=production TS_NODE_COMPILER=@typescript/typescript6 node --expose-gc --require ts-node/register ./memtest.ts",
        cwd: "perf_bench",
        cache: false,
      },
    },
  },
  // Declarations are emitted by the build-types task (one .d.ts per source file, like tsc does)
  // rather than by tsdown, which would merge them. That task runs before packing, so a type error
  // stops the build before anything is bundled.
  pack: {
    entry: "src/index.ts",
    format: ["esm", "umd"],
    globalName: "mobx-keystone",
    target: "node10",
    // Not "browser": that platform also replaces process.env.NODE_ENV.
    platform: "neutral",
    sourcemap: "inline",
    minify: "dce-only",
    dts: false,
    // dist/ is cleared by the build task before build-types writes into it.
    clean: false,
    // Everything but the peer dependencies is bundled.
    deps: { neverBundle: ["mobx"], alwaysBundle: [/.*/], onlyBundle: false },
    outputOptions: (options, format) => ({
      ...options,
      entryFileNames: format === "es" ? "mobx-keystone.esm.mjs" : "mobx-keystone.umd.js",
      globals: { mobx: "mobx" },
      // Keeps top-level declarations as `var`, so circular imports never hit a TDZ error.
      topLevelVar: true,
    }),
  },
})
