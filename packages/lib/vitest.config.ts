import { createRequire } from "node:module"
import * as babel from "@babel/core"
import * as swc from "@swc/core"
import * as ts from "@typescript/typescript6"
import { defineConfig } from "vitest/config"
import { env } from "./env.js"

const { mobxVersion, compiler } = env
// biome-ignore lint/suspicious/noConsole: this config intentionally prints the active test matrix for local runs.
console.log(`Using mobxVersion=${mobxVersion}, compiler=${compiler}`)

const require = createRequire(import.meta.url)
const babelConfig = require("./babel.config.js") as babel.InputOptions
const swcConfig = require("./swc.config.js") as swc.Options

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => "\n",
}

const mobxModuleNames = {
  7: "mobx-v7",
  6: "mobx-v6",
  5: "mobx-v5",
  4: "mobx-v4",
} as const

if (!["tsc", "tsc-experimental-decorators", "babel", "swc"].includes(compiler)) {
  throw new Error("$COMPILER must be one of {tsc,tsc-experimental-decorators,babel,swc}")
}

const mobxModuleName = mobxModuleNames[mobxVersion as keyof typeof mobxModuleNames]

if (!mobxModuleName) {
  throw new Error("$MOBX_VERSION must be one of {4,5,6,7}")
}

// This is the source of truth for the TypeScript transform matrix. Vitest only
// transpiles each module, so the deleted test tsconfig variants' `paths` and
// type-checking options do not apply here; `resolve.alias` selects the MobX runtime.
// `tsc-experimental-decorators` and MobX 4/5 use legacy decorators; the remaining
// TypeScript configurations use standard decorators. MobX 4 alone needs assignment
// semantics for class fields.
const tsCompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  sourceMap: true,
  inlineSources: true,
  importHelpers: true,
  experimentalDecorators: compiler === "tsc-experimental-decorators" || mobxVersion < 6,
  useDefineForClassFields: mobxVersion !== 4,
} satisfies ts.CompilerOptions

const babelPresets: babel.PresetItem[] | undefined = babelConfig.presets?.map((preset) => {
  if (Array.isArray(preset) && preset[0] === "@babel/preset-env") {
    const presetOptions =
      typeof preset[1] === "object" && preset[1] !== null ? (preset[1] as object) : {}
    return [preset[0], { ...presetOptions, modules: false }] as babel.PresetItem
  }
  return preset
})

const compilerPlugin = () => {
  return {
    name: "mobx-keystone-test-compiler",
    enforce: "pre" as const,
    async transform(code: string, id: string) {
      const filePath = id.split("?")[0]
      if (
        !filePath.endsWith(".ts") ||
        filePath.endsWith(".d.ts") ||
        filePath.includes("/node_modules/")
      ) {
        return null
      }

      switch (compiler) {
        case "tsc":
        case "tsc-experimental-decorators": {
          const transformed = ts.transpileModule(code, {
            compilerOptions: tsCompilerOptions,
            fileName: filePath,
            reportDiagnostics: true,
          })

          const diagnostics = transformed.diagnostics?.filter(
            (d) => d.category === ts.DiagnosticCategory.Error
          )
          if (diagnostics && diagnostics.length > 0) {
            throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost))
          }

          return {
            code: transformed.outputText,
            map: transformed.sourceMapText ? JSON.parse(transformed.sourceMapText) : null,
          }
        }

        case "babel": {
          const transformed = await babel.transformAsync(code, {
            ...babelConfig,
            presets: babelPresets,
            babelrc: false,
            configFile: false,
            filename: filePath,
            sourceMaps: true,
            sourceFileName: filePath,
          })

          if (!transformed?.code) {
            return null
          }

          return {
            code: transformed.code,
            map: transformed.map ?? null,
          }
        }

        case "swc": {
          const transformed = await swc.transform(code, {
            ...swcConfig,
            filename: filePath,
            sourceMaps: true,
            jsc: {
              ...(swcConfig.jsc ?? {}),
              target: "es2020",
              parser: {
                syntax: "typescript",
                decorators: true,
                ...((swcConfig.jsc?.parser as object | undefined) ?? {}),
              },
              transform: {
                legacyDecorator: mobxVersion < 7,
                decoratorVersion: mobxVersion >= 7 ? "2022-03" : undefined,
                useDefineForClassFields: mobxVersion !== 4,
                ...((swcConfig.jsc?.transform as object | undefined) ?? {}),
              },
            },
            module: {
              ...(swcConfig.module ?? {}),
              type: "es6",
            },
          })

          return {
            code: transformed.code,
            map: transformed.map ? JSON.parse(transformed.map) : null,
          }
        }

        default:
          throw new Error("$COMPILER must be one of {tsc,tsc-experimental-decorators,babel,swc}")
      }
    },
  }
}

export default defineConfig({
  plugins: [compilerPlugin()],
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
})
