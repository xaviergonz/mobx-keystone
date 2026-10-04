import { defineConfig } from "vite-plus"

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "shx rm -rf dist && tsc -p .",
        dependsOn: ["mobx-keystone#build"],
        cache: { input: [{ auto: true }, "!dist/**"] },
      },
    },
  },
})
