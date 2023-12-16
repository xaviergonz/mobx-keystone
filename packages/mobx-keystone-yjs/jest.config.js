const config = {
  setupFilesAfterEnv: ["./test/commonSetup.ts"],
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: `./test/tsconfig.json` }],
  },
}

module.exports = config
