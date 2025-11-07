import type { Config } from "jest"
import { env } from "./env.js"
import swcConfig from "./swc.config.js"

const { mobxVersion, compiler } = env
console.log(`Using mobxVersion=${mobxVersion}, compiler=${compiler}`)

const tsconfigFiles = {
  6: compiler === "tsc" ? "tsconfig.json" : "tsconfig.experimental-decorators.json",
  5: "tsconfig.mobx5.json",
  4: "tsconfig.mobx4.json",
}

const mobxModuleNames = {
  6: "mobx",
  5: "mobx-v5",
  4: "mobx-v4",
}

const tsconfigFile = tsconfigFiles[mobxVersion]
const mobxModuleName = mobxModuleNames[mobxVersion]

const config: Config = {
  setupFilesAfterEnv: ["./test/commonSetup.ts"],
  moduleNameMapper: {
    "^mobx$": mobxModuleName,
  },
  prettierPath: null,
}

switch (compiler) {
  case "tsc":
  case "tsc-experimental-decorators":
    Object.assign(config, {
      preset: "ts-jest",
      testEnvironment: "node",
      transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: `./test/${tsconfigFile}` }],
      },
    })
    break

  case "babel":
    break

  case "swc":
    Object.assign(config, {
      transform: {
        "^.+\\.ts$": ["@swc/jest", swcConfig],
      },
    })
    break

  default:
    throw new Error("$COMPILER must be one of {tsc,tsc-experimental-decorators,babel,swc}")
}

export default config
