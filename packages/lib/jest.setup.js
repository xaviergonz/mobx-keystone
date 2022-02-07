jest.mock("mobx", () => {
  const packages = {
    6: "mobx",
    5: "mobx-v5",
    4: "mobx-v4",
  }
  const version = process.env.MOBX_VERSION || "6"

  const originalModule = jest.requireActual(packages[version])

  return {
    __esModule: true,
    ...originalModule,
  }
})
