const { mobxVersion, compiler } = require("./env")

const tsconfigFiles = {
  6: compiler === "tsc" ? "tsconfig.json" : "tsconfig.old-decorators.json",
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

const config = {
  setupFilesAfterEnv: ["./test/commonSetup.ts"],
  moduleNameMapper: {
    "^mobx$": mobxModuleName,
  },
}

switch (compiler) {
  case "tsc":
  case "tsc-old-decorators":
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
        "^.+\\.ts$": ["@swc/jest", require("./swc.config.js")],
      },
    })
    break

  default:
    throw new Error("$COMPILER must be one of {tsc,tsc-old-decorators,babel,swc}")
}

module.exports = config
