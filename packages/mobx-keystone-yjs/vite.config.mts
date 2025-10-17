import path from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
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
  plugins: [
    dts({
      tsconfigPath: resolvePath("./tsconfig.json"),
      outDir: resolvePath("./dist/types"),
    }),
  ],
})
