import * as babel from "@babel/core"
import * as swc from "@swc/core"
import { createRequire } from "module"
import path from "path"
import ts from "typescript"
import { fileURLToPath } from "url"
import { defineConfig } from "vitest/config"
import { env } from "./env.js"

const { mobxVersion, compiler } = env
console.log(`Using mobxVersion=${mobxVersion}, compiler=${compiler}`)

const require = createRequire(import.meta.url)
const babelConfig = require("./babel.config.js") as babel.TransformOptions
const swcConfig = require("./swc.config.js") as swc.Options

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => "\n",
}

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

if (!["tsc", "tsc-experimental-decorators", "babel", "swc"].includes(compiler)) {
  throw new Error("$COMPILER must be one of {tsc,tsc-experimental-decorators,babel,swc}")
}

const tsconfigFile = tsconfigFiles[mobxVersion as keyof typeof tsconfigFiles]
const mobxModuleName = mobxModuleNames[mobxVersion as keyof typeof mobxModuleNames]

if (!tsconfigFile || !mobxModuleName) {
  throw new Error("$MOBX_VERSION must be one of {4,5,6}")
}

const getTsCompilerOptions = () => {
  const tsconfigPath = path.resolve(rootDir, "test", tsconfigFile)
  const tsconfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  if (tsconfig.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([tsconfig.error], diagnosticHost))
  }

  const parsed = ts.parseJsonConfigFileContent(
    tsconfig.config,
    ts.sys,
    path.dirname(tsconfigPath),
    {},
    tsconfigPath
  )

  if (parsed.errors.length > 0) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, diagnosticHost))
  }

  return {
    ...parsed.options,
    module: ts.ModuleKind.ESNext,
    sourceMap: true,
    inlineSourceMap: false,
    inlineSources: true,
  } satisfies ts.CompilerOptions
}

const tsCompilerOptions = getTsCompilerOptions()
const babelPresets = (babelConfig.presets as babel.TransformOptions["presets"])?.map((preset) => {
  if (Array.isArray(preset) && preset[0] === "@babel/preset-env") {
    const presetOptions =
      typeof preset[1] === "object" && preset[1] !== null ? (preset[1] as object) : {}
    return [preset[0], { ...presetOptions, modules: false }]
  }
  return preset
}) as babel.TransformOptions["presets"]

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
                legacyDecorator: true,
                useDefineForClassFields: tsCompilerOptions.useDefineForClassFields ?? true,
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
  esbuild: false,
})
