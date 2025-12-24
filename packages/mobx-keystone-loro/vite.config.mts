import path from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
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
  plugins: [
    dts({
      tsconfigPath: resolvePath("./tsconfig.json"),
      outDir: resolvePath("./dist/types"),
    }),
  ],
})
