import path from "path"
import { defineConfig } from "vite"
import { checker } from "vite-plugin-checker"

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
    checker({
      typescript: true,
    }),
    /*
        {
      ...typescript2({
        useTsconfigDeclarationDir: true,
      }),
      apply: "build",
      enforce: "pre",
    },
    */
  ],
})
