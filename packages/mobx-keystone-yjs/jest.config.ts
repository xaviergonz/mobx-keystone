import type { Config } from "jest"

const config: Config = {
  setupFilesAfterEnv: ["./test/commonSetup.ts"],
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: `./test/tsconfig.json` }],
  },
  prettierPath: null,
}

export default config
