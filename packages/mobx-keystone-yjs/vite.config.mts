import path from "node:path"
import dts from "vite-plugin-dts"
import { defineConfig, lazyPlugins } from "vite-plus"

const resolvePath = (str: string) => path.resolve(import.meta.dirname, str)

export default defineConfig({
  run: {
    tasks: {
      "quick-build": { command: "tsc" },
      "quick-build-tests": { command: "tsc -p test" },
      "copy-root-files": {
        command: "shx cp ../../LICENSE .",
        cache: false,
      },
      build: {
        command:
          "vp run quick-build && vp run copy-root-files && shx rm -rf dist && vp build && shx cp dist/mobx-keystone-yjs.esm.mjs dist/mobx-keystone-yjs.esm.js",
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
    },
  },
  build: {
    target: "node10",
    lib: {
      entry: resolvePath("./src/index.ts"),
      name: "mobx-keystone-yjs",
    },
    sourcemap: "inline",
    minify: false,

    rollupOptions: {
      external: ["mobx", "mobx-keystone", "yjs"],

      output: [
        {
          format: "esm",
          entryFileNames: "mobx-keystone-yjs.esm.mjs",
        },
        {
          name: "mobx-keystone-yjs",
          format: "umd",
          globals: {
            mobx: "mobx",
            "mobx-keystone": "mobx-keystone",
            yjs: "yjs",
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
