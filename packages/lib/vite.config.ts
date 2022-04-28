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
      external: ["mobx", "nanoid/non-secure", "fast-deep-equal/es6", "tslib"],

      output: [
        {
          format: "esm",
          entryFileNames: "[name].mjs",
          dir: "dist/esm",
          preserveModules: true,
        },
        {
          format: "umd",
          globals: {
            mobx: "mobx",
            "nanoid/non-secure": "nanoid/non-secure",
            "fast-deep-equal/es6": "fast-deep-equal/es6",
            tslib: "tslib",
          },
        },
      ],
    },
  },
  plugins: [
    {
      ...typescript2({
        useTsconfigDeclarationDir: true,
      }),
      apply: "build",
      enforce: "pre",
    },
  ],
})
