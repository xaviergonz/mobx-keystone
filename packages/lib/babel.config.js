const { mobxVersion } = require("./env").env

module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-typescript", { allowDeclareFields: true }],
  ],
  plugins: [
    ["@babel/plugin-proposal-decorators", { version: "legacy" }],
    ["@babel/plugin-proposal-class-properties", { loose: mobxVersion <= 5 }],
  ],
}
