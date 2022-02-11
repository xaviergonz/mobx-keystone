const tsconfigFiles = {
  6: "tsconfig.json",
  5: "tsconfig.mobx5.json",
  4: "tsconfig.mobx4.json",
}

const mobxModuleNames = {
  6: "mobx",
  5: "mobx-v5",
  4: "mobx-v4",
}

const mobxVersion = process.env.MOBX_VERSION || "6"

const tsconfigFile = tsconfigFiles[mobxVersion]
const mobxModuleName = mobxModuleNames[mobxVersion]

const config = {
  setupFilesAfterEnv: ["./test/commonSetup.ts"],
  moduleNameMapper: {
    "^mobx$": mobxModuleName,
  },
}

switch (process.env.COMPILER || "tsc") {
  case "tsc":
    Object.assign(config, {
      preset: "ts-jest",
      testEnvironment: "node",
      globals: {
        "ts-jest": {
          tsconfig: `./test/${tsconfigFile}`,
        },
      },
    })
    break

  case "babel":
    break

  default:
    throw new Error("$COMPILER must be one of {tsc,babel}")
}

module.exports = config
