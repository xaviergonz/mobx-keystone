// SWC configuration via a JS file is currently not supported, but we're
// loading it in `jest.config.js` manually, so not a problem.
// https://github.com/swc-project/swc/issues/1547

module.exports = {
  jsc: {
    parser: {
      syntax: "typescript",
      decorators: true,
    },
  },
}
