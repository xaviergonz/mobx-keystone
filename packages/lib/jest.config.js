const config = {}

switch (process.env.COMPILER || "tsc") {
  case "tsc":
    Object.assign(config, {
      preset: "ts-jest",
      testEnvironment: "node",
      globals: {
        "ts-jest": {
          tsconfig: "./test/tsconfig.json",
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
