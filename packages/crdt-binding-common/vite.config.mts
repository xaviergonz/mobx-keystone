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
      "quick-build-tests": {
        command: "tsc -p test",
        cache: false, // restore: remove this line (default caching; tsc runs with noEmit)
      },
      test: {
        command: "vp test run",
        dependsOn: ["mobx-keystone#build"],
      },
      "test:ci": {
        command: "vp run quick-build-tests && vp test run",
        dependsOn: ["mobx-keystone#build"],
      },
    },
  },
})
