import { defineConfig } from "vitest/config"
import { env } from "./env.js"

const { mobxVersion, compiler } = env
console.log(`Using mobxVersion=${mobxVersion}, compiler=${compiler}`)

const tsconfigFiles = {
  6: compiler === "tsc" ? "tsconfig.json" : "tsconfig.experimental-decorators.json",
  5: "tsconfig.mobx5.json",
  4: "tsconfig.mobx4.json",
} as const

const mobxModuleNames = {
  6: "mobx",
  5: "mobx-v5",
  4: "mobx-v4",
} as const

const tsCompilerOptionsByTsconfig = {
  "tsconfig.json": {
    experimentalDecorators: false,
    useDefineForClassFields: true,
  },
  "tsconfig.experimental-decorators.json": {
    experimentalDecorators: true,
    useDefineForClassFields: true,
  },
  "tsconfig.mobx5.json": {
    experimentalDecorators: true,
    useDefineForClassFields: true,
  },
  "tsconfig.mobx4.json": {
    experimentalDecorators: true,
    useDefineForClassFields: false,
  },
} as const

if (!["tsc", "tsc-experimental-decorators", "babel", "swc"].includes(compiler)) {
  throw new Error("$COMPILER must be one of {tsc,tsc-experimental-decorators,babel,swc}")
}

const tsconfigFile = tsconfigFiles[mobxVersion as keyof typeof tsconfigFiles]
const mobxModuleName = mobxModuleNames[mobxVersion as keyof typeof mobxModuleNames]

if (!tsconfigFile || !mobxModuleName) {
  throw new Error("$MOBX_VERSION must be one of {4,5,6}")
}

const tsCompilerOptions = tsCompilerOptionsByTsconfig[tsconfigFile]

export default defineConfig({
  resolve: {
    alias: {
      mobx: mobxModuleName,
    },
  },
  test: {
    setupFiles: ["./test/commonSetup.ts"],
    environment: "node",
    globals: true,
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: tsCompilerOptions,
    },
  },
})
