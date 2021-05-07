exports.onCreateBabelConfig = ({ actions }) => {
  actions.setBabelPlugin({
    name: `@babel/plugin-proposal-decorators`,
    options: { legacy: true },
  })
  actions.setBabelPlugin({
    name: "@babel/plugin-proposal-class-properties",
    options: { loose: false },
  })
  actions.setBabelPlugin({
    name: "@babel/plugin-proposal-private-methods",
    options: { loose: false },
  })
  actions.setBabelPlugin({
    name: "@babel/plugin-transform-classes",
  })
}
