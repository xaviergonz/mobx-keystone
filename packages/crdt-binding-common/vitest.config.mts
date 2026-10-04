import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    setupFiles: ["./test/commonSetup.ts"],
    environment: "node",
    globals: true,
  },
})
