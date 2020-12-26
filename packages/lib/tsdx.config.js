module.exports = {
  rollup(config) {
    config.treeshake.propertyReadSideEffects = true
    config.output.globals = {
      mobx: "mobx",
      uuid: "uuid",
      tslib: "tslib",
      "fast-deep-equal/es6": "fast-deep-equal/es6",
    }
    return config
  },
}
