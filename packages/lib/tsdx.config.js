module.exports = {
  rollup(config) {
    config.output.treeshake.propertyReadSideEffects = true
    return config
  },
}
