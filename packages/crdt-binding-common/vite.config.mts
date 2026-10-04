import { defineConfig } from "vite-plus"

export default defineConfig({
  run: {
    tasks: {
      "quick-build-tests": { command: "tsc -p test" },
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
