const { mobxVersion } = require("./env").env

module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
  plugins: [
    ["@babel/plugin-transform-typescript"],
    ["@babel/plugin-proposal-decorators", { version: "legacy" }],
    ["@babel/plugin-transform-class-properties", { loose: mobxVersion <= 5 }],
  ],
}
