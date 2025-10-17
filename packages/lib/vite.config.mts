import path from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
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
  plugins: [
    dts({
      tsconfigPath: resolvePath("./tsconfig.json"),
      outDir: resolvePath("./dist/types"),
    }),
  ],
})
