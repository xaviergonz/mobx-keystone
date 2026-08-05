const { mobxVersion } = require("./env").env

module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
  plugins: [
    ["@babel/plugin-transform-typescript"],
    ...(mobxVersion >= 7 ? ["@babel/plugin-transform-class-static-block"] : []),
    ["@babel/plugin-proposal-decorators", { version: mobxVersion >= 7 ? "2023-11" : "legacy" }],
    ["@babel/plugin-transform-class-properties", { loose: mobxVersion <= 5 }],
  ],
}
