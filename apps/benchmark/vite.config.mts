import { defineConfig } from "vite-plus"

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "shx rm -rf dist && tsc -p .",
        dependsOn: ["mobx-keystone#build"],
        // On macOS the TypeScript 7 native tsc binary is signed with Hardened Runtime, so the vp run
        // cache cannot track the files it reads and would replay stale results. Tasks that run tsc
        // must use `cache: false` until a stable TypeScript release ships
        // https://github.com/microsoft/typescript-go/pull/4868
        // (see https://github.com/voidzero-dev/vite-task/issues/587).
        // restore: cache: { input: [{ auto: true }, "!dist/**"] },
        cache: false,
      },
    },
  },
})
