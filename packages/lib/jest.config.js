const tsconfigFiles = {
  6: "tsconfig.json",
  5: "tsconfig.mobx5.json",
  4: "tsconfig.mobx4.json",
}

const mobxVersion = process.env.MOBX_VERSION || "6"

const tsconfigFile = tsconfigFiles[mobxVersion]

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      tsconfig: `./test/${tsconfigFile}`,
    },
  },
  setupFiles: ["./jest.setup.js"],
}
