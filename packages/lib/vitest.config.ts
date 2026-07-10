import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as babel from "@babel/core"
import * as swc from "@swc/core"
import { defineConfig } from "vitest/config"
import { env } from "./env.js"

const { mobxVersion, compiler } = env
// biome-ignore lint/suspicious/noConsole: this config intentionally prints the active test matrix for local runs.
console.log(`Using mobxVersion=${mobxVersion}, compiler=${compiler}`)

const require = createRequire(import.meta.url)
const babelConfig = require("./babel.config.js") as babel.InputOptions
const swcConfig = require("./swc.config.js") as swc.Options

const rootDir = path.dirname(fileURLToPath(import.meta.url))

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

const createTscOutputReader = () => {
  let tempDir: string | undefined

  const reset = () => {
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true })
      tempDir = undefined
    }
  }

  const read = (filePath: string) => {
    if (!tempDir) {
      tempDir = mkdtempSync(path.join(os.tmpdir(), `mobx-keystone-vitest-${compiler}-`))
      const outDir = path.join(tempDir, "js")
      const declarationDir = path.join(tempDir, "types")
      const typescriptDir = path.dirname(require.resolve("typescript/package.json"))
      const tscBin = path.join(typescriptDir, "bin", "tsc")
      const result = spawnSync(
        process.execPath,
        [
          tscBin,
          "-p",
          path.resolve(rootDir, "test", tsconfigFile),
          "--noEmit",
          "false",
          "--outDir",
          outDir,
          "--declarationDir",
          declarationDir,
          "--sourceMap",
          "true",
          "--inlineSources",
          "true",
          "--module",
          "ESNext",
          "--pretty",
          "false",
        ],
        {
          cwd: rootDir,
          encoding: "utf8",
        }
      )

      if (result.status !== 0) {
        throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"))
      }
    }

    const outDir = path.join(tempDir, "js")
    const relativePath = path.relative(rootDir, filePath)
    const emittedPath = path.join(outDir, relativePath).replace(/\.tsx?$/, ".js")
    const code = readFileSync(emittedPath, "utf8")
    const mapPath = `${emittedPath}.map`

    return {
      code,
      map: JSON.parse(readFileSync(mapPath, "utf8")),
    }
  }

  process.once("exit", reset)

  return { read, reset }
}

const tscOutputReader = createTscOutputReader()
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
        case "tsc-experimental-decorators":
          return tscOutputReader.read(filePath)

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
    handleHotUpdate() {
      tscOutputReader.reset()
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
  oxc: false,
})
