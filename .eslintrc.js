module.exports = {
  extends: [
    "react-app",
    "prettier",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
  ],
  rules: {
    // doesn't get along well with .js extensions (needed so node "type": module works)
    "import/no-unresolved": "off",
    // "import/no-cycle": ["error", { ignoreExternal: true }],
  },
}
