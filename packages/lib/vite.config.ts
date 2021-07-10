import typescript from "@rollup/plugin-typescript"
import path from "path"
import { defineConfig } from "vite"

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
  build: {
    lib: {
      entry: resolvePath("./src/index.ts"),
      name: "mobxKeystone",
    },
    sourcemap: "inline",
    minify: false,
    rollupOptions: {
      external: ["mobx"],
      output: {
        globals: {
          mobx: "mobx",
        },
      },
      plugins: [typescript({})],
    },
  },
})
