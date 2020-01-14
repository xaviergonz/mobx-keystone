module.exports = {
  rollup(config) {
    config.treeshake.propertyReadSideEffects = true
    return config
  },
}
