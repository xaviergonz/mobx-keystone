import path from "node:path"
import dts from "vite-plugin-dts"
import { defineConfig, lazyPlugins } from "vite-plus"

const resolvePath = (str: string) => path.resolve(import.meta.dirname, str)

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
      "check-declarations": {
        command: "tsc -p scripts/tsconfig.check-declarations.json",
        cache: false, // restore: remove this line (default caching; tsc runs with noEmit)
      },
      "copy-root-files": {
        command:
          "shx cp ../../README.md . && shx cp ../../LICENSE . && shx cp ../../CHANGELOG.md .",
        cache: false,
      },
      build: {
        command:
          "vp run quick-build && vp run copy-root-files && shx rm -rf dist && vp build && vp run check-declarations && shx cp dist/mobx-keystone.esm.mjs dist/mobx-keystone.esm.js",
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
  build: {
    target: "node10",
    lib: {
      entry: resolvePath("./src/index.ts"),
      name: "mobx-keystone",
    },
    sourcemap: "inline",
    minify: false,

    rollupOptions: {
      external: ["mobx"],

      output: [
        {
          format: "esm",
          entryFileNames: "mobx-keystone.esm.mjs",
        },
        {
          name: "mobx-keystone",
          format: "umd",
          globals: {
            mobx: "mobx",
          },
        },
      ],
    },
  },
  plugins: lazyPlugins(() => [
    dts({
      tsconfigPath: resolvePath("./tsconfig.json"),
      outDirs: resolvePath("./dist/types"),
      entryRoot: resolvePath("./src"),
    }),
  ]),
})
