import path from "path"
import typescript2 from "rollup-plugin-typescript2"
import { defineConfig } from "vite"

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
  build: {
    target: "node10",
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
    },
  },
  plugins: [{ ...typescript2({}), apply: "build", enforce: "pre" }],
})
