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
      "copy-root-files": {
        command: "shx cp ../../LICENSE .",
        cache: false,
      },
      build: {
        command:
          "vp run quick-build && vp run copy-root-files && shx rm -rf dist && vp build && shx cp dist/mobx-keystone-loro.esm.mjs dist/mobx-keystone-loro.esm.js",
        dependsOn: ["mobx-keystone#build"],
        cache: { input: [{ auto: true }, "!dist/**"] },
      },
      test: {
        command: "vp test run",
        dependsOn: ["@mobx-keystone/crdt-binding-common#test"],
      },
      "test:ci": {
        command: "vp test run",
        dependsOn: ["@mobx-keystone/crdt-binding-common#test:ci"],
      },
      bench: {
        command: "vp test bench --run",
        cache: false,
      },
    },
  },
  build: {
    target: "node10",
    lib: {
      entry: resolvePath("./src/index.ts"),
      name: "mobx-keystone-loro",
    },
    sourcemap: "inline",
    minify: false,

    rollupOptions: {
      external: ["mobx", "mobx-keystone", "loro-crdt"],

      output: [
        {
          format: "esm",
          entryFileNames: "mobx-keystone-loro.esm.mjs",
        },
        {
          name: "mobx-keystone-loro",
          format: "umd",
          globals: {
            mobx: "mobx",
            "mobx-keystone": "mobx-keystone",
            "loro-crdt": "loro-crdt",
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
